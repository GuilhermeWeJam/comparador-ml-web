# Comparador ML Web — etapa 1 (sistema web)

Sistema para escolher quais produtos do fornecedor anunciar no Mercado Livre. Ele importa a planilha do fornecedor,
calcula preço Clássico e Premium, frete e comissão por categoria, dá a nota de triagem, guia a pesquisa do concorrente,
sugere o veredito e registra a decisão de vocês dois.

Feito com React + Vite + Tailwind, Supabase (banco, login Google e arquivos) e GitHub Pages. Tudo no plano gratuito.

---

## O que tem nesta pasta

| Pasta / arquivo | Para que serve |
| --- | --- |
| `src/nucleo/` | Cálculos (frete, preço, kits, título, alertas, notas, veredito) e leitura/escrita de .xlsx. Sem React: o plugin da etapa 2 vai usar o mesmo código. |
| `src/nucleo/__testes__/` | Testes automáticos, inclusive a paridade com a planilha (os 1.572 produtos dão o mesmo preço e lucro do plugin 1.5.1). |
| `src/dados/` | Conexão com o Supabase, importação da planilha, cálculo das linhas da lista. |
| `src/paginas/`, `src/componentes/` | As telas. |
| `supabase/migrations/` | Os 3 arquivos SQL que criam o banco (passo 2). |
| `.github/workflows/` | Publicar o site, manter o Supabase ativo e backup semanal. |

---

## Passo a passo da configuração

Leva cerca de 40 minutos na primeira vez. Siga na ordem.

### 1. Criar o projeto no Supabase

