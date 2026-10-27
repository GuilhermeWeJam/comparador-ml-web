// Notas de triagem e de decisão, veredito sugerido e conta da venda em Clássico e Premium.
// Regras da seção "Critérios de decisão" e "Vereditos e decisão final" do documento de requisitos.
import { analisarAlertas, temFragil, temRegulado, temRestrito } from './alertas';
import { contaVenda, custoMaximo, descontoNecessario, precoParaMargem, tamanho, type Conta, type StatusTamanho } from './calc';
import { FRETE_PADRAO } from './frete';
import type { Alerta, Categoria, ComissaoMl, Configuracoes, Epoca, Item, Pesos, Pesquisa, Premissas, TabelaFrete, TipoAnuncio } from './tipos';

export const PESOS_PADRAO: Pesos = {
  triagem: { lucro: 30, frete: 20, logistica: 15, risco: 15, epoca: 10, comissao: 10 },
  decisao: { margem: 35, demanda: 25, concorrencia: 20, risco: 20 },
  faixas: { alta: 70, media: 40 },
  veredito: { anunciar: 70, testar: 40, descontoMax: 0.25 },
};

export const CONFIG_PADRAO: Configuracoes = {
  margemDesejada: 0.2,
  margemMinima: 0.1,
  imposto: 0.05,
  reserva: 0.03,
  ads: 0.08,
  tipoAnuncioPadrao: 'classico',
  ocultarAcimaDoLado: true,
  ladoMaxCm: 70,
  validadePesquisaDias: 30,
  pesoFreteModo: 'real',
  pesos: PESOS_PADRAO,
};

export const COMISSAO_PADRAO: ComissaoMl = { categoriaMl: 'Padrão', classico: 0.13, premium: 0.18, padrao: true };

export interface Contexto {
  config: Configuracoes;
  comissoes: Map<string, ComissaoMl>;
  categorias: Map<string, Categoria>;
  tabela: TabelaFrete;
}

export interface ComissaoItem {
  classico: number;
  premium: number;
  categoriaMl: string;
  padrao: boolean; // true = categoria sem ligação, usando o padrão
}

/** Comissão da categoria do produto (Clássico e Premium). Sem ligação, usa a linha marcada como padrão. */
export function comissaoDe(categoria: string, ctx: Contexto): ComissaoItem {
  const padrao = [...ctx.comissoes.values()].find((c) => c.padrao) || COMISSAO_PADRAO;
  const cat = ctx.categorias.get(categoria);
  const ml = cat && cat.categoriaMl ? ctx.comissoes.get(cat.categoriaMl) : undefined;
  if (!ml) return { classico: padrao.classico, premium: padrao.premium, categoriaMl: padrao.categoriaMl, padrao: true };
  return { classico: ml.classico, premium: ml.premium, categoriaMl: ml.categoriaMl, padrao: ml.padrao };
}

export function premissasPara(config: Configuracoes, comissao: number): Premissas {
  return {
    margemDesejada: config.margemDesejada,
    margemMinima: config.margemMinima,
    comissao,
    imposto: config.imposto,
    reserva: config.reserva,
    ads: config.ads,
  };
}

export interface Parte {
  criterio: string;
  pontos: number;
  max: number;
  texto: string;
}

export interface Nota {
  total: number;
  faixa: 'alta' | 'media' | 'baixa';
  partes: Parte[];
}

export interface Venda {
  preco: number; // preço sugerido (margem desejada)
  minimo: number; // preço mínimo (margem mínima)
  conta: Conta; // conta no preço sugerido
}

export interface AnaliseItem {
  item: Item;
  comissao: ComissaoItem;
  classico: Venda;
  premium: Venda;
  tamanho: { status: StatusTamanho; maior: number };
  foraDoTamanho: boolean;
  alertas: Alerta[];
  restrito: boolean;
  epoca: Epoca;
  triagem: Nota;
}

const clamp01 = (x: number) => (x < 0 ? 0 : x > 1 ? 1 : x);
const r1 = (x: number) => Math.round(x * 10) / 10;
const brl = (v: number) => (Number.isFinite(v) ? 'R$ ' + v.toFixed(2).replace('.', ',') : '—');
const pct = (v: number) => (Number.isFinite(v) ? (v * 100).toFixed(1).replace('.', ',') + '%' : '—');

function faixaDe(total: number, pesos: Pesos): Nota['faixa'] {
  return total >= pesos.faixas.alta ? 'alta' : total >= pesos.faixas.media ? 'media' : 'baixa';
}

