-- Lady Bedford's — AGGIORNAMENTO 4: HACCP (temperature, pulizie, non conformità, attestati del personale).
-- Eseguilo una volta nel SQL Editor di Supabase, dopo 01_schema.sql. Si può rieseguire senza danni.
--
-- Come funziona (stesso schema del resto del progetto):
--  * Cucina e proprietà (public.is_back()) leggono i registri; nessuno scrive direttamente sulle tabelle dei registri.
--  * Le rilevazioni passano da funzioni (haccp_log_temperature, haccp_tick_cleaning): soglie e orario li decide il server.
--  * I registri sono in sola aggiunta: un trigger blocca modifiche e cancellazioni. Una correzione è una nuova riga.
--  * I PIN sono condivisi per ruolo, quindi ogni riga salva anche il NOME dell'operatore scelto da un elenco
--    (haccp_operators) oltre all'utente e al ruolo che hanno fatto l'accesso.
--  * Configurazione (attrezzature, attività di pulizia, attestati): solo la proprietà scrive, con registro delle modifiche.

-- ---------- attrezzature e temperature ----------
create table if not exists public.haccp_equipment (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (length(trim(name)) between 1 and 60),
  kind       text not null default 'frigo' check (kind in ('frigo','congelatore','abbattitore','altro')),
  temp_min   numeric(4,1) not null,
  temp_max   numeric(4,1) not null,
  slots      text[] not null default '{}',     -- orari attesi di rilevazione, 'HH:MM'
  active     boolean not null default true,    -- non si cancella: si disattiva
  sort       int not null default 0,
  created_at timestamptz not null default now(),
  check (temp_min < temp_max)
);

create table if not exists public.haccp_temp_readings (
  id                uuid primary key default gen_random_uuid(),
  day               date not null default ((now() at time zone 'Europe/Rome')::date),
  at                timestamptz not null default now(),
  equipment_id      uuid not null references public.haccp_equipment(id),
  equipment_name    text not null,                       -- nome al momento della lettura
  value             numeric(4,1) not null,
  limit_min         numeric(4,1) not null,               -- soglie al momento della lettura
  limit_max         numeric(4,1) not null,
  in_range          boolean not null,
  corrective_action text check (corrective_action is null or length(corrective_action) <= 300),
  operator          text check (operator is null or length(operator) <= 60),
  by                uuid default auth.uid(),
  by_role           text default public.staff_role(),
  corrects_id       uuid references public.haccp_temp_readings(id),
  check (in_range or corrective_action is not null)
);
create index if not exists haccp_temp_day_idx on public.haccp_temp_readings (day desc, equipment_id);

-- ---------- non conformità ----------
create table if not exists public.haccp_nonconformities (
  id          uuid primary key default gen_random_uuid(),
  opened_at   timestamptz not null default now(),
  source      text not null,                -- es. 'temperature'
  source_id   uuid,
  description text not null,
  status      text not null default 'aperta' check (status in ('aperta','chiusa')),
  cause       text check (cause is null or length(cause) <= 300),
  resolution  text check (resolution is null or length(resolution) <= 300),
  closed_at   timestamptz,
  closed_by   uuid
);
create index if not exists haccp_nc_status_idx on public.haccp_nonconformities (status, opened_at desc);

