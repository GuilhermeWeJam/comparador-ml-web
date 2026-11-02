-- Remove a opção "Os dois" do tipo de anúncio: só Clássico ou Premium.
-- Itens que estavam como "ambos" voltam a "não escolhido" (null) para serem escolhidos de novo.
-- Rode uma vez no SQL Editor do Supabase. Pode rodar de novo sem problema.
alter table public.anotacoes drop constraint if exists anotacoes_tipo_anuncio_check;
update public.anotacoes set tipo_anuncio = null where tipo_anuncio = 'ambos';
alter table public.anotacoes add constraint anotacoes_tipo_anuncio_check
  check (tipo_anuncio is null or tipo_anuncio in ('classico', 'premium'));