1. Entre em [supabase.com](https://supabase.com) com a sua conta (pode ser com o GitHub) e clique em **New project**.
2. Preencha:
   - **Name:** `comparador-ml`
   - **Database Password:** clique em **Generate a password** e **guarde essa senha** (vai precisar no passo 8).
   - **Region:** South America (São Paulo).
   - **Plano:** Free.
3. Clique em **Create new project** e espere uns 2 minutos até o painel abrir.

### 2. Criar o banco (3 arquivos SQL)

1. No menu da esquerda, abra **SQL Editor** e clique em **New query**.
2. Abra o arquivo `supabase/migrations/0001_estrutura.sql` num editor de texto, copie **tudo**, cole no SQL Editor e clique em **Run**.
   Deve aparecer "Success. No rows returned".
3. Faça o mesmo com `supabase/migrations/0002_dados_iniciais.sql` (comissões, as 61 categorias com a ligação e a época, tabela de frete e configurações).
4. Abra `supabase/migrations/0003_admins.sql` e **troque os dois e-mails** pelos e-mails Google de vocês dois (em minúsculas). Cole no SQL Editor e rode.
   - O banco aceita no máximo 2 e-mails. Qualquer outra conta Google até consegue fazer login, mas não vê nenhum dado.
5. Confira: em **Table Editor**, a tabela `categorias` deve ter 61 linhas e `admins` 2 linhas.

> Os 3 arquivos podem ser rodados de novo sem estragar nada.

### 3. Pegar o endereço e a chave pública do Supabase

1. Abra **Project Settings → API Keys** (ou o botão **Connect** no topo do painel).
2. Copie:
   - o **Project URL** (algo como `https://abcdefghijkl.supabase.co`);
   - a **chave pública**: a **Publishable key** (começa com `sb_publishable_`). Em projetos mais antigos, aparece como **anon public**; qualquer uma das duas serve.
3. **Nunca** use a chave **secret** / **service_role** no site.

Essas duas informações são públicas por natureza (vão para o navegador). A proteção dos dados vem das regras do banco: só os 2 e-mails autorizados leem e gravam.

### 4. Ligar o login com Google

**No Google Cloud** ([console.cloud.google.com](https://console.cloud.google.com)):

1. Crie um projeto (ex.: `comparador-ml`).
2. Vá em **APIs e serviços → Google Auth Platform** (ou **Tela de consentimento OAuth**):
   - **Branding:** nome do app `Comparador ML` e o seu e-mail de suporte.
   - **Público (Audience):** tipo **Externo**. Enquanto o app estiver em **Teste**, adicione os 2 e-mails de vocês em **Usuários de teste**. Só eles conseguem entrar, e é isso que queremos.
   - **Acesso a dados (Scopes):** adicione `openid` (e-mail e perfil já vêm por padrão).
3. Vá em **Clientes → Criar cliente → Aplicativo da Web**:
   - **Origens JavaScript autorizadas:** `https://SEU-USUARIO.github.io` (e `http://localhost:5173` se for rodar no seu computador).
   - **URIs de redirecionamento autorizados:** a URL de callback que aparece no Supabase em **Authentication → Providers → Google** (algo como `https://abcdefghijkl.supabase.co/auth/v1/callback`).
4. Clique em **Criar** e copie o **ID do cliente** e a **Chave secreta do cliente**.

**No Supabase:**

5. **Authentication → Providers → Google:** ligue, cole o ID e a chave secreta do cliente e salve.
6. **Authentication → URL Configuration:**
   - **Site URL:** `https://SEU-USUARIO.github.io/comparador-ml-web/`
   - **Redirect URLs:** adicione `https://SEU-USUARIO.github.io/comparador-ml-web/` e, se for rodar local, `http://localhost:5173/`.

> Troque `SEU-USUARIO` pelo seu usuário do GitHub e `comparador-ml-web` pelo nome do repositório, se for outro.

### 5. Criar o repositório no GitHub

1. Em [github.com/new](https://github.com/new), crie o repositório `comparador-ml-web`, **público** (o GitHub Pages gratuito exige repositório público).
2. Envie todos os arquivos desta pasta para a branch `main`. Pelo terminal, de dentro da pasta:
   ```bash
   git init
   git add .
   git commit -m "Comparador ML Web"
   git branch -M main
   git remote add origin https://github.com/SEU-USUARIO/comparador-ml-web.git
   git push -u origin main
   ```
   (Ou arraste os arquivos em **Add file → Upload files**; inclua a pasta `.github`.)

### 6. Configurar o GitHub Pages

1. No repositório: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
2. **Settings → Secrets and variables → Actions → aba Variables → New repository variable**. Crie duas:
   - `VITE_SUPABASE_URL` = o Project URL do passo 3;
   - `VITE_SUPABASE_ANON_KEY` = a chave pública do passo 3.
3. Vá em **Actions → Publicar site → Run workflow** (ou faça qualquer novo push).
   Em 2 a 3 minutos o site fica no ar em `https://SEU-USUARIO.github.io/comparador-ml-web/`.

### 7. Primeiro acesso

1. Abra o site e clique em **Entrar com Google** com um dos 2 e-mails.
2. Sem produtos, o site abre direto em **Importar**: arraste a planilha do fornecedor (aba Produtos, 17 colunas).
3. Confira o resumo e clique em **Gravar importação**. Pronto: a lista de Produtos abre, ordenada pela nota de triagem.

### 8. Rotinas automáticas (recomendado)

- **Manter ativo:** o Supabase gratuito pausa o projeto depois de 1 semana sem uso. A rotina **Manter Supabase ativo** faz uma consulta a cada 3 dias. Ela usa as mesmas variáveis do passo 6; não precisa fazer nada.
  - Atenção: o GitHub desliga rotinas agendadas de repositórios sem nenhuma atividade por 60 dias. Se isso acontecer, ele avisa por e-mail; basta reativar em **Actions**.
  - Se o projeto pausar mesmo assim, entre no painel do Supabase e clique em **Restore project**. Nada se perde.
- **Backup semanal:** a rotina **Backup semanal** copia o banco toda segunda-feira e guarda por 90 dias (em **Actions → execução → Artifacts**). Para ligar:
  1. No Supabase, clique em **Connect** e copie a string do **Session pooler** (começa com `postgresql://postgres.`); troque `[YOUR-PASSWORD]` pela senha do passo 1.
  2. No GitHub: **Settings → Secrets and variables → Actions → aba Secrets → New repository secret**, nome `SUPABASE_DB_URL`, valor = essa string.
  - Esta é a única informação sensível do projeto; por isso vai em **Secrets**, nunca em Variables nem no código.

---

## Rodar no seu computador (opcional)

Precisa do Node.js 22 ou mais novo.

```bash
npm install
cp .env.example .env.local     # e preencha as duas linhas
npm run dev                    # abre em http://localhost:5173
npm test                       # testes do cálculo
npm run typecheck              # confere os tipos
```

---

## Tarefas do dia a dia

| Quero… | Onde |
| --- | --- |
| Importar planilha nova do fornecedor | **Importar**. O resumo mostra o que mudou antes de gravar; pesquisas, decisões e produtos manuais são mantidos. |
| Ajustar margem, imposto, regra de 70 cm | **Configurações → Premissas e regra de tamanho** |
| Mudar comissão de uma categoria | **Configurações → Comissões** e **Categorias do fornecedor** |
| Marcar a época (Natal, verão) | **Configurações → Categorias do fornecedor → Época** |
| Ajustar os pesos das notas | **Configurações → Pesos das notas** |
| Atualizar a tabela de frete do ML | **Configurações → Tabela de frete → Ver e editar** |
| Trocar um dos 2 e-mails | No Supabase, **Table Editor → admins**: apague a linha antiga e insira a nova (máximo 2). Lembre de pôr o e-mail novo também em **Usuários de teste** no Google. |
| Mandar uma seleção ao sócio | Filtre a lista e copie o endereço do navegador: os filtros vão no link. |
| Exportar para cadastrar anúncios | **Produtos → Exportar → Aprovados (.xlsx)** |

**Atalhos da fila de pesquisa:** Enter salva e mostra o resultado; Enter de novo passa ao próximo;
"n" no campo de menor preço vazio marca "não encontrei"; Esc pula.

---

## Diferenças em relação ao documento de requisitos

- **Ordem dos vereditos:** "Montar kit" é testado antes do "Descartar por prejuízo". Quase todo produto de Kits recomendados dá prejuízo vendido sozinho, e é justamente por isso que ele é candidato a kit. Na ordem do documento, a sugestão de kit nunca apareceria.
- **Uma tabela a mais, `anotacoes`:** guarda a estrela de potencial, o título salvo e a quantidade escolhida para o kit, por item.
- **Sem TanStack Query e sem React Router:** o carregamento e as rotas foram feitos à mão (poucas linhas), para ter menos dependências.

## Problemas comuns

| Sintoma | Causa provável |
| --- | --- |
| Tela "Falta configurar o Supabase" | As variáveis `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` não estão no GitHub (passo 6) ou no `.env.local`. Depois de criar, rode **Publicar site** de novo. |
| Login do Google dá erro "redirect_uri_mismatch" | A URL de callback do Supabase não está em **URIs de redirecionamento autorizados** no Google (passo 4.3). |
| Depois do login, volta para a tela de entrada | O endereço do site não está em **Redirect URLs** do Supabase (passo 4.6). |
| "Acesso não liberado" | O e-mail não está na tabela `admins` (passo 2.4), ou foi digitado com letra maiúscula diferente. |
| Google diz "acesso bloqueado: app em teste" | Falta adicionar o e-mail em **Usuários de teste** no Google (passo 4.2). |
| Site parou de carregar os dados | O projeto do Supabase pausou: **Restore project** no painel. |