-- ---------- pulizie e sanificazione ----------
create table if not exists public.haccp_cleaning_tasks (
  id         uuid primary key default gen_random_uuid(),
  area       text not null check (length(trim(area)) between 1 and 40),
  name       text not null check (length(trim(name)) between 1 and 80),
  frequency  text not null default 'giornaliera' check (frequency in ('giornaliera','settimanale','mensile')),
  sort       int not null default 0,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.haccp_cleaning_logs (
  id        uuid primary key default gen_random_uuid(),
  task_id   uuid not null references public.haccp_cleaning_tasks(id),
  task_name text not null,
  area      text not null,
  day       date not null default ((now() at time zone 'Europe/Rome')::date),
  at        timestamptz not null default now(),
  operator  text check (operator is null or length(operator) <= 60),
  by        uuid default auth.uid(),
  by_role   text default public.staff_role(),
  note      text check (note is null or length(note) <= 200),
  unique (task_id, day)
);

-- ---------- attestati del personale (solo proprietà, come personale e turni) ----------
create table if not exists public.staff_certificates (
  id         uuid primary key default gen_random_uuid(),
  member_id  uuid not null references public.staff_members(id) on delete cascade,
  kind       text not null check (length(trim(kind)) between 1 and 60),   -- es. 'HACCP', 'Antincendio'
  issued_on  date,
  expires_on date not null,
  note       text check (note is null or length(note) <= 200),
  created_at timestamptz not null default now()
);
create index if not exists staff_certificates_exp_idx on public.staff_certificates (expires_on);

-- ---------- registro delle modifiche alla configurazione ----------
create table if not exists public.haccp_audit_log (
  id         bigserial primary key,
  table_name text not null,
  row_id     uuid,
  action     text not null,
  old_data   jsonb,
  new_data   jsonb,
  changed_by uuid default auth.uid(),
  changed_at timestamptz not null default now()
);

create or replace function public.haccp_audit() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.haccp_audit_log (table_name, row_id, action, old_data, new_data)
  values (tg_table_name, (coalesce(to_jsonb(new), to_jsonb(old)) ->> 'id')::uuid, tg_op, to_jsonb(old), to_jsonb(new));
  return coalesce(new, old);
end $$;

do $$ declare t text; begin
  foreach t in array array['haccp_equipment','haccp_cleaning_tasks','staff_certificates'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_audit', t);
    execute format('create trigger %I after insert or update or delete on public.%I for each row execute function public.haccp_audit()', t || '_audit', t);
  end loop;
end $$;

-- ---------- registri in sola aggiunta ----------
create or replace function public.haccp_block_changes() returns trigger
language plpgsql as $$
begin
  raise exception 'registro non modificabile: inserisci una correzione';
end $$;

do $$ declare t text; begin
  foreach t in array array['haccp_temp_readings','haccp_cleaning_logs'] loop
    execute format('drop trigger if exists %I on public.%I', t || '_immutable', t);
    execute format('create trigger %I before update or delete on public.%I for each row execute function public.haccp_block_changes()', t || '_immutable', t);
  end loop;
end $$;

-- ---------- funzioni per cucina e proprietà ----------
-- Elenco dei nomi tra cui scegliere "chi sta compilando" (la cucina non può leggere staff_members)
create or replace function public.haccp_operators() returns table (id uuid, name text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  return query select m.id, m.name from public.staff_members m where m.active and m.role = 'cucina' order by m.sort, m.name;
end $$;
grant execute on function public.haccp_operators() to authenticated;

-- Registra una temperatura. Fuori soglia: serve l'azione correttiva e si apre una non conformità.
create or replace function public.haccp_log_temperature(p_equipment uuid, p_value numeric, p_action text, p_operator text, p_corrects uuid default null)
returns json language plpgsql security definer set search_path = public as $$
declare e public.haccp_equipment; v_ok boolean; v_id uuid;
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  select * into e from public.haccp_equipment where id = p_equipment and active;
  if not found then raise exception 'attrezzatura sconosciuta'; end if;
  if p_value is null or p_value < -60 or p_value > 300 then raise exception 'valore non valido'; end if;
  v_ok := p_value between e.temp_min and e.temp_max;
  if not v_ok and coalesce(trim(p_action), '') = '' then raise exception 'indica l''azione correttiva'; end if;
  insert into public.haccp_temp_readings (equipment_id, equipment_name, value, limit_min, limit_max, in_range, corrective_action, operator, corrects_id)
  values (e.id, e.name, p_value, e.temp_min, e.temp_max, v_ok,
          nullif(left(trim(coalesce(p_action, '')), 300), ''),
          nullif(left(trim(coalesce(p_operator, '')), 60), ''),
          p_corrects)
  returning id into v_id;
  if not v_ok then
    insert into public.haccp_nonconformities (source, source_id, description)
    values ('temperature', v_id, e.name || ': ' || p_value || ' °C (limiti ' || e.temp_min || ' / ' || e.temp_max || ')');
  end if;
  return json_build_object('id', v_id, 'in_range', v_ok);
end $$;
grant execute on function public.haccp_log_temperature(uuid, numeric, text, text, uuid) to authenticated;

-- Segna un'attività di pulizia come fatta oggi (una sola volta al giorno per attività)
create or replace function public.haccp_tick_cleaning(p_task uuid, p_operator text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  insert into public.haccp_cleaning_logs (task_id, task_name, area, operator, note)
  select t.id, t.name, t.area, nullif(left(trim(coalesce(p_operator, '')), 60), ''), nullif(left(trim(coalesce(p_note, '')), 200), '')
  from public.haccp_cleaning_tasks t where t.id = p_task and t.active
  on conflict (task_id, day) do nothing;
  if not exists (select 1 from public.haccp_cleaning_tasks where id = p_task and active) then
    raise exception 'attività sconosciuta';
  end if;
end $$;
grant execute on function public.haccp_tick_cleaning(uuid, text, text) to authenticated;

-- Chiude una non conformità (solo proprietà): una non conformità chiusa resta nello storico
create or replace function public.haccp_close_nc(p_id uuid, p_cause text, p_resolution text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_owner() then raise exception 'solo la proprietà può chiudere una non conformità'; end if;
  if coalesce(trim(p_resolution), '') = '' then raise exception 'descrivi l''azione svolta'; end if;
  update public.haccp_nonconformities
     set status = 'chiusa',
         cause = nullif(left(trim(coalesce(p_cause, '')), 300), ''),
         resolution = left(trim(p_resolution), 300),
         closed_at = now(), closed_by = auth.uid()
   where id = p_id and status = 'aperta';
  if not found then raise exception 'non conformità non trovata o già chiusa'; end if;
end $$;
grant execute on function public.haccp_close_nc(uuid, text, text) to authenticated;

-- ---------- sicurezza a livello di riga ----------
-- Configurazione: legge cucina e proprietà, scrive solo la proprietà (niente cancellazioni: si disattiva)
do $$ declare t text; begin
  foreach t in array array['haccp_equipment','haccp_cleaning_tasks'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select, insert, update on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_back())', t || '_read', t);
    execute format('drop policy if exists %I on public.%I', t || '_ins', t);
    execute format('create policy %I on public.%I for insert to authenticated with check (public.is_owner())', t || '_ins', t);
    execute format('drop policy if exists %I on public.%I', t || '_upd', t);
    execute format('create policy %I on public.%I for update to authenticated using (public.is_owner()) with check (public.is_owner())', t || '_upd', t);
  end loop;
end $$;

-- Registri: sola lettura per cucina e proprietà (si scrive solo con le funzioni sopra)
do $$ declare t text; begin
  foreach t in array array['haccp_temp_readings','haccp_cleaning_logs','haccp_nonconformities'] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('revoke all on public.%I from anon, authenticated', t);
    execute format('grant select on public.%I to authenticated', t);
    execute format('drop policy if exists %I on public.%I', t || '_read', t);
    execute format('create policy %I on public.%I for select to authenticated using (public.is_back())', t || '_read', t);
  end loop;
end $$;

-- Attestati e registro modifiche: solo proprietà
alter table public.staff_certificates enable row level security;
revoke all on public.staff_certificates from anon, authenticated;
grant select, insert, update, delete on public.staff_certificates to authenticated;
drop policy if exists staff_certificates_owner on public.staff_certificates;
create policy staff_certificates_owner on public.staff_certificates for all to authenticated using (public.is_owner()) with check (public.is_owner());

alter table public.haccp_audit_log enable row level security;
revoke all on public.haccp_audit_log from anon, authenticated;
grant select on public.haccp_audit_log to authenticated;
drop policy if exists haccp_audit_owner on public.haccp_audit_log;
create policy haccp_audit_owner on public.haccp_audit_log for select to authenticated using (public.is_owner());

-- ---------- tempo reale (il cruscotto della proprietà si aggiorna da solo) ----------
do $$
declare t text;
begin
  foreach t in array array['haccp_equipment', 'haccp_temp_readings', 'haccp_cleaning_tasks', 'haccp_cleaning_logs', 'haccp_nonconformities'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;
