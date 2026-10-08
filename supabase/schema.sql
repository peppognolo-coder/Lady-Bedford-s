-- Lady Bedford's — schema v2 (Supabase / Postgres): ordini, sala, menu e servizi modificabili
-- Esegui tutto nello SQL Editor del progetto (si può rieseguire senza danni), poi segui supabase/README.md.

create extension if not exists pgcrypto;

-- ---------- catalogo ----------
create table if not exists public.menu_items (
  id        text primary key,
  cat       text not null,
  name_it   text not null,
  name_en   text not null,
  desc_it   text not null default '',
  desc_en   text not null default '',
  price     numeric(8,2) not null check (price >= 0),
  vg        boolean not null default false,       -- vegano (altrimenti vegetariano)
  available boolean not null default true,        -- false = esaurito
  visible   boolean not null default true,        -- false = nascosto dal menu
  sort      int not null default 0
);

alter table public.menu_items drop constraint if exists menu_items_cat_check;
alter table public.menu_items add constraint menu_items_cat_check check (cat in ('tea','pastry','savoury','mocktail','hamper'));

create table if not exists public.services (
  id        text primary key,
  active    boolean not null default true,
  sort      int not null default 0,
  kicker_it text not null default '', kicker_en text not null default '',
  title_it  text not null, title_en text not null,
  body_it   text not null default '', body_en text not null default '',
  price_it  text not null default '', price_en text not null default '',
  cta_it    text not null default 'Richiedi', cta_en text not null default 'Enquire'
);

create table if not exists public.settings (
  key   text primary key,
  value jsonb not null
);

-- ---------- ordini ----------
create table if not exists public.orders (
  id             uuid primary key default gen_random_uuid(),
  day            date not null default ((now() at time zone 'Europe/Rome')::date),
  number         int  not null,
  source         text not null check (source in ('app','counter','floor')),
  customer_name  text not null default '',
  table_label    text,
  pickup_slot    text,
  note           text,
  status         text not null default 'new' check (status in ('new','preparing','ready','served','completed','cancelled')),
  payment_method text check (payment_method in ('cash','card')),
  payment_status text not null default 'unpaid' check (payment_status in ('unpaid','paid')),
  total          numeric(8,2) not null default 0,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (day, number)
);
alter table public.orders add column if not exists stock_done boolean not null default false;  -- scorte già scaricate per questo ordine
create index if not exists orders_created_idx on public.orders (created_at desc);

create table if not exists public.order_items (
  id         bigserial primary key,
  order_id   uuid not null references public.orders(id) on delete cascade,
  item_id    text not null,
  name       text not null,
  cat        text not null,
  qty        int  not null check (qty between 1 and 20),
  unit_price numeric(8,2) not null
);
create index if not exists order_items_order_idx on public.order_items (order_id);

create table if not exists public.staff_roles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role    text not null check (role in ('kitchen','cashier','waiter','owner'))
);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists orders_touch on public.orders;
create trigger orders_touch before update on public.orders for each row execute function public.touch_updated_at();

-- ---------- ruoli ----------
create or replace function public.staff_role() returns text
language sql stable security definer set search_path = public as $$
  select role from public.staff_roles where user_id = auth.uid()
$$;
create or replace function public.is_staff() returns boolean
language sql stable security definer set search_path = public as $$ select public.staff_role() is not null $$;
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$ select public.staff_role() = 'owner' $$;
create or replace function public.is_cashier() returns boolean
language sql stable security definer set search_path = public as $$ select public.staff_role() in ('cashier','owner') $$;
create or replace function public.is_back() returns boolean
language sql stable security definer set search_path = public as $$ select public.staff_role() in ('kitchen','owner') $$;
create or replace function public.can_order() returns boolean
language sql stable security definer set search_path = public as $$ select public.staff_role() in ('waiter','cashier','owner') $$;