function nota(partes: Parte[], pesos: Pesos): Nota {
  const total = Math.round(partes.reduce((s, p) => s + p.pontos, 0));
  return { total, faixa: faixaDe(total, pesos), partes };
}

function venda(item: Item, tipo: TipoAnuncio, com: ComissaoItem, ctx: Contexto): Venda {
  const p = premissasPara(ctx.config, tipo === 'classico' ? com.classico : com.premium);
  const preco = precoParaMargem(item.custo, item.peso, p.margemDesejada, p, ctx.tabela);
  const minimo = precoParaMargem(item.custo, item.peso, p.margemMinima, p, ctx.tabela);
  return { preco, minimo, conta: contaVenda(preco, item.custo, item.peso, p, ctx.tabela) };
}

/** Frações (0 a 1) de logística e risco, usadas na triagem e na decisão. */
function logisticaRisco(item: Item, alertas: Alerta[]) {
  let log = item.peso <= 2 ? 1 : item.peso <= 5 ? 8 / 15 : 0;
  const fragil = temFragil(alertas);
  if (fragil) log = Math.max(0, log - 5 / 15);
  const restrito = temRestrito(alertas);
  const regulado = temRegulado(alertas);
  const risco = restrito ? 0 : regulado ? 5 / 15 : 1;
  return { log, risco, fragil, restrito, regulado };
}

/** Análise sem pesquisa: comissão, preços Clássico e Premium, tamanho, alertas e nota de triagem. */
export function analisarItem(item: Item, ctx: Contexto): AnaliseItem {
  const cfg = ctx.config;
  const w = cfg.pesos.triagem;
  const com = comissaoDe(item.produto.categoria, ctx);
  const classico = venda(item, 'classico', com, ctx);
  const premium = venda(item, 'premium', com, ctx);
  const ladoMax = cfg.ocultarAcimaDoLado ? cfg.ladoMaxCm : 0;
  const alertas = analisarAlertas(item, ladoMax);
  const tam = tamanho(item.produto.dims, ladoMax);
  const foraDoTamanho = alertas.some((a) => a.tipo === 'Tamanho');
  const epoca: Epoca = ctx.categorias.get(item.produto.categoria)?.epoca || 'normal';
  const lr = logisticaRisco(item, alertas);

  const c = classico.conta;
  const partes: Parte[] = [];
  const fLucro = clamp01((c.lucro - 5) / 20);
  partes.push({ criterio: 'Lucro por venda', pontos: r1(fLucro * w.lucro), max: w.lucro, texto: `Lucro de ${brl(c.lucro)} no preço Clássico (${brl(c.preco)})` });
  const pesoFrete = c.preco > 0 ? c.envio / c.preco : 1;
  partes.push({ criterio: 'Peso do frete', pontos: r1(clamp01((0.25 - pesoFrete) / 0.15) * w.frete), max: w.frete, texto: `Frete de ${brl(c.envio)} = ${pct(pesoFrete)} do preço` });
  partes.push({
    criterio: 'Logística', pontos: r1(lr.log * w.logistica), max: w.logistica,
    texto: `${item.peso.toFixed(2).replace('.', ',')} kg para frete${lr.fragil ? '; frágil' : ''}`,
  });
  partes.push({
    criterio: 'Risco', pontos: r1(lr.risco * w.risco), max: w.risco,
    texto: lr.restrito ? 'Item restrito no ML' : lr.regulado ? 'Exige certificação ou é marca licenciada' : 'Sem alerta de regulação',
  });
  const fEpoca = epoca === 'alta' ? 1 : epoca === 'normal' ? 0.5 : 0;
  partes.push({ criterio: 'Época', pontos: r1(fEpoca * w.epoca), max: w.epoca, texto: `Categoria em época ${epoca === 'alta' ? 'alta agora' : epoca}` });
  const fCom = com.classico <= 0.115 + 1e-9 ? 1 : com.classico <= 0.13 + 1e-9 ? 0.5 : 0;
  partes.push({ criterio: 'Comissão', pontos: r1(fCom * w.comissao), max: w.comissao, texto: `${pct(com.classico)} no Clássico (${com.categoriaMl})` });

  return { item, comissao: com, classico, premium, tamanho: tam, foraDoTamanho, alertas, restrito: lr.restrito, epoca, triagem: nota(partes, cfg.pesos) };
}

// ---------- depois da pesquisa ----------

export type TipoVeredito = 'anunciar' | 'testar' | 'montar_kit' | 'renegociar' | 'descartar';

