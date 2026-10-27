-- Comparador ML Web — estrutura do banco (rode uma vez no SQL Editor do Supabase).
-- Tabelas, regras de acesso (só os 2 admins), views, arquivos e tempo real.

set client_min_messages = warning;
create extension if not exists pgcrypto;

-- ============ quem pode entrar ============
create table if not exists public.admins (
  email text primary key,
  nome text,
  criado_em timestamptz not null default now()
);

-- no máximo 2 admins
create or replace function public.limitar_admins() returns trigger
language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  if not exists (select 1 from public.admins where email = new.email)
     and (select count(*) from public.admins) >= 2 then
    raise exception 'O sistema aceita no máximo 2 admins.';
  end if;
  return new;
end $$;
drop trigger if exists admins_limite on public.admins;
create trigger admins_limite before insert on public.admins for each row execute function public.limitar_admins();

-- o e-mail logado está na lista de admins?
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where email = lower(coalesce(auth.jwt() ->> 'email', '')));
$$;
grant execute on function public.eh_admin() to anon, authenticated;

-- e-mail de quem está logado (para as colunas "criado_por")
create or replace function public.email_atual() returns text
language sql stable as $$ select auth.jwt() ->> 'email' $$;

-- ============ configurações ============
create table if not exists public.configuracoes (
  id int primary key default 1 check (id = 1),
  margem_desejada numeric not null default 0.20,
  margem_minima numeric not null default 0.10,
  imposto numeric not null default 0.05,
  reserva numeric not null default 0.03,
  ads numeric not null default 0.08,
  tipo_anuncio_padrao text not null default 'classico' check (tipo_anuncio_padrao in ('classico', 'premium')),
  ocultar_acima_do_lado boolean not null default true,
  lado_max_cm numeric not null default 70,
  validade_pesquisa_dias int not null default 30,
  pesos jsonb not null default '{}'::jsonb,
  atualizado_por text default public.email_atual(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.comissoes_ml (
  categoria_ml text primary key,
  classico numeric not null check (classico >= 0 and classico < 1),
  premium numeric not null check (premium >= 0 and premium < 1),
  padrao boolean not null default false
);

create table if not exists public.categorias (
  nome text primary key,
  categoria_ml text references public.comissoes_ml (categoria_ml) on update cascade on delete set null,
  epoca text not null default 'normal' check (epoca in ('alta', 'normal', 'baixa'))
);

create table if not exists public.tabela_frete (
  id int primary key default 1 check (id = 1),
  versao text not null,
  fonte text,
  preco_ini numeric[] not null,
  peso_ini numeric[] not null,
  valores jsonb not null,
  atualizado_em timestamptz not null default now()
);

-- ============ produtos e importações ============
create table if not exists public.importacoes (
  id uuid primary key default gen_random_uuid(),
  arquivo text,
  nome_arquivo text,
  total int,
  disponiveis int,
  resumo jsonb,
  criado_por text default public.email_atual(),
  criado_em timestamptz not null default now()
);

create table if not exists public.produtos (
  sku text primary key,
  nome text not null,
  marca text not null default '',
  categoria text not null default '',
  fornecedor text not null default '',
  uf text not null default '',
  disponivel boolean not null default true,
  na_planilha boolean not null default true,
  origem text not null default 'planilha' check (origem in ('planilha', 'manual')),
  ativo boolean not null default true,
  custo numeric not null check (custo > 0),
  custo_anterior numeric,
  custo_mudou_importacao uuid references public.importacoes (id) on delete set null,
  peso_kg numeric,
  peso_caixa_kg numeric,
  largura_cm numeric,
  altura_cm numeric,
  comprimento_cm numeric,
  ean text not null default '',
  ncm text not null default '',
  cest text not null default '',
  imagem_url text not null default '',
  importacao_id uuid references public.importacoes (id) on delete set null,
  primeira_importacao_id uuid references public.importacoes (id) on delete set null,
  criado_por text default public.email_atual(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists produtos_listaveis on public.produtos (disponivel, origem, ativo);

create or replace function public.tocar_atualizado() returns trigger
language plpgsql as $$
begin
  new.atualizado_em := now();
  return new;
end $$;
drop trigger if exists produtos_atualizado on public.produtos;
create trigger produtos_atualizado before update on public.produtos for each row execute function public.tocar_atualizado();
drop trigger if exists configuracoes_atualizado on public.configuracoes;
create trigger configuracoes_atualizado before update on public.configuracoes for each row execute function public.tocar_atualizado();

-- ============ pesquisa, decisão e anotações (por item: "SKU" ou "SKU::kitN") ============
create table if not exists public.pesquisas (
  id bigint generated always as identity primary key,
  item_id text not null,
  nao_encontrado boolean not null default false,
  menor_preco numeric,
  preco_mais_vendido numeric,
  vendidos_mais_vendido int,
  concorrentes text check (concorrentes in ('1-3', '4-10', '10+')),
  tem_full boolean,
  tem_oficial boolean,
  qtd_no_anuncio int check (qtd_no_anuncio is null or qtd_no_anuncio > 0),
  link text not null default '',
  observacao text not null default '',
  origem text not null default 'manual' check (origem in ('manual', 'plugin')),
  segundos_gastos int,
  criado_por text default public.email_atual(),
  criado_em timestamptz not null default now(),
  check (nao_encontrado or menor_preco > 0)
);
create index if not exists pesquisas_item on public.pesquisas (item_id, criado_em desc);

create table if not exists public.decisoes (
  id bigint generated always as identity primary key,
  item_id text not null,
  decisao text not null check (decisao in ('aprovado', 'reprovado', 'adiado', 'desfeita')),
  motivo text not null default '',
  motivo_detalhe text not null default '',
  revisar_em date,
  custo_momento numeric,
  nota_triagem_momento numeric,
  nota_decisao_momento numeric,
  veredito_momento text,
  criado_por text default public.email_atual(),
  criado_em timestamptz not null default now()
);
create index if not exists decisoes_item on public.decisoes (item_id, criado_em desc);

create table if not exists public.anotacoes (
  item_id text primary key,
  potencial boolean not null default false,
  titulo text,
  kit_qtd int check (kit_qtd is null or kit_qtd between 2 and 6),
  kit_montado boolean not null default false,
  atualizado_por text default public.email_atual(),
  atualizado_em timestamptz not null default now()
);
drop trigger if exists anotacoes_atualizado on public.anotacoes;
create trigger anotacoes_atualizado before update on public.anotacoes for each row execute function public.tocar_atualizado();

-- última pesquisa e última decisão de cada item (respeitam as regras de acesso de quem consulta)
create or replace view public.pesquisa_atual with (security_invoker = true) as
  select distinct on (item_id) * from public.pesquisas order by item_id, criado_em desc, id desc;
create or replace view public.decisao_atual with (security_invoker = true) as
  select distinct on (item_id) * from public.decisoes order by item_id, criado_em desc, id desc;

-- ============ regras de acesso (RLS): só os admins leem e gravam ============
do $$
declare t text;
begin
  foreach t in array array['configuracoes', 'comissoes_ml', 'categorias', 'tabela_frete', 'importacoes', 'produtos', 'pesquisas', 'decisoes', 'anotacoes']
  loop
    execute format('alter table public.%I enable row level security', t);
    execute format('drop policy if exists "so admins" on public.%I', t);
    execute format('create policy "so admins" on public.%I for all to authenticated using (public.eh_admin()) with check (public.eh_admin())', t);
  end loop;
end $$;

-- a lista de admins: os admins podem ver; mudar, só pelo painel do Supabase
alter table public.admins enable row level security;
drop policy if exists "admins veem" on public.admins;
create policy "admins veem" on public.admins for select to authenticated using (public.eh_admin());

grant usage on schema public to authenticated;
grant select, insert, update, delete on public.configuracoes, public.comissoes_ml, public.categorias, public.tabela_frete,
  public.importacoes, public.produtos, public.pesquisas, public.decisoes, public.anotacoes to authenticated;
grant select on public.admins, public.pesquisa_atual, public.decisao_atual to authenticated;
grant usage, select on all sequences in schema public to authenticated;
revoke all on public.admins from anon;

-- ============ arquivos: planilhas originais (bucket privado) ============
insert into storage.buckets (id, name, public) values ('planilhas', 'planilhas', false) on conflict (id) do nothing;
drop policy if exists "planilhas: admins leem" on storage.objects;
drop policy if exists "planilhas: admins gravam" on storage.objects;
drop policy if exists "planilhas: admins apagam" on storage.objects;
create policy "planilhas: admins leem" on storage.objects for select to authenticated using (bucket_id = 'planilhas' and public.eh_admin());
create policy "planilhas: admins gravam" on storage.objects for insert to authenticated with check (bucket_id = 'planilhas' and public.eh_admin());
create policy "planilhas: admins apagam" on storage.objects for delete to authenticated using (bucket_id = 'planilhas' and public.eh_admin());

-- ============ tempo real: o que um sócio grava aparece para o outro ============
do $$
declare t text;
begin
  foreach t in array array['produtos', 'pesquisas', 'decisoes', 'anotacoes', 'configuracoes', 'categorias', 'comissoes_ml']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;

-- ============ consulta leve usada pela rotina que evita a pausa do projeto ============
create or replace function public.manter_ativo() returns text
language sql stable as $$ select 'ok' $$;
grant execute on function public.manter_ativo() to anon;
