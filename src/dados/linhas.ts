// Junta produto, análise, pesquisa, decisão e anotações de cada item (unidade ou kit) num objeto só.
import { useMemo } from 'react';
import { analisarDecisao, analisarItem, pesquisaVencida, premissasPara, comissaoDe, type AnaliseDecisao, type AnaliseItem, type Contexto } from '../nucleo/analise';
import { idKit, lerItemId, montarItem } from '../nucleo/itens';
import { analisarKit, type Recomendacao } from '../nucleo/kits';
import type { Anotacao, Decisao, Item, Pesquisa, Produto } from '../nucleo/tipos';
import { brl } from '../util/formato';
import { useDados, type Dados } from './store';

export type StatusPesquisa = 'pendente' | 'feita' | 'vencida' | 'nao_encontrado';
export type Situacao = 'sem_decisao' | 'aprovado' | 'reprovado' | 'adiado';

export interface Linha {
  id: string;
  item: Item;
  a: AnaliseItem;
  pesq?: Pesquisa;
  pesquisas: Pesquisa[];
  dec?: Decisao;
  decisoes: Decisao[];
  anot?: Anotacao;
  d?: AnaliseDecisao;
  kitRec: Recomendacao | null; // recomendação de kit do produto (nas linhas de unidade)
  tipoKit: 'recomendado' | 'montado' | null; // nas linhas de kit
  statusPesquisa: StatusPesquisa;
  situacao: Situacao;
  potencial: boolean;
  revisar: string[];
  mudanca: 'novo' | 'subiu' | 'caiu' | null;
  foraDaLista: boolean; // aprovado que ficou indisponível ou saiu da planilha
}

export interface Linhas {
  ctx: Contexto;
  unidades: Linha[];
  kits: Linha[];
  revisar: Linha[];
  porId: Map<string, Linha>;
  skusEmKits: Set<string>;
  ultimaImportacao: string | null;
}

function agrupar<T extends { itemId: string }>(lista: T[]): Map<string, T[]> {
  const m = new Map<string, T[]>();
  for (const x of lista) {
    const arr = m.get(x.itemId);
    if (arr) arr.push(x); else m.set(x.itemId, [x]);
  }
  return m;
}

