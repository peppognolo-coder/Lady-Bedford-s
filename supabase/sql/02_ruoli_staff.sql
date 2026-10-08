-- Lady Bedford's — FILE 2 DI 2: assegna i ruoli ai quattro utenti staff.
-- Eseguilo SOLO DOPO aver creato i 4 utenti in Authentication → Users (vedi README).
-- Si può rieseguire senza danni.
insert into public.staff_roles (user_id, role)
select id, split_part(email, '@', 1) from auth.users
where email in ('kitchen@staff.ladybedford.app','cashier@staff.ladybedford.app','waiter@staff.ladybedford.app','owner@staff.ladybedford.app')
on conflict (user_id) do update set role = excluded.role;

-- Verifica: devono comparire 4 righe (kitchen, cashier, waiter, owner)
select r.role, u.email from public.staff_roles r join auth.users u on u.id = r.user_id order by r.role;
