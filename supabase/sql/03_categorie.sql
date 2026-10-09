-- Lady Bedford's — AGGIORNAMENTO 3: categorie del menu libere (aggiungi, rinomina, elimina dall'app).
-- Eseguilo una volta nel SQL Editor di Supabase. Si può rieseguire senza danni.
alter table public.menu_items drop constraint if exists menu_items_cat_check;

create or replace function public.create_draft_item(p_name text, p_cat text) returns text
language plpgsql security definer set search_path = public as $$
declare v_id text;
begin
  if not public.is_back() then raise exception 'non autorizzato'; end if;
  if coalesce(trim(p_cat), '') = '' or length(p_cat) > 40 then raise exception 'categoria non valida'; end if;
  if coalesce(trim(p_name), '') = '' then raise exception 'nome mancante'; end if;
  v_id := coalesce(nullif(left(regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'), 24), ''), 'prodotto') || '-' || substr(md5(random()::text), 1, 3);
  insert into public.menu_items (id, cat, name_it, name_en, price, visible, sort)
  values (v_id, p_cat, left(trim(p_name), 60), left(trim(p_name), 60), 0, false, (select coalesce(max(sort), 0) + 1 from public.menu_items));
  return v_id;
end $$;
grant execute on function public.create_draft_item(text, text) to authenticated;
