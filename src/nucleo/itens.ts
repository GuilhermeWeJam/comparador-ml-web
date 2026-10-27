import { pesoFrete } from './calc';
import type { Item, Produto } from './tipos';

export const SEP_KIT = '::kit';

export const idKit = (sku: string, q: number) => (q > 1 ? `${sku}${SEP_KIT}${q}` : sku);

export function lerItemId(id: string): { sku: string; q: number } {
  const i = id.lastIndexOf(SEP_KIT);
  if (i < 0) return { sku: id, q: 1 };
  return { sku: id.slice(0, i), q: parseInt(id.slice(i + SEP_KIT.length), 10) || 1 };
}

/** Termo de busca a partir do nome do produto: tira o "WeDrop -", a cor do fim e os símbolos. */
export function termoBusca(nome: string): string {
  return String(nome || '')
    .replace(/^\s*we ?drop\s*-?\s*/i, '')
    .replace(/\s+-\s+[^-]+$/, '')
    .replace(/[^\p{L}\p{N}\s,]/gu, ' ')
    .replace(/,(?!\d)/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Coloca a primeira palavra no plural ("Pote Hermético" → "Potes Hermético"). */
export function pluralPrimeira(nome: string): string {
  const m = nome.match(/^(\S+)(.*)$/);
  if (!m) return nome;
  let w = m[1];
  const low = w.toLowerCase();
  if (/s$/.test(low)) return nome;
  if (/ão$/.test(low)) w = w.slice(0, -2) + 'ões';
  else if (/[aeiouáéíóú]$/.test(low)) w = w + 's';
  else if (/[rz]$/.test(low)) w = w + 'es';
  else if (/m$/.test(low)) w = w.slice(0, -1) + 'ns';
  else return nome;
  return w + m[2];
}

/** Monta o item (unidade ou kit de q unidades) a partir do produto. */
export function montarItem(p: Produto, q = 1): Item {
  const pesoUnit = pesoFrete(p.pesoKg, p.pesoCaixaKg, p.dims);
  if (q <= 1) {
    return { id: p.sku, sku: p.sku, q: 1, nome: p.nome, nomeOriginal: p.nome, produto: p, custo: p.custo, peso: pesoUnit, custoUnit: p.custo, pesoUnit };
  }
  // só tira um "Kit N" do começo; "Jogo de Panelas" vira "Kit 2 Jogos de Panelas"
  const base = termoBusca(p.nome).replace(/^kit\s*\d*\s*(de\s+|com\s+)?/i, '');
  return {
    id: idKit(p.sku, q),
    sku: p.sku,
    q,
    nome: `Kit ${q} ${pluralPrimeira(base)}`,
    nomeOriginal: p.nome,
    produto: p,
    custo: Math.round(p.custo * q * 100) / 100,
    peso: Math.round(pesoUnit * q * 1000) / 1000,
    custoUnit: p.custo,
    pesoUnit,
  };
}

/** Link da busca no Mercado Livre para o item (kits buscam "Kit N ..."). */
export function urlBusca(item: Pick<Item, 'nome' | 'q'>): string {
  const termo = termoBusca(item.nome).toLowerCase().replace(/,/g, ' ').trim().replace(/\s+/g, '-');
  return 'https://lista.mercadolivre.com.br/' + encodeURIComponent(termo).replace(/%2D/gi, '-');
}