export function calcularLinhas(dados: Dados, agora = Date.now()): Linhas {
  const ctx: Contexto = { config: dados.config, comissoes: dados.comissoes, categorias: dados.categorias, tabela: dados.tabela };
  const cfg = dados.config;
  const ladoMax = cfg.ocultarAcimaDoLado ? cfg.ladoMaxCm : 0;
  const pesqPorItem = agrupar(dados.pesquisas);
  const decPorItem = agrupar(dados.decisoes);
  const ultimaImportacao = dados.importacoes[0]?.id || null;
  const hoje = new Date(agora).toISOString().slice(0, 10);

  const produtosAtivos = [...dados.produtos.values()].filter((p) => p.ativo);

  // recomendações de kit (com a comissão do tipo de anúncio padrão)
  const kitRec = new Map<string, Recomendacao>();
  for (const p of produtosAtivos) {
    const com = comissaoDe(p.categoria, ctx);
    const prem = premissasPara(cfg, cfg.tipoAnuncioPadrao === 'premium' ? com.premium : com.classico);
    const r = analisarKit(p, prem, dados.tabela, ladoMax, cfg.pesoFreteModo);
    if (r) kitRec.set(p.sku, r);
  }
  const skusEmKits = new Set(kitRec.keys());

  function linha(item: Item, rec: Recomendacao | null, tipoKit: Linha['tipoKit'], foraDaLista = false): Linha {
    const a = analisarItem(item, ctx);
    const pesquisas = pesqPorItem.get(item.id) || [];
    const decisoes = decPorItem.get(item.id) || [];
    const pesq = pesquisas[pesquisas.length - 1];
    const ultimaDec = decisoes[decisoes.length - 1];
    const dec = ultimaDec && ultimaDec.decisao !== 'desfeita' ? ultimaDec : undefined;
    const anot = dados.anotacoes.get(item.id);
    const d = pesq ? analisarDecisao(a, pesq, ctx, item.q === 1 && skusEmKits.has(item.sku)) : undefined;
    const vencida = pesquisaVencida(pesq, cfg.validadePesquisaDias, agora);
    const statusPesquisa: StatusPesquisa = !pesq ? 'pendente' : vencida ? 'vencida' : pesq.naoEncontrado ? 'nao_encontrado' : 'feita';
    const situacao: Situacao = dec ? (dec.decisao as Situacao) : 'sem_decisao';
    const p = item.produto;
    const revisar: string[] = [];
    if (situacao === 'aprovado') {
      if (dec!.custoMomento !== null && item.custo > dec!.custoMomento + 0.005) revisar.push(`Custo subiu de ${brl(dec!.custoMomento)} para ${brl(item.custo)}`);
      if (p.origem === 'planilha' && !p.disponivel) revisar.push('Ficou indisponível no fornecedor');
      else if (p.origem === 'planilha' && !p.naPlanilha) revisar.push('Saiu da planilha do fornecedor');
      if (vencida) revisar.push(`Pesquisa com mais de ${cfg.validadePesquisaDias} dias`);
    }
    if (situacao === 'adiado' && dec!.revisarEm && dec!.revisarEm <= hoje) revisar.push(`Revisão marcada para ${dec!.revisarEm.split('-').reverse().join('/')}`);
    const mudanca = !ultimaImportacao || p.origem === 'manual' ? null
      : p.primeiraImportacaoId === ultimaImportacao && dados.importacoes.length > 1 ? 'novo'
        : p.custoMudouImportacao === ultimaImportacao && p.custoAnterior !== null ? (p.custo > p.custoAnterior ? 'subiu' : 'caiu') : null;
    return {
      id: item.id, item, a, pesq, pesquisas, dec, decisoes, anot, d, kitRec: rec, tipoKit, statusPesquisa, situacao,
      potencial: !!anot?.potencial, revisar, mudanca, foraDaLista,
    };
  }

  const unidades = produtosAtivos.map((p) => linha(montarItem(p, 1, cfg.pesoFreteModo), kitRec.get(p.sku) || null, null));

  // kits: recomendados, montados por vocês, e kits com decisão cujo produto ainda está na lista
  const kitsIds = new Map<string, { p: Produto; q: number; tipo: 'recomendado' | 'montado' }>();
  for (const p of produtosAtivos) {
    const an = dados.anotacoes.get(p.sku);
    const rec = kitRec.get(p.sku);
    if (an?.kitMontado && an.kitQtd) kitsIds.set(p.sku, { p, q: an.kitQtd, tipo: 'montado' });
    else if (rec) kitsIds.set(p.sku, { p, q: an?.kitQtd || rec.q, tipo: 'recomendado' });
  }
  const kits: Linha[] = [];
  const vistos = new Set<string>();
  for (const { p, q, tipo } of kitsIds.values()) {
    const l = linha(montarItem(p, q, cfg.pesoFreteModo), null, tipo);
    kits.push(l);
    vistos.add(l.id);
  }
  for (const id of decPorItem.keys()) {
    const { sku, q } = lerItemId(id);
    if (q < 2 || vistos.has(id)) continue;
    const p = dados.produtos.get(sku);
    const ultima = decPorItem.get(id)!.slice(-1)[0];
    if (p && p.ativo && ultima.decisao === 'aprovado') { kits.push(linha(montarItem(p, q, cfg.pesoFreteModo), null, 'montado')); vistos.add(id); }
  }

  // aprovados fora da lista (indisponíveis ou fora da planilha) só aparecem na fila Revisar
  const fora: Linha[] = [];
  for (const [id, decs] of decPorItem) {
    const ultima = decs[decs.length - 1];
    if (ultima.decisao !== 'aprovado') continue;
    const { sku, q } = lerItemId(id);
    const p = dados.produtosFora.get(sku);
    if (p) fora.push(linha(montarItem(p, q, cfg.pesoFreteModo), null, q > 1 ? 'montado' : null, true));
  }

  const porId = new Map<string, Linha>();
  for (const l of [...unidades, ...kits, ...fora]) porId.set(l.id, l);
  const revisar = [...unidades, ...kits, ...fora].filter((l) => l.revisar.length > 0);
  return { ctx, unidades, kits, revisar, porId, skusEmKits, ultimaImportacao };
}

export function useLinhas(): Linhas {
  const dados = useDados();
  const { produtos, produtosFora, config, comissoes, categorias, tabela, pesquisas, decisoes, anotacoes, importacoes } = dados;
  return useMemo(
    () => calcularLinhas({ produtos, produtosFora, config, comissoes, categorias, tabela, pesquisas, decisoes, anotacoes, importacoes }),
    [produtos, produtosFora, config, comissoes, categorias, tabela, pesquisas, decisoes, anotacoes, importacoes],
  );
}

export { idKit };
