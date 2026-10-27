-- Qual peso entra na tabela de frete do ML: só o peso do produto ('real') ou o maior entre real e cúbico ('cubico').
alter table public.configuracoes
  add column if not exists peso_frete_modo text not null default 'real' check (peso_frete_modo in ('real', 'cubico'));
