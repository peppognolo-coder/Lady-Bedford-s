-- Lady Bedford's — AGGIORNAMENTO 5: documenti HACCP (piano di autocontrollo, procedure, schede, rapporti).
-- Eseguilo una volta nel SQL Editor di Supabase, dopo 04_haccp.sql. Si può rieseguire senza danni.
--
--  * I file stanno in un archivio PRIVATO (bucket 'haccp-docs'): si aprono solo con un link temporaneo.
--  * Cucina e proprietà (is_back) leggono; solo la proprietà carica. Niente cancellazioni: un documento superato si archivia.
--  * Ogni modifica finisce nel registro modifiche HACCP (haccp_audit_log).

create table if not exists public.haccp_documents (
  id         uuid primary key default gen_random_uuid(),
  title      text not null check (length(trim(title)) between 1 and 120),
  category   text not null default 'altro' check (category in ('piano','procedura','scheda','rapporto','altro')),
  revision   text check (revision is null or length(revision) <= 20),
  doc_date   date,
  file_path  text not null unique check (length(file_path) <= 200),
  file_name  text not null check (length(file_name) <= 200),
  mime       text not null check (mime in ('application/pdf','image/jpeg','image/png','image/webp')),
  size       integer not null check (size > 0 and size <= 10485760),
  active     boolean not null default true,
  created_at timestamptz not null default now()
);
create index if not exists haccp_documents_active_idx on public.haccp_documents (active, category, title);

drop trigger if exists haccp_documents_audit on public.haccp_documents;
create trigger haccp_documents_audit after insert or update or delete on public.haccp_documents
  for each row execute function public.haccp_audit();

alter table public.haccp_documents enable row level security;
revoke all on public.haccp_documents from anon, authenticated;
grant select, insert, update on public.haccp_documents to authenticated;
drop policy if exists haccp_documents_read on public.haccp_documents;
create policy haccp_documents_read on public.haccp_documents for select to authenticated using (public.is_back());
drop policy if exists haccp_documents_ins on public.haccp_documents;
create policy haccp_documents_ins on public.haccp_documents for insert to authenticated with check (public.is_owner());
drop policy if exists haccp_documents_upd on public.haccp_documents;
create policy haccp_documents_upd on public.haccp_documents for update to authenticated using (public.is_owner()) with check (public.is_owner());

-- ---------- archivio file privato ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('haccp-docs', 'haccp-docs', false, 10485760, array['application/pdf','image/jpeg','image/png','image/webp'])
on conflict (id) do update set public = false, file_size_limit = 10485760, allowed_mime_types = array['application/pdf','image/jpeg','image/png','image/webp'];

drop policy if exists haccp_docs_read on storage.objects;
create policy haccp_docs_read on storage.objects for select to authenticated using (bucket_id = 'haccp-docs' and public.is_back());
drop policy if exists haccp_docs_insert on storage.objects;
create policy haccp_docs_insert on storage.objects for insert to authenticated with check (bucket_id = 'haccp-docs' and public.is_owner());

-- realtime: la cucina vede subito i documenti nuovi
do $$ begin
  begin alter publication supabase_realtime add table public.haccp_documents; exception when duplicate_object then null; end;
end $$;