-- ---------- creazione ordini: unico punto d'ingresso, prezzi sempre dal server ----------
create or replace function public._create_order(
  p_source text, p_name text, p_slot text, p_table text, p_note text, p_items jsonb
) returns json language plpgsql security definer set search_path = public as $$
declare
  v_id uuid; v_num int; v_day date := (now() at time zone 'Europe/Rome')::date;
  v_total numeric(8,2) := 0; r record; v_m public.menu_items;
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 or jsonb_array_length(p_items) > 30 then
    raise exception 'ordine vuoto o troppo grande';
  end if;
  perform pg_advisory_xact_lock(hashtext('orders-' || v_day::text));
  select coalesce(max(number), 0) + 1 into v_num from public.orders where day = v_day;
  insert into public.orders (day, number, source, customer_name, table_label, pickup_slot, note)
  values (v_day, v_num, p_source,
          left(coalesce(trim(p_name), ''), 60),
          nullif(left(trim(coalesce(p_table, '')), 30), ''),
          nullif(left(trim(coalesce(p_slot, '')), 10), ''),
          nullif(left(trim(coalesce(p_note, '')), 300), ''))
  returning id into v_id;
  for r in select (e->>'item_id') as item_id, (e->>'qty')::int as qty from jsonb_array_elements(p_items) e loop
    select * into v_m from public.menu_items where id = r.item_id and visible;
    if not found then raise exception 'prodotto sconosciuto: %', r.item_id; end if;
    if not v_m.available then raise exception 'prodotto esaurito: %', v_m.name_it; end if;
    if r.qty < 1 or r.qty > 20 then raise exception 'quantita non valida'; end if;
    insert into public.order_items (order_id, item_id, name, cat, qty, unit_price)
      values (v_id, v_m.id, v_m.name_it, v_m.cat, r.qty, v_m.price);
    v_total := v_total + v_m.price * r.qty;
  end loop;
  update public.orders set total = v_total where id = v_id;
  return json_build_object('id', v_id, 'number', v_num);
end $$;
revoke all on function public._create_order(text, text, text, text, text, jsonb) from public, anon, authenticated;

-- Cliente (anonimo): ordine da asporto dall'app
create or replace function public.place_order(p_name text, p_slot text, p_note text, p_items jsonb)
returns json language plpgsql security definer set search_path = public as $$
begin
  if coalesce(trim(p_name), '') = '' then raise exception 'nome mancante'; end if;
  return public._create_order('app', p_name, p_slot, null, p_note, p_items);
end $$;
grant execute on function public.place_order(text, text, text, jsonb) to anon, authenticated;

-- Sala e cassa: ordine al tavolo / al banco. La sala non incassa; p_pay = 'cash' | 'card' | null
drop function if exists public.staff_place_order(text, text, text, jsonb, text);
create or replace function public.staff_place_order(p_name text, p_table text, p_note text, p_items jsonb, p_pay text)
returns json language plpgsql security definer set search_path = public as $$
declare v json; v_role text := public.staff_role();
begin
  if not public.can_order() then raise exception 'non autorizzato'; end if;
  if p_pay is not null and (v_role = 'waiter' or p_pay not in ('cash', 'card')) then raise exception 'pagamento non consentito'; end if;
  v := public._create_order(case when v_role = 'waiter' then 'floor' else 'counter' end, p_name, null, p_table, p_note, p_items);
  if p_pay is not null then
    update public.orders set payment_method = p_pay, payment_status = 'paid' where id = (v->>'id')::uuid;
  end if;
  return v;
end $$;
grant execute on function public.staff_place_order(text, text, text, jsonb, text) to authenticated;