export const VEREDITOS: Record<TipoVeredito, { rotulo: string; cor: string }> = {
  anunciar: { rotulo: 'Anunciar', cor: 'verde' },
  testar: { rotulo: 'Testar', cor: 'azul' },
  montar_kit: { rotulo: 'Montar kit', cor: 'roxo' },
  renegociar: { rotulo: 'Renegociar', cor: 'laranja' },
  descartar: { rotulo: 'Descartar', cor: 'vermelho' },
};

export interface AnaliseDecisao {
  precoRef: number;
  origemRef: 'mais_vendido' | 'menor_preco' | 'nenhum';
  menorPreco: number;
  tipo: TipoAnuncio;
  conta: Conta | null; // no preço de referência, tipo de anúncio padrão
  contaPremium: Conta | null;
  contaClassico: Conta | null;
  folga: number; // (preço de referência − seu preço mínimo) ÷ preço de referência
  teto: number;
  desconto: number;
  nota: Nota;
  veredito: TipoVeredito;
  motivo: string;
}

/** Converte o preço de um anúncio com outra quantidade para a quantidade do item. */
export function precoConvertido(preco: number | null, qtdNoAnuncio: number | null, q: number): number {
  if (!(preco && preco > 0)) return NaN;
  const n = qtdNoAnuncio && qtdNoAnuncio > 0 ? qtdNoAnuncio : q;
  return (preco / n) * q;
}

function fracDemanda(v: number | null): number {
  if (v === null || !(v > 0)) return 0;
  const L = Math.log10;
  if (v < 50) return 0.4 * (L(1 + v) / L(51));
  if (v < 500) return 0.4 + (L(v) - L(50)) * 0.32;
  if (v < 5000) return 0.72 + (L(v) - L(500)) * 0.28;
  return 1;
}

