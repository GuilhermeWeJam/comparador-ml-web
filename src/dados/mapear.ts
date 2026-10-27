// Conversão entre as linhas do banco (snake_case) e os tipos do sistema (camelCase).
import { CONFIG_PADRAO, PESOS_PADRAO } from '../nucleo/analise';
import type { LinhaCatalogo } from '../nucleo/importar';
import type { Anotacao, Categoria, ComissaoMl, Configuracoes, Decisao, Dims, Pesquisa, Pesos, Produto, TabelaFrete } from '../nucleo/tipos';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Linha = Record<string, any>;

const n = (v: unknown): number | null => (v === null || v === undefined || v === '' ? null : Number(v));

export function produtoDe(r: Linha): Produto {
  const d = [n(r.largura_cm), n(r.altura_cm), n(r.comprimento_cm)];
  const dims: Dims | null = d.some((x) => x && x > 0) ? (d.map((x) => x || 0) as Dims) : null;
  return {
    sku: r.sku,
    nome: r.nome,
    marca: r.marca || '',
    categoria: r.categoria || '',
    fornecedor: r.fornecedor || '',
    uf: r.uf || '',
    disponivel: !!r.disponivel,
    naPlanilha: r.na_planilha !== false,
    origem: r.origem === 'manual' ? 'manual' : 'planilha',
    ativo: r.ativo !== false,
    custo: Number(r.custo),
    custoAnterior: n(r.custo_anterior),
    custoMudouImportacao: r.custo_mudou_importacao || null,
    pesoKg: n(r.peso_kg),
    pesoCaixaKg: n(r.peso_caixa_kg),
    dims,
    ean: r.ean || '',
    ncm: r.ncm || '',
    cest: r.cest || '',
    imagemUrl: r.imagem_url || '',
    importacaoId: r.importacao_id || null,
    primeiraImportacaoId: r.primeira_importacao_id || null,
    criadoEm: r.criado_em,
  };
}

/** Colunas que vêm da planilha do fornecedor (o resto — decisões, títulos — nunca é tocado pela importação). */
export function linhaDoCatalogo(l: LinhaCatalogo): Linha {
  return {
    sku: l.sku,
    nome: l.nome,
    marca: l.marca,
    categoria: l.categoria,
    fornecedor: l.fornecedor,
    uf: l.uf,
    disponivel: l.disponivel,
    na_planilha: true,
    origem: 'planilha',
    custo: l.custo,
    peso_kg: l.pesoKg,
    peso_caixa_kg: l.pesoCaixaKg,
    largura_cm: l.dims ? l.dims[0] : null,
    altura_cm: l.dims ? l.dims[1] : null,
    comprimento_cm: l.dims ? l.dims[2] : null,
    ean: l.ean,
    ncm: l.ncm,
    cest: l.cest,
    imagem_url: l.imagemUrl,
  };
}

export function linhaDoProduto(p: Partial<Produto>): Linha {
  const out: Linha = {};
  if (p.sku !== undefined) out.sku = p.sku;
  if (p.nome !== undefined) out.nome = p.nome;
  if (p.marca !== undefined) out.marca = p.marca;
  if (p.categoria !== undefined) out.categoria = p.categoria;
  if (p.fornecedor !== undefined) out.fornecedor = p.fornecedor;
  if (p.uf !== undefined) out.uf = p.uf;
  if (p.disponivel !== undefined) out.disponivel = p.disponivel;
  if (p.origem !== undefined) out.origem = p.origem;
  if (p.ativo !== undefined) out.ativo = p.ativo;
  if (p.custo !== undefined) out.custo = p.custo;
  if (p.pesoKg !== undefined) out.peso_kg = p.pesoKg;
  if (p.dims !== undefined) {
    out.largura_cm = p.dims ? p.dims[0] : null;
    out.altura_cm = p.dims ? p.dims[1] : null;
    out.comprimento_cm = p.dims ? p.dims[2] : null;
  }
  if (p.ean !== undefined) out.ean = p.ean;
  if (p.ncm !== undefined) out.ncm = p.ncm;
  if (p.imagemUrl !== undefined) out.imagem_url = p.imagemUrl;
  return out;
}

function pesosDe(v: unknown): Pesos {
  const p = (v && typeof v === 'object' ? v : {}) as Partial<Pesos>;
  return {
    triagem: { ...PESOS_PADRAO.triagem, ...(p.triagem || {}) },
    decisao: { ...PESOS_PADRAO.decisao, ...(p.decisao || {}) },
    faixas: { ...PESOS_PADRAO.faixas, ...(p.faixas || {}) },
    veredito: { ...PESOS_PADRAO.veredito, ...(p.veredito || {}) },
  };
}

