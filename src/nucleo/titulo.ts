// Analisador e sugestão de título para anúncios do Mercado Livre (mesmas regras do plugin 1.5.1).
//  - até 60 caracteres, de preferência 45 a 60;
//  - começar pelo nome do produto que o comprador digita;
//  - sem termos promocionais, adjetivos vazios, símbolos, caixa alta ou palavras repetidas;
//  - número colado na unidade (750ml), sem abreviações (c/, p/);
//  - em kit, começar por "Kit N".
import { pluralPrimeira } from './itens';

export const LIMITE_TITULO = 60;

const STOP = new Set(('a o as os e de da do das dos em no na nos nas para pra por com sem um uma uns umas ao à às ou que se sua seu suas seus p c s x').split(' '));
const GENERICAS = new Set(('novo nova original produto oferta promoção promocao frete gratis grátis envio imediato pronta entrega full qualidade top melhor super mega kit unidade unidades peça peças pecas cor cores sortido sortida sortidos sortidas modelo tamanho').split(' '));

const RE_PROMO = /\b(promo[cç][aã]o|oferta|frete gr[aá]tis|gr[aá]tis|imperd[ií]vel|liquida[cç][aã]o|melhor pre[cç]o|barato|baratinho|queima|black friday|desconto|lan[cç]amento|full|envio imediato|pronta entrega|entrega r[aá]pida|r\$)/i;
const RE_SUBJETIVO = /\b(lindo|linda|perfeito|perfeita|incr[ií]vel|maravilhos[oa]|top|super|mega|show|exclusivo|exclusiva|sensacional|fant[aá]stic[oa])\b/i;
const RE_SIMBOLO = /[!*#$%=~^|<>[\]{}@✓✔★☆♥❤🔥]|[\u{1F300}-\u{1FAFF}]/u;
const RE_ABREV = /(^|\s)(c\/|p\/|s\/|c\.|p\.|pç|pçs|un\.|qtd|unid\.)(\s|$)/i;
const RE_ESPEC = /\d+(?:[.,]\d+)?\s?(ml|l|lt|litros?|cm|mm|m|metros?|kg|g|gramas?|w|v|watts?|volts?|pol|polegadas?|peças|pçs|pcs|unidades|un|lugares|andares|x\s?\d+)\b|\b\d+\s?x\s?\d+\b|\bbivolt\b|\b(127|220)v\b/i;
const RE_COR = /\b(preto|preta|branco|branca|azul|vermelho|vermelha|verde|amarelo|amarela|rosa|lil[aá]s|roxo|roxa|cinza|marrom|bege|laranja|dourado|dourada|prata|prateado|prateada|transparente|colorido|colorida|multicolorido|pink|nude|grafite|creme|off white)\b/i;
const RE_SORTIDO = /\bsortid[oa]s?\b/i;
const RE_FORNECEDOR = /^\s*(we ?drop|wedrop)\s*-?\s*/i;
const SIGLAS = new Set(['LED', 'USB', 'PVC', 'MDF', 'PET', 'TV', 'PC', 'ABS', 'UV', 'RGB', 'HD', 'XL', 'XG', 'GG', 'PP', 'P', 'M', 'G', 'BPA', 'EVA', 'INOX', 'II', 'III', 'IV']);

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

function tokens(titulo: string): string[] {
  return semAcento(String(titulo || '').toLowerCase()).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

function raiz(t: string): string {
  if (t.length > 4 && /oes$/.test(t)) return t.slice(0, -3) + 'ao';
  if (t.length > 5 && /res$/.test(t)) return t.slice(0, -2);
  if (t.length > 4 && /s$/.test(t)) return t.slice(0, -1);
  return t;
}

function termosUteis(titulo: string): string[] {
  return tokens(titulo).filter((t) => !STOP.has(t) && !GENERICAS.has(t) && !/^\d+$/.test(t) && t.length > 1);
}

export interface ItemAnalise {
  ok: boolean;
  pontos: number;
  max: number;
  texto: string;
  dica?: string;
}

export interface AnaliseTitulo {
  titulo: string;
  tamanho: number;
  nota: number;
  nivel: 'Bom' | 'Regular' | 'Fraco';
  itens: ItemAnalise[];
}

/** Nota de 0 a 100 do título, com a lista do que está bom e do que melhorar. */
export function analisarTitulo(titulo: string, q = 1): AnaliseTitulo {
  const t = String(titulo || '').replace(/\s+/g, ' ').trim();
  const itens: ItemAnalise[] = [];
  const add = (ok: boolean, pontos: number, max: number, texto: string, dica?: string) => itens.push({ ok, pontos, max, texto, dica });

  const len = t.length;
  if (len > LIMITE_TITULO) add(false, 0, 20, `Tem ${len} caracteres; o limite do Mercado Livre é ${LIMITE_TITULO}.`, 'Corte palavras que não ajudam a busca.');
  else if (len < 35) add(false, 0, 20, `Curto (${len} caracteres): sobra espaço para o que o comprador busca.`, 'Acrescente medida, capacidade, material ou quantidade.');
  else if (len < 45) add(true, 12, 20, `${len} caracteres: dá para aproveitar melhor os 60.`, 'Acrescente mais uma característica útil.');
  else add(true, 20, 20, `${len} caracteres: bom uso do espaço.`);

  const tk = termosUteis(t);
  const primeira = tokens(t)[0] || '';
  const iniciaMal = !tk.length || /^\d/.test(primeira) || RE_FORNECEDOR.test(t) || RE_SUBJETIVO.test(primeira) || RE_COR.test(primeira);
  if (iniciaMal) add(false, 0, 10, 'Não começa pelo nome do produto.', 'Comece pela palavra que o comprador digita (ex.: "Pote Hermético...").');
  else add(true, 10, 10, 'Começa pelo nome do produto.');

  const promo = t.match(RE_PROMO);
  const subj = t.match(RE_SUBJETIVO);
  if (promo) add(false, 0, 15, `Tem termo promocional ("${promo[0]}"). O ML pode penalizar.`, 'Preço, frete e promoção já aparecem no anúncio.');
  else if (subj) add(false, 7, 15, `Tem adjetivo vazio ("${subj[0]}").`, 'Troque por uma característica concreta.');
  else add(true, 15, 15, 'Sem termos promocionais.');

  if (RE_SIMBOLO.test(t)) add(false, 0, 10, 'Tem símbolos ou emojis.', 'Use só letras e números.');
  else if (/\s-\s?|\s?-\s|\s\/\s|,(?!\d)|(?<!\d),/.test(t)) add(false, 6, 10, 'Usa traços ou vírgulas como separador: gastam caracteres.', 'Escreva em sequência: "Varal de Chão Dobrável Aço Preto".');
  else add(true, 10, 10, 'Sem símbolos.');

  const palavras = t.split(' ').filter((w) => /\p{L}{4,}/u.test(w));
  const maiusculas = palavras.filter((w) => w === w.toUpperCase() && !SIGLAS.has(w.replace(/[^\p{L}]/gu, '')) && !/\d/.test(w));
  if (maiusculas.length >= 2 || (palavras.length && maiusculas.length / palavras.length > 0.3)) add(false, 0, 5, 'Tem palavras em CAIXA ALTA.', 'Use só a primeira letra maiúscula.');
  else add(true, 5, 5, 'Sem caixa alta.');

  const contagem = new Map<string, number>();
  for (const w of tk) {
    const r = raiz(semAcento(w));
    contagem.set(r, (contagem.get(r) || 0) + 1);
  }
  const rep = [...contagem.entries()].filter(([, c]) => c > 1).map(([w]) => w);
  if (rep.length) add(false, 0, 10, `Repete palavras (${rep.join(', ')}).`, 'Cada palavra uma vez só; use o espaço para outra característica.');
  else add(true, 10, 10, 'Sem palavras repetidas.');

  if (RE_ESPEC.test(t)) add(true, 10, 10, 'Tem medida, capacidade ou quantidade.');
  else add(false, 0, 10, 'Não tem medida, capacidade, voltagem ou quantidade.', 'Ex.: 750ml, 28cm, 127V, 24 peças. Número colado na unidade.');

  if (RE_SORTIDO.test(t)) add(false, 0, 10, '"Sortido" não é buscado e o cliente não sabe a cor que vai receber.', 'Use variações de cor no anúncio.');
  else if (RE_COR.test(t)) add(true, 7, 10, 'Tem cor no título. Se o anúncio tiver variações de cor, tire a cor do título.');
  else add(true, 10, 10, 'Sem cor no título (bom para anúncios com variações).');

  if (RE_ABREV.test(t)) add(false, 0, 5, 'Tem abreviação (c/, p/, pç...).', 'Escreva por extenso: "com", "para", "peças".');
  else if (/\d\s(ml|cm|mm|kg|g|l|w|v)\b/i.test(t)) add(false, 3, 5, 'Número separado da unidade (ex.: "750 ml").', 'Escreva colado: "750ml".');
  else add(true, 5, 5, 'Sem abreviações confusas.');

  if (q > 1) {
    if (new RegExp('^kit\\s*' + q + '\\b', 'i').test(t)) add(true, 10, 10, `Começa por "Kit ${q}": deixa claro quantas unidades vêm.`);
    else add(false, 0, 10, `Para kit, comece por "Kit ${q}" e diga o que vem.`, 'Ex.: "Kit 3 Potes Herméticos de Vidro 1,8L".');
  }

  const max = itens.reduce((s, i) => s + i.max, 0);
  const pontos = itens.reduce((s, i) => s + i.pontos, 0);
  const nota = max ? Math.round((pontos / max) * 100) : 0;
  const nivel = nota >= 80 ? 'Bom' : nota >= 60 ? 'Regular' : 'Fraco';
  return { titulo: t, tamanho: len, nota, nivel, itens };
}

function capitalizar(w: string): string {
  if (!w) return w;
  if (/\d/.test(w) || (SIGLAS.has(w.toUpperCase()) && w === w.toUpperCase())) return w;
  const minus = ['de', 'da', 'do', 'das', 'dos', 'e', 'com', 'para', 'em', 'a', 'o'];
  if (minus.includes(w.toLowerCase())) return w.toLowerCase();
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

function limpar(t: string): string {
  let s = String(t || '');
  s = s.replace(RE_FORNECEDOR, '');
  s = s.replace(/\s*-\s*(\p{L})/gu, ' $1');
  s = s.replace(RE_SORTIDO, ' ');
  s = s.replace(/(^|\s)c\/(\s|$)/gi, '$1com$2').replace(/(^|\s)p\/(\s|$)/gi, '$1para$2').replace(/(^|\s)s\/(\s|$)/gi, '$1sem$2');
  s = s.replace(/(^|\s)pçs?(\s|$)/gi, '$1peças$2');
  s = s.replace(new RegExp(RE_PROMO.source, 'gi'), ' ').replace(new RegExp(RE_SUBJETIVO.source, 'gi'), ' ');
  s = s.replace(/[!*#$%=~^|<>[\]{}@✓✔★☆♥❤🔥]|[\u{1F300}-\u{1FAFF}]/gu, ' ');
  s = s.replace(/,(?!\d)|(?<!\d),/g, ' ');
  s = s.replace(/\s[-/]\s/g, ' ');
  s = s.replace(/(\d+(?:[.,]\d+)?)\s(ml|cm|mm|kg|g|l|w|v)\b/gi, (_m, n: string, u: string) => n + u.toLowerCase());
  s = s.replace(/\s+/g, ' ').trim();
  const out: string[] = [];
  const chave = (w: string) => raiz(semAcento(w.toLowerCase()));
  const ws0 = s.split(' ');
  const primeiraChave = ws0.length ? chave(ws0[0]) : '';
  ws0.forEach((w, i) => {
    const k = chave(w);
    if (out.length && chave(out[out.length - 1]) === k) return;
    if (i > 0 && k === primeiraChave && k !== 'kit' && k.length > 2) return;
    out.push(w);
  });
  return out
    .map((w) => (w === w.toUpperCase() && /\p{L}{4,}/u.test(w) && !SIGLAS.has(w) ? capitalizar(w) : w))
    .join(' ')
    .replace(/^(\p{Ll})/u, (c) => c.toUpperCase());
}

const BAIXO_VALOR = new Set(('liso lisa lisos lisas simples basico basica pratico pratica praticos moderno moderna elegante resistente ideal bonito bonita linha estilo design').split(' '));

function cortar(s: string, max: number): string {
  const ws = s.split(' ');
  const tam = () => ws.join(' ').length;
  const protegida = (j: number) => j < 3 || /\d/.test(ws[j]);
  while (tam() > max && ws.length > 1) {
    let i = -1;
    for (let j = ws.length - 1; j >= 3; j--) if (!protegida(j) && BAIXO_VALOR.has(semAcento(ws[j].toLowerCase()))) { i = j; break; }
    if (i < 0) for (let j = ws.length - 1; j >= 3; j--) if (!protegida(j) && !STOP.has(ws[j].toLowerCase())) { i = j; break; }
    if (i < 0) i = ws.length - 1;
    ws.splice(i, 1);
    for (let j = ws.length - 1; j >= 1; j--) {
      const entreNumeros = /\d$/.test(ws[j - 1]) && j + 1 < ws.length && /^\d/.test(ws[j + 1]);
      if (!entreNumeros && STOP.has(ws[j].toLowerCase()) && (j === ws.length - 1 || STOP.has(ws[j + 1].toLowerCase()) || /^\d/.test(ws[j + 1]))) ws.splice(j, 1);
    }
  }
  while (ws.length > 1 && STOP.has(ws[ws.length - 1].toLowerCase())) ws.pop();
  return ws.join(' ').replace(/\s+/g, ' ').trim();
}

/** Título sugerido (até 60 caracteres) a partir do nome do fornecedor. */
export function sugerirTitulo(nome: string, q = 1): string {
  let s = limpar(nome);
  if (q > 1 && !new RegExp('^kit\\s*' + q + '\\b', 'i').test(s)) {
    s = s.replace(/^kit\s*\d*\s*/i, '');
    s = `Kit ${q} ` + pluralPrimeira(s);
  }
  return cortar(s, LIMITE_TITULO);
}