/** Nota de decisão e veredito, a partir da análise e da pesquisa. `emKits` = o produto está em Kits recomendados. */
export function analisarDecisao(a: AnaliseItem, pesq: Pesquisa, ctx: Contexto, emKits: boolean): AnaliseDecisao {
  const cfg = ctx.config;
  const w = cfg.pesos.decisao;
  const vv = cfg.pesos.veredito;
  const item = a.item;
  const tipo = cfg.tipoAnuncioPadrao;
  const p = premissasPara(cfg, tipo === 'classico' ? a.comissao.classico : a.comissao.premium);
  const pPrem = premissasPara(cfg, a.comissao.premium);
  const pClas = premissasPara(cfg, a.comissao.classico);
  const minimo = tipo === 'classico' ? a.classico.minimo : a.premium.minimo;

  const menor = precoConvertido(pesq.menorPreco, pesq.qtdNoAnuncio, item.q);
  const maisVendido = precoConvertido(pesq.precoMaisVendido, pesq.qtdNoAnuncio, item.q);
  const precoRef = Number.isFinite(maisVendido) ? maisVendido : menor;
  const origemRef = Number.isFinite(maisVendido) ? 'mais_vendido' : Number.isFinite(menor) ? 'menor_preco' : 'nenhum';
  const lr = logisticaRisco(item, a.alertas);

  if (pesq.naoEncontrado || !Number.isFinite(precoRef)) {
    const alta = a.triagem.total >= vv.anunciar;
    const partes: Parte[] = [{ criterio: 'Sem concorrente', pontos: 0, max: 100, texto: 'Produto não encontrado no Mercado Livre' }];
    return {
      precoRef: NaN, origemRef: 'nenhum', menorPreco: NaN, tipo, conta: null, contaPremium: null, contaClassico: null,
      folga: NaN, teto: NaN, desconto: NaN, nota: { total: 0, faixa: 'baixa', partes },
      veredito: a.restrito ? 'descartar' : alta ? 'testar' : 'descartar',
      motivo: a.restrito ? 'Item restrito no ML.' : alta
        ? `Sem concorrente e nota de triagem ${a.triagem.total}: vale testar.`
        : `Sem concorrente e nota de triagem ${a.triagem.total} (abaixo de ${vv.anunciar}): não compensa arriscar.`,
    };
  }

  const conta = contaVenda(precoRef, item.custo, item.peso, p, ctx.tabela);
  const contaPremium = contaVenda(precoRef, item.custo, item.peso, pPrem, ctx.tabela);
  const contaClassico = contaVenda(precoRef, item.custo, item.peso, pClas, ctx.tabela);
  const md = cfg.margemDesejada;
  const mm = cfg.margemMinima;
  const m = conta.margem;

  const partes: Parte[] = [];
  let fMargem: number;
  if (m >= md - 1e-9) fMargem = 1;
  else if (m >= mm - 1e-9) fMargem = (15 + ((m - mm) / (md - mm)) * 20) / 35;
  else if (m > 0) fMargem = ((m / mm) * 15) / 35;
  else fMargem = 0;
  partes.push({ criterio: 'Margem no preço de referência', pontos: r1(fMargem * w.margem), max: w.margem, texto: `${pct(m)} a ${brl(precoRef)} (${origemRef === 'mais_vendido' ? 'anúncio que mais vende' : 'menor preço'})` });
  const v = pesq.vendidosMaisVendido;
  partes.push({ criterio: 'Demanda', pontos: r1(fracDemanda(v) * w.demanda), max: w.demanda, texto: v === null ? 'Vendidos não informados' : `${v.toLocaleString('pt-BR')} vendidos no anúncio que mais vende` });
  let pc = pesq.concorrentes === '1-3' ? 20 : pesq.concorrentes === '4-10' ? 12 : pesq.concorrentes === '10+' ? 5 : 12;
  if (pesq.temFull) pc -= 5;
  if (pesq.temOficial) pc -= 5;
  pc = Math.max(0, pc);
  const txtConc = [
    pesq.concorrentes ? `${pesq.concorrentes.replace('10+', 'mais de 10').replace('-', ' a ')} anúncios do mesmo produto` : 'Concorrentes não informados (valor neutro)',
    pesq.temFull ? 'tem Full' : '',
    pesq.temOficial ? 'tem loja oficial' : '',
  ].filter(Boolean).join('; ');
  partes.push({ criterio: 'Concorrência', pontos: r1((pc / 20) * w.concorrencia), max: w.concorrencia, texto: txtConc });
  partes.push({ criterio: 'Risco e logística', pontos: r1(((lr.log + lr.risco) / 2) * w.risco), max: w.risco, texto: [lr.restrito ? 'restrito' : lr.regulado ? 'regulado' : 'sem alerta de regulação', `${item.peso.toFixed(2).replace('.', ',')} kg`, lr.fragil ? 'frágil' : ''].filter(Boolean).join('; ') });
  const n = nota(partes, cfg.pesos);

  const teto = custoMaximo(precoRef, item.peso, mm, p, ctx.tabela);
  const desconto = descontoNecessario(item.custo, teto);
  const folga = (precoRef - minimo) / precoRef;
  const base = { precoRef, origemRef: origemRef as AnaliseDecisao['origemRef'], menorPreco: menor, tipo, conta, contaPremium, contaClassico, folga, teto, desconto, nota: n };

  if (a.restrito) return { ...base, veredito: 'descartar', motivo: 'Item restrito no ML.' };
  // Produto em Kits recomendados quase sempre dá prejuízo sozinho (é por isso que é candidato a kit):
  // a sugestão de kit vem antes do descarte por prejuízo.
  if (m < mm - 1e-9 && item.q === 1 && emKits)
    return { ...base, veredito: 'montar_kit', motivo: `Sozinho dá ${pct(m)}; o produto está em Kits recomendados: pesquise o kit.` };
  const comDesconto = contaVenda(precoRef, item.custo * (1 - vv.descontoMax), item.peso, p, ctx.tabela);
  if (comDesconto.lucro < 0) return { ...base, veredito: 'descartar', motivo: `Prejuízo mesmo com ${pct(vv.descontoMax)} de desconto do fornecedor.` };
  if (m < mm - 1e-9) {
    if (desconto <= vv.descontoMax + 1e-9) return { ...base, veredito: 'renegociar', motivo: `Peça ${pct(desconto)} de desconto: o custo precisa cair para ${brl(teto)}.` };
    return { ...base, veredito: 'descartar', motivo: `Precisaria de ${pct(desconto)} de desconto (mais de ${pct(vv.descontoMax)}).` };
  }
  if (n.total >= vv.anunciar) return { ...base, veredito: 'anunciar', motivo: `Margem de ${pct(m)} e nota ${n.total}.` };
  if (n.total >= vv.testar) return { ...base, veredito: 'testar', motivo: `Margem de ${pct(m)}, mas nota ${n.total}: anuncie e acompanhe por 30 dias.` };
  return { ...base, veredito: 'descartar', motivo: `Margem de ${pct(m)}, mas nota ${n.total}: pouca demanda ou concorrência forte.` };
}

/** Pesquisa com mais dias que a validade configurada. */
export function pesquisaVencida(pesq: Pesquisa | undefined, validadeDias: number, agora = Date.now()): boolean {
  if (!pesq || !pesq.criadoEm) return false;
  return agora - Date.parse(pesq.criadoEm) > validadeDias * 864e5;
}

export { FRETE_PADRAO };
