-- Preço de venda editado à mão, por item (Clássico e Premium). Nulo = usa o preço calculado pela margem desejada.
alter table public.anotacoes
  add column if not exists preco_classico numeric check (preco_classico is null or preco_classico > 0),
  add column if not exists preco_premium numeric check (preco_premium is null or preco_premium > 0);
