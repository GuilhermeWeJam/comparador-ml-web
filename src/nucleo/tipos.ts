// Tipos compartilhados pelo núcleo de cálculo (sem React e sem Supabase).

export type TipoAnuncio = 'classico' | 'premium';

/** Premissas de uma conta de venda. A comissão já vem resolvida (da categoria e do tipo de anúncio). */
export interface Premissas {
  margemDesejada: number;
  margemMinima: number;
  comissao: number;
  imposto: number;
  reserva: number;
  ads: number;
}

/** Configurações gerais do sistema (linha única da tabela `configuracoes`). */
export interface Configuracoes {
  margemDesejada: number;
  margemMinima: number;
  imposto: number;
  reserva: number;
  ads: number;
  tipoAnuncioPadrao: TipoAnuncio;
  ocultarAcimaDoLado: boolean;
  ladoMaxCm: number;
  validadePesquisaDias: number;
  pesos: Pesos;
}

/** Pesos e limites das notas (editáveis em Configurações). */
export interface Pesos {
  triagem: { lucro: number; frete: number; logistica: number; risco: number; epoca: number; comissao: number };
  decisao: { margem: number; demanda: number; concorrencia: number; risco: number };
  faixas: { alta: number; media: number };
  veredito: { anunciar: number; testar: number; descontoMax: number };
}

export interface TabelaFrete {
  versao?: string;
  precoIni: number[];
  pesoIni: number[];
  valores: number[][];
}

export interface ComissaoMl {
  categoriaMl: string;
  classico: number;
  premium: number;
  padrao: boolean;
}

export type Epoca = 'alta' | 'normal' | 'baixa';

export interface Categoria {
  nome: string;
  categoriaMl: string | null;
  epoca: Epoca;
}

export type Dims = [number, number, number];

/** Produto como fica no sistema (planilha ou cadastro manual). */
export interface Produto {
  sku: string;
  nome: string;
  marca: string;
  categoria: string;
  fornecedor: string;
  uf: string;
  disponivel: boolean;
  naPlanilha: boolean;
  origem: 'planilha' | 'manual';
  ativo: boolean;
  custo: number;
  custoAnterior: number | null;
  custoMudouImportacao: string | null;
  pesoKg: number | null;
  pesoCaixaKg: number | null;
  dims: Dims | null;
  ean: string;
  ncm: string;
  cest: string;
  imagemUrl: string;
  importacaoId: string | null;
  primeiraImportacaoId: string | null;
  criadoEm?: string;
}

/** Unidade ou kit: o que é pesquisado, decidido e exportado. */
export interface Item {
  id: string; // "SKU" ou "SKU::kitN"
  sku: string;
  q: number;
  nome: string;
  nomeOriginal: string;
  produto: Produto;
  custo: number;
  peso: number; // peso para frete (maior entre real e cúbico), já multiplicado no kit
  custoUnit: number;
  pesoUnit: number;
}

export type NivelAlerta = 'bloqueio' | 'atencao' | 'info';
export interface Alerta {
  nivel: NivelAlerta;
  tipo: string;
  texto: string;
}

export type Concorrentes = '1-3' | '4-10' | '10+';

export interface Pesquisa {
  id?: number;
  itemId: string;
  naoEncontrado: boolean;
  menorPreco: number | null;
  precoMaisVendido: number | null;
  vendidosMaisVendido: number | null;
  concorrentes: Concorrentes | null;
  temFull: boolean | null;
  temOficial: boolean | null;
  qtdNoAnuncio: number | null;
  link: string;
  observacao: string;
  origem: 'manual' | 'plugin';
  segundosGastos: number | null;
  criadoPor?: string;
  criadoEm?: string;
}

export type TipoDecisao = 'aprovado' | 'reprovado' | 'adiado' | 'desfeita';

export interface Decisao {
  id?: number;
  itemId: string;
  decisao: TipoDecisao;
  motivo: string;
  motivoDetalhe: string;
  revisarEm: string | null;
  custoMomento: number | null;
  notaTriagemMomento: number | null;
  notaDecisaoMomento: number | null;
  vereditoMomento: string | null;
  criadoPor?: string;
  criadoEm?: string;
}

export interface Anotacao {
  itemId: string;
  potencial: boolean;
  titulo: string | null;
  kitQtd: number | null;
  kitMontado: boolean;
}
