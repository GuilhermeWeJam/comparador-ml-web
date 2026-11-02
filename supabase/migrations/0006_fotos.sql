-- Links das fotos de cada item, para subir no Mercado Livre (tela Aprovados).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
alter table public.anotacoes add column if not exists fotos text;
