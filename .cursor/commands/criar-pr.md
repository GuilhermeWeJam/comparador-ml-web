# criar-pr

Abra um Pull Request da branch atual para a branch principal do repositório (`main`; este repositório não tem `master`).

## Passos

1. Descubra a branch atual com `git branch --show-current`.
   - Se for `main`, pare e avise que não dá para abrir PR da `main` para ela mesma.
2. Rode `git status --short`.
   - Se houver alterações não commitadas, mostre-as ao usuário e pergunte se deve commitá-las antes de continuar. Não commite sem confirmação.
3. Atualize as referências com `git fetch origin main`.
4. Veja o que entra no PR com `git log origin/main..HEAD --oneline` e `git diff origin/main...HEAD --stat`.
   - Se não houver commits novos, pare e avise que não há nada para abrir PR.
5. Envie a branch com `git push -u origin HEAD`.
6. Monte o título e a descrição em português, a partir dos commits e do diff:
   - Título curto e objetivo, descrevendo a mudança principal.
   - Descrição com `## Resumo` (o que mudou e por quê) e `## Como testar`.
   - Se houver migration nova em `supabase/migrations/`, destaque na descrição que ela precisa ser rodada no SQL Editor do Supabase.
7. Abra o PR com `gh pr create --base main --head <branch-atual> --title "<título>" --body "<descrição>"`.
   - Se já existir PR aberto para a branch, não crie outro: mostre o link do existente (`gh pr view --web` ou `gh pr view --json url`).
8. Responda com o link do PR.

## Regras

- Nunca use `--force` no push.
- Nunca altere a `main` diretamente.
- Se algum comando falhar, mostre a mensagem de erro e explique o que fazer; não ignore o erro.
