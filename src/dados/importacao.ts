// Importação da planilha do fornecedor: compara com o banco, mostra o resumo e grava em lotes.
import { lerCatalogo, type LeituraCatalogo, type LinhaCatalogo } from '../nucleo/importar';
import { linhaDoCatalogo } from './mapear';
import { lerTudo, supabase } from './supabase';

interface Existente {
  sku: string;
  nome: string;
  custo: number;
  custoAnterior: number | null;
  custoMudouImportacao: string | null;
  disponivel: boolean;
  naPlanilha: boolean;
  origem: 'planilha' | 'manual';
  primeiraImportacaoId: string | null;
}

export interface MudancaCusto {
  linha: LinhaCatalogo;
  antes: number;
}

export interface Resumo {
  nomeArquivo: string;
  totalLinhas: number;
  lidos: number;
  disponiveis: number;
  primeiraVez: boolean;
  novos: LinhaCatalogo[];
  custoSubiu: MudancaCusto[];
  custoCaiu: MudancaCusto[];
  ficaramIndisponiveis: LinhaCatalogo[];
  voltaram: LinhaCatalogo[];
  sumiram: { sku: string; nome: string }[];
  repetidos: string[];
  pesoZero: string[];
  semCusto: number;
  pesoEmGramas: number;
  categoriasNovas: string[];
  conflitosManuais: string[];
}

export interface Preparacao {
  arquivo: File;
  leitura: LeituraCatalogo;
  existentes: Map<string, Existente>;
  resumo: Resumo;
}

export async function prepararImportacao(arquivo: File, categoriasConhecidas: Set<string>): Promise<Preparacao> {
  const leitura = await lerCatalogo(await arquivo.arrayBuffer());
  const linhas = await lerTudo(() =>
    supabase.from('produtos').select('sku,nome,custo,custo_anterior,custo_mudou_importacao,disponivel,na_planilha,origem,primeira_importacao_id').order('sku'),
  );
  const existentes = new Map<string, Existente>();
  for (const r of linhas as Record<string, unknown>[]) {
    existentes.set(String(r.sku), {
      sku: String(r.sku),
      nome: String(r.nome || ''),
      custo: Number(r.custo),
      custoAnterior: r.custo_anterior === null || r.custo_anterior === undefined ? null : Number(r.custo_anterior),
      custoMudouImportacao: (r.custo_mudou_importacao as string) || null,
      disponivel: !!r.disponivel,
      naPlanilha: r.na_planilha !== false,
      origem: r.origem === 'manual' ? 'manual' : 'planilha',
      primeiraImportacaoId: (r.primeira_importacao_id as string) || null,
    });
  }
  const resumo: Resumo = {
    nomeArquivo: arquivo.name,
    totalLinhas: leitura.totalLinhas,
    lidos: leitura.linhas.length,
    disponiveis: leitura.linhas.filter((l) => l.disponivel).length,
    primeiraVez: ![...existentes.values()].some((e) => e.origem === 'planilha'),
    novos: [], custoSubiu: [], custoCaiu: [], ficaramIndisponiveis: [], voltaram: [], sumiram: [],
    repetidos: leitura.repetidos,
    pesoZero: leitura.pesoZero,
    semCusto: leitura.semCusto,
    pesoEmGramas: leitura.pesoEmGramas,
    categoriasNovas: [],
    conflitosManuais: [],
  };
  const naPlanilha = new Set<string>();
  const cats = new Set<string>();
  for (const l of leitura.linhas) {
    naPlanilha.add(l.sku);
    if (l.categoria) cats.add(l.categoria);
    const e = existentes.get(l.sku);
    if (!e) { resumo.novos.push(l); continue; }
    if (e.origem === 'manual') { resumo.conflitosManuais.push(l.sku); continue; }
    if (l.custo > e.custo + 0.004) resumo.custoSubiu.push({ linha: l, antes: e.custo });
    else if (l.custo < e.custo - 0.004) resumo.custoCaiu.push({ linha: l, antes: e.custo });
    if (e.disponivel && e.naPlanilha && !l.disponivel) resumo.ficaramIndisponiveis.push(l);
    if ((!e.disponivel || !e.naPlanilha) && l.disponivel) resumo.voltaram.push(l);
  }
  for (const e of existentes.values()) if (e.origem === 'planilha' && e.naPlanilha && !naPlanilha.has(e.sku)) resumo.sumiram.push({ sku: e.sku, nome: e.nome });
  resumo.categoriasNovas = [...cats].filter((c) => !categoriasConhecidas.has(c)).sort();
  return { arquivo, leitura, existentes, resumo };
}

