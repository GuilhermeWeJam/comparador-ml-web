-- Comparador ML Web — os 2 e-mails Google que podem entrar no sistema.
-- 1. Troque os dois e-mails abaixo pelos de vocês (contas Google, em minúsculas).
-- 2. Rode no SQL Editor do Supabase.
-- O banco recusa um terceiro e-mail. Para trocar alguém: delete from public.admins where email = '...';

insert into public.admins (email, nome) values
  ('seu-email@gmail.com', 'Você'),
  ('email-do-socio@gmail.com', 'Sócio')
on conflict (email) do nothing;
