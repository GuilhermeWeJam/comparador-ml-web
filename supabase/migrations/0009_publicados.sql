-- Publicados: quando o item aprovado foi marcado como publicado no ML e com que preço foi anunciado.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
alter table public.anotacoes
  add column if not exists publicado_em timestamptz,
  add column if not exists preco_publicado numeric check (preco_publicado is null or preco_publicado > 0);
