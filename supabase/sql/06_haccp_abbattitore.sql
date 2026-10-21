-- Lady Bedford's — AGGIORNAMENTO 6: cicli dell'abbattitore con il tempo impiegato.
-- Eseguilo una volta nel SQL Editor di Supabase, dopo 04_haccp.sql. Si può rieseguire senza danni.
--
--  * Ciclo positivo: il prodotto cotto scende fino a +10 °C al cuore in al massimo 90 minuti.
--  * Ciclo negativo (surgelazione): fino a -18 °C in al massimo 240 minuti.
--  * Sono i valori prudenziali di uso comune: se il consulente indica limiti diversi, si cambiano qui (v_lim_temp, v_lim_min).
--  * Come gli altri registri, è in sola aggiunta. Un ciclo fuori limite richiede l'azione correttiva e apre una non conformità.

create table if not exists public.haccp_blast_cycles (
  id                uuid primary key default gen_random_uuid(),
  day               date not null default ((now() at time zone 'Europe/Rome')::date),
  at                timestamptz not null default now(),
  equipment_id      uuid references public.haccp_equipment(id),
  equipment_name    text not null,
  mode              text not null check (mode in ('positivo','negativo')),
  product           text not null check (length(trim(product)) between 1 and 80),
  start_temp        numeric(4,1) not null,
  end_temp          numeric(4,1) not null,
  minutes           integer not null check (minutes between 1 and 1440),
  limit_temp        numeric(4,1) not null,
  limit_minutes     integer not null,
  in_range          boolean not null,
  corrective_action text check (corrective_action is null or length(corrective_action) <= 300),
  operator          text check (operator is null or length(operator) <= 60),
  by                uuid default auth.uid(),
  by_role           text default public.staff_role()
);
create index if not exists haccp_blast_day_idx on public.haccp_blast_cycles (day desc);

drop trigger if exists haccp_blast_cycles_immutable on public.haccp_blast_cycles;
create trigger haccp_blast_cycles_immutable before update or delete on public.haccp_blast_cycles
  for each row execute function public.haccp_block_changes();

create or replace function public.haccp_log_blast(p_equipment uuid, p_mode text, p_product text, p_start_temp numeric, p_end_temp numeric, p_minutes integer, p_action text, p_operator text)
returns json language plpgsql security definer set search_path = public as $$
declare e public.haccp_equipment; v_ok boolean; v_id uuid; v_lim_temp numeric; v_lim_min integer;
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  select * into e from public.haccp_equipment where id = p_equipment and active and kind = 'abbattitore';
  if not found then raise exception 'abbattitore sconosciuto'; end if;
  if p_mode not in ('positivo','negativo') then raise exception 'tipo di ciclo non valido'; end if;
  if coalesce(trim(p_product), '') = '' then raise exception 'scrivi che prodotto è'; end if;
  if p_start_temp is null or p_end_temp is null or p_start_temp < -60 or p_start_temp > 300 or p_end_temp < -60 or p_end_temp > 300 then raise exception 'temperatura non valida'; end if;
  if p_minutes is null or p_minutes < 1 or p_minutes > 1440 then raise exception 'durata non valida'; end if;
  if p_mode = 'positivo' then v_lim_temp := 10; v_lim_min := 90; else v_lim_temp := -18; v_lim_min := 240; end if;
  v_ok := p_end_temp <= v_lim_temp and p_minutes <= v_lim_min;
  if not v_ok and coalesce(trim(p_action), '') = '' then raise exception 'indica l''azione correttiva'; end if;
  insert into public.haccp_blast_cycles (equipment_id, equipment_name, mode, product, start_temp, end_temp, minutes, limit_temp, limit_minutes, in_range, corrective_action, operator)
  values (e.id, e.name, p_mode, left(trim(p_product), 80), p_start_temp, p_end_temp, p_minutes, v_lim_temp, v_lim_min, v_ok,
          nullif(left(trim(coalesce(p_action, '')), 300), ''), nullif(left(trim(coalesce(p_operator, '')), 60), ''))
  returning id into v_id;
  if not v_ok then
    insert into public.haccp_nonconformities (source, source_id, description)
    values ('abbattitore', v_id, e.name || ' (' || left(trim(p_product), 80) || '): ' || p_end_temp || ' °C in ' || p_minutes || ' min (limite ' || v_lim_temp || ' °C in ' || v_lim_min || ' min)');
  end if;
  return json_build_object('id', v_id, 'in_range', v_ok);
end $$;
grant execute on function public.haccp_log_blast(uuid, text, text, numeric, numeric, integer, text, text) to authenticated;

alter table public.haccp_blast_cycles enable row level security;
revoke all on public.haccp_blast_cycles from anon, authenticated;
grant select on public.haccp_blast_cycles to authenticated;
drop policy if exists haccp_blast_cycles_read on public.haccp_blast_cycles;
create policy haccp_blast_cycles_read on public.haccp_blast_cycles for select to authenticated using (public.is_back());

do $$ begin
  begin alter publication supabase_realtime add table public.haccp_blast_cycles; exception when duplicate_object then null; end;
end $$;
