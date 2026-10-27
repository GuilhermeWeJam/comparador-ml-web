// Leitura da planilha do fornecedor (modelo com 17 colunas, aba "Produtos").
import { lerXlsx } from './xlsx';
import type { Dims } from './tipos';

export interface LinhaCatalogo {
  sku: string;
  nome: string;
  marca: string;
  categoria: string;
  fornecedor: string;
  uf: string;
  disponivel: boolean;
  custo: number;
  pesoKg: number | null;
  pesoCaixaKg: number | null;
  dims: Dims | null;
  ean: string;
  ncm: string;
  cest: string;
  imagemUrl: string;
}

export interface LeituraCatalogo {
  aba: string;
  linhas: LinhaCatalogo[];
  totalLinhas: number;
  repetidos: string[];
  semCusto: number;
  pesoZero: string[];
  pesoEmGramas: number;
}

const OBRIGATORIAS = ['SKU', 'Nome do Produto', 'Preço'];

const txt = (v: unknown) => (v === null || v === undefined ? '' : String(v).trim());

/** Número de célula: aceita número, "1.234,56" e "1234.56". */
export function num(v: unknown): number {
  if (typeof v === 'number') return v;
  if (v === null || v === undefined || v === '') return NaN;
  const s = String(v).replace(/R\$\s?/, '').trim();
  return /,\d{1,2}$/.test(s) ? Number(s.replace(/\./g, '').replace(',', '.')) : Number(s);
}

/** Código numérico (EAN, NCM, CEST) sem ".0" e sem notação científica. */
function codigo(v: unknown): string {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'number') return Number.isInteger(v) ? v.toFixed(0) : String(v);
  return String(v).trim().replace(/\.0+$/, '');
}

export async function lerCatalogo(arquivo: ArrayBuffer): Promise<LeituraCatalogo> {
  const pasta = await lerXlsx(arquivo);
  const ordem = [...pasta.abas.filter((a) => a === 'Produtos'), ...pasta.abas.filter((a) => a !== 'Produtos')];
  for (const aba of ordem) {
    const linhas = await pasta.lerAba(aba);
    if (!linhas) continue;
    for (let i = 0; i < Math.min(15, linhas.length); i++) {
      const cab = (linhas[i] || []).map(txt);
      if (!OBRIGATORIAS.every((o) => cab.includes(o))) continue;
      const m: Record<string, number> = {};
      cab.forEach((nome, j) => { if (nome && !(nome in m)) m[nome] = j; });
      return converter(aba, linhas.slice(i + 1), m);
    }
  }
  throw new Error('Não encontrei as colunas "SKU", "Nome do Produto" e "Preço". Use a planilha do fornecedor (modelo com a aba Produtos).');
}

function converter(aba: string, linhas: unknown[][], m: Record<string, number>): LeituraCatalogo {
  const col = (l: unknown[], nome: string) => (nome in m ? l[m[nome]] : null);
  const vistos = new Set<string>();
  const repetidos: string[] = [];
  const pesoZero: string[] = [];
  let semCusto = 0;
  let pesoEmGramas = 0;
  let totalLinhas = 0;
  const out: LinhaCatalogo[] = [];
  for (const l of linhas) {
    if (!l || !l.some((v) => v !== null && v !== undefined && v !== '')) continue;
    totalLinhas++;
    const sku = txt(col(l, 'SKU'));
    if (!sku) continue;
    if (vistos.has(sku)) { repetidos.push(sku); continue; }
    vistos.add(sku);
    const custo = num(col(l, 'Preço'));
    if (!(custo > 0)) { semCusto++; continue; }
    // a coluna de peso mistura gramas e kg: acima de 30 é lida como gramas
    let peso = num(col(l, 'Peso (kg)'));
    if (Number.isFinite(peso) && peso > 30) { peso = peso / 1000; pesoEmGramas++; }
    const pesoKg = Number.isFinite(peso) && peso > 0 ? Math.round(peso * 1000) / 1000 : null;
    if (pesoKg === null) pesoZero.push(sku);
    const caixa = num(col(l, 'Peso da Caixa (kg)'));
    const pesoCaixaKg = Number.isFinite(caixa) && caixa > 0 ? Math.round((caixa > 30 ? caixa / 1000 : caixa) * 1000) / 1000 : null;
    const d = ['Largura (cm)', 'Altura (cm)', 'Comprimento (cm)'].map((c) => num(col(l, c)));
    const dims: Dims | null = d.some((x) => Number.isFinite(x) && x > 0) ? (d.map((x) => (Number.isFinite(x) && x > 0 ? x : 0)) as Dims) : null;
    const disp = txt(col(l, 'Disponibilidade'));
    out.push({
      sku,
      nome: txt(col(l, 'Nome do Produto')),
      marca: txt(col(l, 'Marca')),
      categoria: txt(col(l, 'Categoria')),
      fornecedor: txt(col(l, 'Fornecedor')),
      uf: txt(col(l, 'Estado do Fornecedor')).toUpperCase(),
      disponivel: disp ? /^dispon/i.test(disp) : true,
      custo: Math.round(custo * 100) / 100,
      pesoKg,
      pesoCaixaKg,
      dims,
      ean: codigo(col(l, 'EAN')),
      ncm: codigo(col(l, 'NCM')),
      cest: codigo(col(l, 'CEST')),
      imagemUrl: txt(col(l, 'Imagem Principal')),
    });
  }
  return { aba, linhas: out, totalLinhas, repetidos, semCusto, pesoZero, pesoEmGramas };
}
