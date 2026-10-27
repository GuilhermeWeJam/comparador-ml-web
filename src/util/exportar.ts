// Exportação dos itens (aprovados ou lista filtrada) em .csv e .xlsx, com os dados para cadastrar o anúncio.
import type { Linha } from '../dados/linhas';
import { VEREDITOS } from '../nucleo/analise';
import { sugerirTitulo } from '../nucleo/titulo';
import { escreverCsv, escreverXlsx } from '../nucleo/xlsx';

const SITUACAO: Record<string, string> = { sem_decisao: 'Sem decisão', aprovado: 'Aprovado', reprovado: 'Reprovado', adiado: 'Adiado' };
const r2 = (v: number | undefined | null) => (v !== null && v !== undefined && Number.isFinite(v) ? Math.round(v * 100) / 100 : null);
const p1 = (v: number | undefined | null) => (v !== null && v !== undefined && Number.isFinite(v) ? Math.round(v * 1000) / 10 : null);

export const CABECALHO = [
  'Tipo', 'Unidades', 'SKU', 'Item', 'Título sugerido', 'Nome no fornecedor', 'Categoria', 'Categoria ML', 'Fornecedor', 'UF',
  'Custo', 'Comissão Clássico (%)', 'Comissão Premium (%)', 'Venda Clássico', 'Lucro Clássico', 'Venda Premium', 'Lucro Premium',
  'Preço mínimo Clássico', 'Preço mínimo Premium', 'Frete no Clássico', 'Peso para frete (kg)',
  'Nota de triagem', 'Preço de referência', 'Margem na referência (%)', 'Nota de decisão', 'Veredito', 'Motivo do veredito',
  'Decisão', 'Motivo da decisão', 'Decidido por', 'Data da decisão', 'Potencial',
  'EAN', 'NCM', 'CEST', 'Largura (cm)', 'Altura (cm)', 'Comprimento (cm)', 'Peso real (kg)', 'Foto', 'Alertas',
];

export function linhasParaPlanilha(linhas: Linha[]): (string | number | null)[][] {
  const out: (string | number | null)[][] = [CABECALHO];
  for (const l of linhas) {
    const p = l.item.produto;
    const a = l.a;
    out.push([
      l.item.q > 1 ? 'Kit' : 'Unidade', l.item.q, p.sku, l.id,
      l.anot?.titulo || sugerirTitulo(l.item.q > 1 ? l.item.nome : p.nome, l.item.q),
      p.nome, p.categoria, a.comissao.categoriaMl, p.fornecedor, p.uf,
      r2(l.item.custo), p1(a.comissao.classico), p1(a.comissao.premium),
      r2(a.classico.preco), r2(a.classico.conta.lucro), r2(a.premium.preco), r2(a.premium.conta.lucro),
      r2(a.classico.minimo), r2(a.premium.minimo), r2(a.classico.conta.envio), l.item.peso,
      a.triagem.total, r2(l.d?.precoRef), p1(l.d?.conta?.margem), l.d ? l.d.nota.total : null,
      l.d ? VEREDITOS[l.d.veredito].rotulo : null, l.d?.motivo || null,
      SITUACAO[l.situacao], l.dec ? [l.dec.motivo, l.dec.motivoDetalhe].filter(Boolean).join(' — ') : null,
      l.dec?.criadoPor || null, l.dec?.criadoEm ? l.dec.criadoEm.slice(0, 10) : null, l.potencial ? 'Sim' : 'Não',
      p.ean, p.ncm, p.cest, p.dims?.[0] ?? null, p.dims?.[1] ?? null, p.dims?.[2] ?? null, p.pesoKg, p.imagemUrl,
      a.alertas.map((x) => x.tipo).join(', '),
    ]);
  }
  return out;
}

export function baixar(blob: Blob, nome: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function exportar(linhas: Linha[], formato: 'csv' | 'xlsx', nomeBase: string) {
  const dados = linhasParaPlanilha(linhas);
  const hoje = new Date().toISOString().slice(0, 10);
  if (formato === 'csv') baixar(escreverCsv(dados), `${nomeBase}-${hoje}.csv`);
  else baixar(escreverXlsx(nomeBase.slice(0, 31), dados), `${nomeBase}-${hoje}.xlsx`);
}
