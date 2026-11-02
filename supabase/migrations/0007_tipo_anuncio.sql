-- Tipo de anúncio escolhido para cada item aprovado: Clássico, Premium ou os dois (tela Aprovados).
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
alter table public.anotacoes add column if not exists tipo_anuncio text
  check (tipo_anuncio is null or tipo_anuncio in ('classico', 'premium', 'ambos'));