-- Cliente: stato del proprio ordine (l'id è un uuid non indovinabile)
create or replace function public.order_status(p_id uuid)
returns json language sql stable security definer set search_path = public as $$
  select json_build_object('number', number, 'status', status, 'payment_status', payment_status)
  from public.orders where id = p_id
$$;
grant execute on function public.order_status(uuid) to anon, authenticated;

-- ---------- limiti per ruolo ----------
create or replace function public.orders_guard() returns trigger
language plpgsql security definer set search_path = public as $$
declare r text := public.staff_role();
begin
  if r is null then raise exception 'non autorizzato'; end if;
  if r in ('cashier', 'owner') then return new; end if;
  if (new.payment_method, new.payment_status, new.total, new.number, new.source, new.customer_name, new.table_label, new.pickup_slot, new.note)
     is distinct from
     (old.payment_method, old.payment_status, old.total, old.number, old.source, old.customer_name, old.table_label, old.pickup_slot, old.note) then
    raise exception 'non autorizzato';
  end if;
  if r = 'kitchen' and not (old.status in ('new','preparing','ready') and new.status in ('new','preparing','ready')) then
    raise exception 'la cucina gestisce solo le fasi di preparazione';
  end if;
  if r = 'waiter' and not (old.status in ('ready','served') and new.status in ('ready','served','completed')) then
    raise exception 'la sala può solo servire gli ordini pronti';
  end if;
  return new;
end $$;
drop trigger if exists orders_guard_t on public.orders;
create trigger orders_guard_t before update on public.orders for each row execute function public.orders_guard();

create or replace function public.menu_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if public.is_owner() then return new; end if;
  if (new.id, new.cat, new.name_it, new.name_en, new.desc_it, new.desc_en, new.price, new.vg, new.visible, new.sort)
     is distinct from
     (old.id, old.cat, old.name_it, old.name_en, old.desc_it, old.desc_en, old.price, old.vg, old.visible, old.sort) then
    raise exception 'solo la proprietà può modificare il menu';
  end if;
  return new;
end $$;
drop trigger if exists menu_guard_t on public.menu_items;
create trigger menu_guard_t before update on public.menu_items for each row execute function public.menu_guard();

-- ---------- ricettario, scorte, costi ----------
create table if not exists public.ingredients (
  id         text primary key,
  name       text not null,
  unit       text not null check (unit in ('g','ml','pz')),
  pack_qty   numeric(14,3) not null check (pack_qty > 0),   -- quantità per confezione
  pack_price numeric(10,2) not null check (pack_price >= 0), -- prezzo confezione, IVA esclusa
  stock      numeric(14,3) not null default 0,               -- si muove solo con move_stock / set_stock / vendite
  min_stock  numeric(14,3) not null default 0,
  supplier   text
);
create table if not exists public.recipes (
  item_id text primary key references public.menu_items(id) on delete cascade,
  yield   numeric(8,2) not null check (yield > 0),            -- porzioni prodotte dalla ricetta
  lines   jsonb not null default '[]'::jsonb,                  -- [{ingredient_id, qty}] per l'intera ricetta
  notes   text
);
alter table public.recipes add column if not exists method   text;   -- preparazione, un passaggio per riga
alter table public.recipes add column if not exists prep_min int;    -- tempo di preparazione in minuti
create table if not exists public.stock_moves (
  id            bigserial primary key,
  ingredient_id text not null references public.ingredients(id) on delete cascade,
  delta         numeric(14,3) not null,
  reason        text not null check (reason in ('carico','inventario','spreco','vendita')),
  note          text,
  at            timestamptz not null default now(),
  by            uuid default auth.uid()
);
create index if not exists stock_moves_at_idx on public.stock_moves (at desc);
-- spese e margini: solo proprietà (non nelle impostazioni pubbliche)
create table if not exists public.owner_settings (key text primary key, value jsonb not null);

-- La cuoca (cucina) crea ingredienti e prodotti nuovi: il prezzo di acquisto e la pubblicazione restano alla proprietà
create or replace function public.add_ingredient(p_name text, p_unit text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  if p_unit not in ('g','ml','pz') then raise exception 'unita non valida'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'nome mancante'; end if;
  v_id := coalesce(nullif(left(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), 24), ''), 'ing') || '-' || substr(md5(random()::text), 1, 3);
  insert into public.ingredients (id, name, unit, pack_qty, pack_price) values (v_id, left(trim(p_name), 60), p_unit, 1, 0);
  return v_id;
end $$;
grant execute on function public.add_ingredient(text, text) to authenticated;

create or replace function public.create_draft_item(p_name text, p_cat text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  if p_cat not in ('tea','pastry','savoury','mocktail','hamper') then raise exception 'categoria non valida'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'nome mancante'; end if;
  v_id := coalesce(nullif(left(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), 24), ''), 'prodotto') || '-' || substr(md5(random()::text), 1, 3);
  insert into public.menu_items (id, cat, name_it, name_en, price, visible, sort)
  values (v_id, p_cat, left(trim(p_name), 60), left(trim(p_name), 60), 0, false, (select coalesce(max(sort), 0) + 1 from public.menu_items));
  return v_id;
end $$;
grant execute on function public.create_draft_item(text, text) to authenticated;

-- Carico / spreco / inventario: unico modo (oltre alle vendite) per cambiare la giacenza
create or replace function public.move_stock(p_id text, p_delta numeric, p_reason text, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  if p_reason not in ('carico','spreco','inventario') then raise exception 'motivo non valido'; end if;
  update public.ingredients set stock = stock + p_delta where id = p_id;
  if not found then raise exception 'ingrediente sconosciuto'; end if;
  insert into public.stock_moves (ingredient_id, delta, reason, note) values (p_id, p_delta, p_reason, nullif(left(coalesce(p_note,''), 200), ''));
end $$;
grant execute on function public.move_stock(text, numeric, text, text) to authenticated;

create or replace function public.set_stock(p_id text, p_qty numeric, p_note text default null)
returns void language plpgsql security definer set search_path = public as $$
declare v_cur numeric;
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  select stock into v_cur from public.ingredients where id = p_id for update;
  if not found then raise exception 'ingrediente sconosciuto'; end if;
  update public.ingredients set stock = p_qty where id = p_id;
  insert into public.stock_moves (ingredient_id, delta, reason, note) values (p_id, p_qty - v_cur, 'inventario', nullif(left(coalesce(p_note,''), 200), ''));
end $$;
grant execute on function public.set_stock(text, numeric, text) to authenticated;

-- Quando la cucina inizia un ordine, scarica le scorte secondo il ricettario (una sola volta)
create or replace function public.orders_stock() returns trigger
language plpgsql security definer set search_path = public as $$
declare r record;
begin
  if new.status = 'preparing' and not old.stock_done then
    for r in
      select l->>'ingredient_id' as ing, sum((l->>'qty')::numeric / rc.yield * oi.qty) as used
      from public.order_items oi
      join public.recipes rc on rc.item_id = oi.item_id
      cross join lateral jsonb_array_elements(rc.lines) l
      where oi.order_id = new.id
      group by 1
    loop
      update public.ingredients set stock = stock - r.used where id = r.ing;
      if found then
        insert into public.stock_moves (ingredient_id, delta, reason, note) values (r.ing, -r.used, 'vendita', 'Ordine ' || new.number);
      end if;
    end loop;
    new.stock_done := true;
  end if;
  return new;
end $$;
drop trigger if exists orders_stock_t on public.orders;
create trigger orders_stock_t before update on public.orders for each row execute function public.orders_stock();

-- ---------- sicurezza a livello di riga ----------
alter table public.menu_items  enable row level security;
alter table public.services    enable row level security;
alter table public.settings    enable row level security;
alter table public.orders      enable row level security;
alter table public.order_items enable row level security;
alter table public.staff_roles enable row level security;
alter table public.ingredients enable row level security;
alter table public.recipes enable row level security;
alter table public.stock_moves enable row level security;
alter table public.owner_settings enable row level security;

revoke all on public.orders, public.order_items, public.staff_roles, public.menu_items, public.services, public.settings from anon, authenticated;
grant select on public.menu_items, public.services, public.settings to anon, authenticated;
grant insert, update, delete on public.menu_items, public.services, public.settings to authenticated;
grant select on public.orders, public.order_items to authenticated;
grant update (status, payment_method, payment_status) on public.orders to authenticated;
grant select on public.staff_roles to authenticated;
revoke all on public.ingredients, public.recipes, public.stock_moves, public.owner_settings from anon, authenticated;
grant select on public.ingredients, public.recipes, public.stock_moves to authenticated;
grant insert (id, name, unit, pack_qty, pack_price, min_stock, supplier), update (name, unit, pack_qty, pack_price, min_stock, supplier) on public.ingredients to authenticated;
grant delete on public.ingredients to authenticated;
grant insert, update, delete on public.recipes to authenticated;
grant select, insert, update on public.owner_settings to authenticated;

drop policy if exists menu_read on public.menu_items;
create policy menu_read on public.menu_items for select using (visible or public.is_staff());
drop policy if exists menu_staff_update on public.menu_items;
create policy menu_staff_update on public.menu_items for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists menu_owner_insert on public.menu_items;
create policy menu_owner_insert on public.menu_items for insert to authenticated with check (public.is_owner());
drop policy if exists menu_owner_delete on public.menu_items;
create policy menu_owner_delete on public.menu_items for delete to authenticated using (public.is_owner());

drop policy if exists services_read on public.services;
create policy services_read on public.services for select using (active or public.is_staff());
drop policy if exists services_owner on public.services;
create policy services_owner on public.services for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists settings_read on public.settings;
create policy settings_read on public.settings for select using (true);
drop policy if exists settings_owner on public.settings;
create policy settings_owner on public.settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

drop policy if exists orders_staff_read on public.orders;
create policy orders_staff_read on public.orders for select to authenticated using (public.is_staff());
drop policy if exists orders_staff_update on public.orders;
create policy orders_staff_update on public.orders for update to authenticated using (public.is_staff()) with check (public.is_staff());
drop policy if exists items_staff_read on public.order_items;
create policy items_staff_read on public.order_items for select to authenticated using (public.is_staff());
drop policy if exists roles_self_read on public.staff_roles;
create policy roles_self_read on public.staff_roles for select to authenticated using (user_id = auth.uid());

drop policy if exists ing_read on public.ingredients;
create policy ing_read on public.ingredients for select to authenticated using (public.is_back());
drop policy if exists ing_owner on public.ingredients;
create policy ing_owner on public.ingredients for all to authenticated using (public.is_owner()) with check (public.is_owner());
drop policy if exists rec_read on public.recipes;
create policy rec_read on public.recipes for select to authenticated using (public.is_back());
drop policy if exists rec_owner on public.recipes;
drop policy if exists rec_back_write on public.recipes;
create policy rec_back_write on public.recipes for all to authenticated using (public.is_back()) with check (public.is_back());  -- la cuoca scrive le ricette
drop policy if exists moves_read on public.stock_moves;
create policy moves_read on public.stock_moves for select to authenticated using (public.is_back());
drop policy if exists osettings_owner on public.owner_settings;
create policy osettings_owner on public.owner_settings for all to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---------- tempo reale ----------
do $$
declare t text;
begin
  foreach t in array array['orders', 'order_items', 'menu_items', 'services', 'settings', 'ingredients', 'recipes'] loop
    begin
      execute format('alter publication supabase_realtime add table public.%I', t);
    exception when duplicate_object then null;
    end;
  end loop;
end $$;

-- ---------- dati iniziali (non sovrascrivono modifiche già fatte) ----------
insert into public.menu_items (id, cat, name_it, name_en, desc_it, desc_en, price, vg, sort) values
  ('blend', 'tea', 'Lady Bedford Blend', 'Lady Bedford Blend', 'Miscela della casa: Assam, Ceylon e un velo di bergamotto.', 'House blend: Assam, Ceylon and a whisper of bergamot.', 6.5, true, 0),
  ('earl', 'tea', 'Earl Grey alla crema', 'Cream Earl Grey', 'Con latte d’avena montato e fiordaliso.', 'With steamed oat milk and cornflower.', 6, true, 1),
  ('darj', 'tea', 'Darjeeling First Flush', 'Darjeeling First Flush', 'Raccolto di primavera, note di moscato.', 'Spring harvest, muscatel notes.', 7, true, 2),
  ('rooi', 'tea', 'Rooibos alla vaniglia', 'Vanilla Rooibos', 'Senza teina, per la sera.', 'Caffeine-free, for the evening.', 5.5, true, 3),
  ('scone', 'pastry', 'Scone della cuoca', 'Cook’s scone', 'Con crema di anacardi e confettura di fragole.', 'With cashew cream and strawberry jam.', 4.5, true, 4),
  ('sponge', 'pastry', 'Victoria sponge', 'Victoria sponge', 'Pan di Spagna, lamponi e crema al burro.', 'Sponge, raspberries and buttercream.', 5.5, false, 5),
  ('lemon', 'pastry', 'Lemon drizzle', 'Lemon drizzle', 'Torta al limone con glassa croccante.', 'Lemon loaf with a crackling glaze.', 5, true, 6),
  ('short', 'pastry', 'Shortbread', 'Shortbread', 'Biscotti di frolla al burro, tre pezzi.', 'Butter shortbread, three pieces.', 3.5, false, 7),
  ('cucu', 'savoury', 'Tramezzini al cetriolo', 'Cucumber sandwiches', 'Cetriolo, aneto e formaggio vegetale.', 'Cucumber, dill and plant-based cheese.', 6, true, 8),
  ('rare', 'savoury', 'Welsh rarebit', 'Welsh rarebit', 'Pane tostato con cheddar fuso e senape.', 'Toast with melted cheddar and mustard.', 8, false, 9),
  ('pie', 'savoury', 'Pasticcio di funghi e porri', 'Mushroom & leek pie', 'Pasta brisée vegetale, timo del giardino.', 'Plant-based shortcrust, garden thyme.', 9, true, 10),
  ('garden', 'mocktail', 'Bedford Garden', 'Bedford Garden', 'Cetriolo, menta e lime con acqua tonica.', 'Cucumber, mint and lime with tonic water.', 7.5, true, 13),
  ('hibiscus', 'mocktail', 'Hibiscus Sour', 'Hibiscus Sour', 'Infuso freddo di ibisco, limone e sciroppo di agave.', 'Cold hibiscus infusion, lemon and agave syrup.', 7.5, true, 14),
  ('rosa', 'mocktail', 'Rosa e Lampone', 'Rose & Raspberry', 'Lamponi pestati, acqua di rose e soda.', 'Muddled raspberries, rosewater and soda.', 7.5, true, 15),
  ('earlfizz', 'mocktail', 'Earl Grey Fizz', 'Earl Grey Fizz', 'Earl Grey freddo, limone, zucchero di canna e bollicine.', 'Iced Earl Grey, lemon, cane sugar and bubbles.', 7, true, 16),
  ('picnic', 'hamper', 'Cestino per due', 'Hamper for two', 'Tè sfuso, 2 scone, tramezzini, 2 dolci a scelta della cuoca.', 'Loose tea, 2 scones, sandwiches, 2 cakes chosen by Cook.', 32, true, 11),
  ('gift', 'hamper', 'Latta regalo', 'Gift tin', 'Miscela Lady Bedford’s 100 g e shortbread vegano.', 'Lady Bedford Blend 100 g and vegan shortbread.', 24, true, 12)
on conflict (id) do nothing;

insert into public.services (id, sort, kicker_it, kicker_en, title_it, title_en, body_it, body_en, price_it, price_en, cta_it, cta_en) values
  ('tea', 0, 'Ogni pomeriggio', 'Every afternoon', 'Afternoon tea in salotto', 'Afternoon tea in the drawing room', 'Alzatina a tre piani con tramezzini, scone e dolci della cuoca, e tè a volontà dalla dispensa di Lord Edward.', 'A three-tier stand of sandwiches, scones and Cook’s cakes, with endless tea from Lord Edward’s pantry.', '€ 28 a persona', '€ 28 per person', 'Riserva', 'Reserve'),
  ('party', 1, 'Su richiesta', 'On request', 'Ricevimenti privati', 'Private receptions', 'Compleanni, fidanzamenti, baby shower: la casa intera, fino a 24 ospiti, con servizio del maggiordomo.', 'Birthdays, engagements, baby showers: the whole house, up to 24 guests, with the butler in attendance.', 'Da € 45 a persona', 'From € 45 per person', 'Richiedi', 'Enquire'),
  ('class', 2, 'Il sabato mattina', 'Saturday mornings', 'Lezioni di tè', 'Tea lessons', 'Un’ora con la padrona di casa tra foglie, temperature e porcellane. Degustazione di cinque tè inclusa.', 'An hour with the lady of the house among leaves, temperatures and porcelain. Tasting of five teas included.', '€ 35 a persona', '€ 35 per person', 'Riserva', 'Reserve'),
  ('gift', 3, 'Da regalare', 'To give', 'Buono ospite', 'Guest voucher', 'Un invito su carta di cotone, sigillato a ceralacca, per un afternoon tea a casa Bedford.', 'An invitation on cotton paper, sealed with wax, for an afternoon tea at the Bedford house.', 'Da € 30', 'From € 30', 'Richiedi', 'Enquire')
on conflict (id) do nothing;

insert into public.settings (key, value) values ('main', '{"open_days":[2,3,4,5,6,0],"open_time":"11:00","close_time":"19:00","slots":["16:00","16:30","17:00","17:30","18:00","18:30"],"featured":["darj","scone","cucu"],"butler":{"it":"Oggi la signora consiglia il Darjeeling First Flush, con uno scone ancora tiepido.","en":"Today her Ladyship recommends the Darjeeling First Flush, with a scone still warm."},"tables":12}'::jsonb)
on conflict (key) do nothing;