const contagens = (r: Resumo) => ({
  arquivo: r.nomeArquivo, linhas: r.totalLinhas, lidos: r.lidos, disponiveis: r.disponiveis, novos: r.novos.length,
  custo_subiu: r.custoSubiu.length, custo_caiu: r.custoCaiu.length, ficaram_indisponiveis: r.ficaramIndisponiveis.length,
  voltaram: r.voltaram.length, sumiram: r.sumiram.length, repetidos: r.repetidos.length, peso_zero: r.pesoZero.length,
  sem_custo: r.semCusto, categorias_novas: r.categoriasNovas, conflitos_manuais: r.conflitosManuais.length,
});

export async function gravarImportacao(prep: Preparacao, progresso: (texto: string, fracao: number) => void): Promise<string> {
  const { resumo, leitura, existentes, arquivo } = prep;
  progresso('Registrando a importação…', 0.02);
  const { data: imp, error: e1 } = await supabase.from('importacoes')
    .insert({ nome_arquivo: arquivo.name, total: resumo.lidos, disponiveis: resumo.disponiveis, resumo: contagens(resumo) })
    .select().single();
  if (e1) throw new Error(e1.message);
  const id = String(imp.id);

  progresso('Guardando o arquivo original…', 0.05);
  const caminho = `${id}.xlsx`;
  const { error: eUp } = await supabase.storage.from('planilhas').upload(caminho, arquivo, { upsert: true, contentType: arquivo.type || 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  if (!eUp) await supabase.from('importacoes').update({ arquivo: caminho }).eq('id', id);

  if (resumo.categoriasNovas.length) {
    const { error } = await supabase.from('categorias')
      .upsert(resumo.categoriasNovas.map((nome) => ({ nome, categoria_ml: null, epoca: 'normal' })), { onConflict: 'nome', ignoreDuplicates: true });
    if (error) throw new Error(error.message);
  }

  const manuais = new Set(resumo.conflitosManuais);
  const linhas = leitura.linhas.filter((l) => !manuais.has(l.sku)).map((l) => {
    const e = existentes.get(l.sku);
    const mudou = !!e && Math.abs(e.custo - l.custo) > 0.004;
    return {
      ...linhaDoCatalogo(l),
      custo_anterior: mudou ? e!.custo : e?.custoAnterior ?? null,
      custo_mudou_importacao: mudou ? id : e?.custoMudouImportacao ?? null,
      importacao_id: id,
      primeira_importacao_id: e?.primeiraImportacaoId ?? id,
    };
  });
  const lote = 500;
  for (let i = 0; i < linhas.length; i += lote) {
    progresso(`Gravando produtos (${Math.min(i + lote, linhas.length).toLocaleString('pt-BR')} de ${linhas.length.toLocaleString('pt-BR')})…`, 0.1 + 0.8 * (i / linhas.length));
    const { error } = await supabase.from('produtos').upsert(linhas.slice(i, i + lote), { onConflict: 'sku' });
    if (error) throw new Error(`Erro ao gravar produtos: ${error.message}`);
  }

  const sumiram = resumo.sumiram.map((s) => s.sku);
  for (let i = 0; i < sumiram.length; i += 200) {
    progresso('Marcando os que saíram da planilha…', 0.92);
    const { error } = await supabase.from('produtos').update({ na_planilha: false }).in('sku', sumiram.slice(i, i + 200));
    if (error) throw new Error(error.message);
  }
  progresso('Pronto.', 1);
  return id;
}

export async function linkDoArquivo(caminho: string): Promise<string | null> {
  const { data, error } = await supabase.storage.from('planilhas').createSignedUrl(caminho, 120);
  if (error || !data) return null;
  return data.signedUrl;
}
