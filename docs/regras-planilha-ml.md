# Regras de preenchimento da planilha do Mercado Livre

> Código: `src/nucleo/planilhaMl.ts` (leitura, regras e escrita) e `src/paginas/PlanilhaMl.tsx` (tela **Planilha do ML**).
> Quando uma regra mudar, mude aqui e no código juntos.

## 1. Fluxo

1. Em **Aprovados**, copiar os EANs (**Copiar EANs**) e enviar ao Mercado Livre em *Anunciar em massa*.
2. O ML devolve a planilha `Anunciar-….xlsx`: uma aba por categoria e uma linha por produto encontrado, já com marca, modelo e características.
3. Enviar essa planilha na tela **Planilha do ML**.
4. O sistema faz o **DE-PARA pelo EAN**, mostra a prévia (item, título, preço, avisos) e gera **a mesma planilha preenchida** (`…-PREENCHIDA.xlsx`).
5. Subir a planilha preenchida no ML. Depois, o botão **Marcar N como publicados** move os itens para **Publicados**.

## 2. Leitura da planilha do ML

| Regra | Detalhe |
| --- | --- |
| Abas ignoradas | `Ajuda`, `extra info` e `Informações legais`. As outras são abas de categoria. |
| Linha 3 | Nomes das colunas. As colunas são achadas **pelo nome** (o texto até o primeiro `:`), nunca pela posição: cada categoria tem colunas diferentes e o ML muda a ordem. |
| Linhas 4 a 7 | Instruções do ML. Não são alteradas. |
| Linha 8 em diante | Produtos. Uma linha é produto quando tem **Código universal de produto** (EAN) ou **Código do catálogo ML**. |
| Opções das listas | As opções de cada coluna vêm da aba oculta `extra info`. O sistema só grava um valor de lista se ele existir naquela categoria; senão, não grava e avisa. |

## 3. DE-PARA pelo EAN (único vínculo com a base)

1. O **Código universal de produto** pode ter **vários EANs separados por vírgula**; vale qualquer um.
2. Os EANs são comparados só pelos dígitos e **sem zeros à esquerda** (o ML às vezes manda 14 dígitos, ex.: `07899788409920` = `7899788409920`).
3. Procura entre os itens **aprovados** (unidades e kits).
4. Mais de um item com o mesmo EAN (ex.: a unidade e o kit de 4): a prévia mostra uma lista para escolher. A sugestão é, nesta ordem: o que **não está publicado**, o que tem **tipo de anúncio escolhido**, o **kit**.
5. Nenhum item com o EAN: a linha não é alterada e aparece na prévia como "Nenhum item aprovado com este EAN".

## 4. O que o sistema preenche

| Coluna do ML | Valor |
| --- | --- |
| Título | O **título salvo** no item (campo *Título sugerido* do detalhe). Sem título salvo: o **título sugerido** pelo sistema. Espaços sobrando são removidos. Acima de 60 caracteres: grava e avisa. **[a definir: regra final do título]** |
| Código do catálogo ML | **Apagar o valor** (a coluna fica). |
| Fotos | Os **links das fotos** do item (campo *Fotos para o ML* em Aprovados), separados por vírgula. Sem links: mantém o que o ML mandou e avisa. |
| SKU | O SKU do produto no fornecedor (unidade e kit usam o mesmo). |
| Preço [R$] | O preço do **tipo de anúncio escolhido** no item (Clássico ou Premium), já com o preço manual se houver. Sem tipo escolhido: o tipo padrão das Configurações, com aviso. |
| Tipo de anúncio | `Clássico` ou `Premium`, o mesmo usado no preço. |
| Condição | `Novo` (só se a coluna existir). |
| Formato de venda | Kit: `Kit`. Unidade: `Unidade` (só se a coluna existir). |
| Quantidade de … | As colunas "Quantidade de …" entre *Formato de venda* e *Tipo de anúncio* recebem o número de unidades (1 na unidade). Kit numa categoria sem *Formato de venda*: aviso, a quantidade só vai no título. |
| Forma de envio | `Mercado Envios`. |
| Custo de envio | `Por conta do comprador`. |
| Retirar pessoalmente | `Não aceito`. |
| Tipo de garantia | `Garantia do vendedor`. |
| Tempo de garantia | `7`. |
| Unidade de Tempo de garantia | `dias`. |

Os valores fixos ficam em `FIXOS`, no começo de `src/nucleo/planilhaMl.ts`.

## 5. O que nunca é alterado

- Fórmulas do ML (Quantidade de caracteres, Tarifa de venda, `BUYBOX_FORMULA`). A única exceção é a fórmula da coluna **Fotos**, trocada pelos links quando o item tem links.
- Características que o ML preencheu (marca, modelo, medidas, material…), estoque, descrição.
- Linhas sem produto, abas `Ajuda`, `extra info` e `Informações legais`, validações, listas de opções e formatação.
- O arquivo é gravado trocando só as células da linha do produto, direto no XML, para o ML aceitar a planilha de volta.

## 6. Avisos na prévia (o arquivo é gerado mesmo assim)

- Título com mais de 60 caracteres, ou item sem título.
- Item sem links de fotos.
- Item sem tipo de anúncio escolhido.
- Item sem preço.
- Valor que não existe na lista da categoria (ex.: *Mercado Envios* em Isqueiros de Cozinha): o campo não é preenchido.
- Kit numa categoria sem *Formato de venda*.
- Mais de um item aprovado com o mesmo EAN.
- Item já publicado, ou fora da lista do fornecedor.