export function configDe(r: Linha | null): Configuracoes {
  if (!r) return CONFIG_PADRAO;
  return {
    margemDesejada: Number(r.margem_desejada),
    margemMinima: Number(r.margem_minima),
    imposto: Number(r.imposto),
    reserva: Number(r.reserva),
    ads: Number(r.ads),
    tipoAnuncioPadrao: r.tipo_anuncio_padrao === 'premium' ? 'premium' : 'classico',
    ocultarAcimaDoLado: r.ocultar_acima_do_lado !== false,
    ladoMaxCm: Number(r.lado_max_cm),
    validadePesquisaDias: Number(r.validade_pesquisa_dias) || 30,
    pesoFreteModo: r.peso_frete_modo === 'cubico' ? 'cubico' : 'real',
    pesos: pesosDe(r.pesos),
  };
}

export function linhaDaConfig(c: Configuracoes): Linha {
  return {
    margem_desejada: c.margemDesejada,
    margem_minima: c.margemMinima,
    imposto: c.imposto,
    reserva: c.reserva,
    ads: c.ads,
    tipo_anuncio_padrao: c.tipoAnuncioPadrao,
    ocultar_acima_do_lado: c.ocultarAcimaDoLado,
    lado_max_cm: c.ladoMaxCm,
    validade_pesquisa_dias: c.validadePesquisaDias,
    peso_frete_modo: c.pesoFreteModo,
    pesos: c.pesos,
  };
}

export const comissaoDe = (r: Linha): ComissaoMl => ({ categoriaMl: r.categoria_ml, classico: Number(r.classico), premium: Number(r.premium), padrao: !!r.padrao });
export const categoriaDe = (r: Linha): Categoria => ({ nome: r.nome, categoriaMl: r.categoria_ml || null, epoca: r.epoca || 'normal' });

export function freteDe(r: Linha | null): TabelaFrete | null {
  if (!r || !Array.isArray(r.valores)) return null;
  return { versao: r.versao, precoIni: r.preco_ini.map(Number), pesoIni: r.peso_ini.map(Number), valores: r.valores };
}

export const pesquisaDe = (r: Linha): Pesquisa => ({
  id: r.id,
  itemId: r.item_id,
  naoEncontrado: !!r.nao_encontrado,
  menorPreco: n(r.menor_preco),
  precoMaisVendido: n(r.preco_mais_vendido),
  vendidosMaisVendido: n(r.vendidos_mais_vendido),
  concorrentes: r.concorrentes || null,
  temFull: r.tem_full ?? null,
  temOficial: r.tem_oficial ?? null,
  qtdNoAnuncio: n(r.qtd_no_anuncio),
  link: r.link || '',
  observacao: r.observacao || '',
  origem: r.origem === 'plugin' ? 'plugin' : 'manual',
  segundosGastos: n(r.segundos_gastos),
  criadoPor: r.criado_por,
  criadoEm: r.criado_em,
});

export const linhaDaPesquisa = (p: Pesquisa): Linha => ({
  item_id: p.itemId,
  nao_encontrado: p.naoEncontrado,
  menor_preco: p.naoEncontrado ? null : p.menorPreco,
  preco_mais_vendido: p.precoMaisVendido,
  vendidos_mais_vendido: p.vendidosMaisVendido,
  concorrentes: p.concorrentes,
  tem_full: p.temFull,
  tem_oficial: p.temOficial,
  qtd_no_anuncio: p.qtdNoAnuncio,
  link: p.link,
  observacao: p.observacao,
  origem: p.origem,
  segundos_gastos: p.segundosGastos,
});

export const decisaoDe = (r: Linha): Decisao => ({
  id: r.id,
  itemId: r.item_id,
  decisao: r.decisao,
  motivo: r.motivo || '',
  motivoDetalhe: r.motivo_detalhe || '',
  revisarEm: r.revisar_em || null,
  custoMomento: n(r.custo_momento),
  notaTriagemMomento: n(r.nota_triagem_momento),
  notaDecisaoMomento: n(r.nota_decisao_momento),
  vereditoMomento: r.veredito_momento || null,
  criadoPor: r.criado_por,
  criadoEm: r.criado_em,
});

export const linhaDaDecisao = (d: Decisao): Linha => ({
  item_id: d.itemId,
  decisao: d.decisao,
  motivo: d.motivo,
  motivo_detalhe: d.motivoDetalhe,
  revisar_em: d.revisarEm,
  custo_momento: d.custoMomento,
  nota_triagem_momento: d.notaTriagemMomento,
  nota_decisao_momento: d.notaDecisaoMomento,
  veredito_momento: d.vereditoMomento,
});

export const anotacaoDe = (r: Linha): Anotacao => ({
  itemId: r.item_id,
  potencial: !!r.potencial,
  titulo: r.titulo ?? null,
  kitQtd: n(r.kit_qtd),
  kitMontado: !!r.kit_montado,
});

export const linhaDaAnotacao = (a: Anotacao): Linha => ({
  item_id: a.itemId,
  potencial: a.potencial,
  titulo: a.titulo,
  kit_qtd: a.kitQtd,
  kit_montado: a.kitMontado,
});
