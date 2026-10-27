// Kits e venda em 2+ unidades (mesma regra do plugin 1.5.1).
// Abaixo de R$ 79 o ML cobra um custo fixo de envio por venda. Num produto barato, esse custo pesa muito;
// vendendo 2, 3 ou mais unidades juntas, ele é dividido.
import { maiorLadoKit, precoParaMargem } from './calc';
import { montarItem } from './itens';
import type { Premissas, Produto, TabelaFrete } from './tipos';

const CATEGORIAS_KIT = new Set([
  'Potes, Marmitas e Mantimentos', 'Copos, Jarras e Servir', 'Utensílios e Talheres', 'Organizadores e Cestos',
  'Guarda-roupa e Cabides', 'Lavanderia', 'Limpeza da Casa', 'Organização', 'Cozinha', 'Prateleiras e Suportes',
  'Garrafas e Térmicas', 'Utilidades Domésticas', 'Iluminação Natalina', 'Árvores e Enfeites', 'Natal e Festas',
  'Festas e Balões', 'Acessórios de Banheiro', 'Higiene Pet', 'Comedouros e Bebedouros', 'Material Escolar',
  'Escritório', 'Papelaria e Escritório', 'Cortinas, Almofadas e Mantas', 'Box e Tapetes',
]);

const CATEGORIAS_NAO_KIT = new Set([
  'Passeio e Elétricos', 'Eletroportáteis', 'Eletroportáteis de Cozinha', 'Eletrônicos e Acessórios', 'Bike e Patins',
  'Climatização', 'Bebês', 'Fantasias', 'Bolsas e Malas de Viagem', 'Mochilas, Estojos e Lancheiras',
  'Calçados e Pantufas', 'Panelas e Frigideiras', 'Bonecas e Casinhas', 'Carrinhos e Pistas', 'Jogos e Educativos',
  'Brinquedos', 'Acessórios para Elétricas', 'Ferramentas Manuais', 'Fitness', 'Inverno', 'Cadernos', 'Capas e Protetores',
]);

const RE_MULTIPLO = new RegExp('\\b(' + [
  'potes?', 'potinhos?', 'copos?', 'taças?', 'tacas?', 'xícaras?', 'xicaras?', 'canecas?', 'pratos?', 'tigelas?', 'bowls?',
  'colher(es)?', 'garfos?', 'talher(es)?', 'cabides?', 'prendedor(es)?', 'pregador(es)?', 'ganchos?', 'organizador(es)?',
  'cestos?', 'caixas? organizadoras?', 'panos?', 'toalhas?', 'flanelas?', 'esponjas?', 'refil', 'refis', 'lâmpadas?', 'lampadas?',
  'velas?', 'pilhas?', 'filtros?', 'sacos?', 'sacolas?', 'etiquetas?', 'marcador(es)?', 'canetas?', 'lápis', 'lapis',
  'borrachas?', 'apontador(es)?', 'pincéis', 'pincel', 'forminhas?', 'formas?', 'garrafas?', 'squeezes?', 'marmitas?',
  'fronhas?', 'meias?', 'presilhas?', 'elásticos?', 'adesivos?', 'fitas?', 'lixas?', 'buchas?', 'abraçadeiras?',
  'porta[- ]copos?', 'descansos?', 'jogos? americanos?', 'guardanapos?', 'bandejas?', 'baldes?', 'tampas?',
  'pegador(es)?', 'espátulas?', 'espatulas?', 'escovas?', 'tapetes?', 'capas? de almofada', 'almofadas?',
  'bolas? de natal', 'enfeites?', 'pisca[- ]pisca', 'balões', 'balao', 'balão', 'vidros?', 'saboneteiras?', 'dispenser',
  'comedouros?', 'bebedouros?', 'clipes?', 'grampos?', 'réguas?',
].join('|') + ')\\b', 'i');

const RE_UNICO = /^(torneira|chuveiro|ducha|assento|lixeira|varal|t[aá]bua|mesa|cadeira|banqueta|espelho|arm[aá]rio|sapateira|cabideiro|cortina (para|de) box|livro|agenda|cesto (de|para) roupa|escada|carrinho|lumin[aá]ria|ventilador|aquecedor|panela|frigideira|chaleira|cafeteira|liquidificador|ferro|fruteira|organizador de (sapato|roupa)|gaveteiro|rack|estante|nicho de parede|porta (toalha|papel) de ch[aã]o)\b/i;

const RE_CONJUNTO = /\b(kit|conjunto|jogo|par|trio)\b|\b\d+\s*(peças|pecas|pçs|pcs|unidades|unid|un)\b/i;

export const QTDS_KIT = [2, 3, 4, 6];
const PESO_MAX_KIT = 6; // kg
const CUSTO_MAX_KIT = 150; // R$
const MULTIPLO_DIFICIL = 2.0;
const PESO_MAX_CORREIOS = 30;

export interface OpcaoKit {
  q: number;
  custo: number;
  preco: number;
  multiplo: number;
  porUnidade: number;
  ladoKit: number;
  cabe: boolean;
}

export interface Recomendacao {
  q: number;
  ganho: number;
  jaConjunto: boolean;
  unidade: { preco: number; multiplo: number };
  kit: OpcaoKit;
  opcoes: OpcaoKit[];
  motivos: string[];
}

const fmt = (v: number) => v.toFixed(2).replace('.', ',');
const brl = (v: number) => 'R$ ' + v.toFixed(2).replace('.', ',');

/** Recomendação de kit para o produto, ou null se não vale a pena. `premissas` já com a comissão do produto. */
export function analisarKit(p: Produto, premissas: Premissas, tabela: TabelaFrete, ladoMax: number): Recomendacao | null {
  const unidade = montarItem(p, 1);
  const nome = p.nome || '';
  const inicio = nome
    .replace(/^\s*(we ?drop\s*-\s*)?(kit|conjunto|jogo)?\s*(com|c\/)?\s*\d*\s*(un\w*|peças|pçs)?\s*/i, '')
    .split(/\s+/).slice(0, 3).join(' ');
  const palavraChave = RE_MULTIPLO.test(inicio);
  const natural = palavraChave || (CATEGORIAS_KIT.has(p.categoria) && !CATEGORIAS_NAO_KIT.has(p.categoria));
  if (!natural || !(p.custo > 0)) return null;
  if (RE_UNICO.test(inicio)) return null;
  if (CATEGORIAS_NAO_KIT.has(p.categoria) && !palavraChave) return null;
  const jaConjunto = RE_CONJUNTO.test(nome);

  const precoUnit = precoParaMargem(p.custo, unidade.peso, premissas.margemDesejada, premissas, tabela);
  if (!Number.isFinite(precoUnit)) return null;
  const unit = { preco: precoUnit, multiplo: precoUnit / p.custo };
  const opcoes: OpcaoKit[] = [];
  for (const q of QTDS_KIT) {
    if (q * unidade.peso > PESO_MAX_KIT || q * p.custo > CUSTO_MAX_KIT) break;
    const ladoKit = p.dims ? maiorLadoKit(p.dims, q) : NaN;
    if (ladoMax > 0 && ladoKit > ladoMax) continue;
    const custo = q * p.custo;
    const preco = precoParaMargem(custo, q * unidade.peso, premissas.margemDesejada, premissas, tabela);
    if (!Number.isFinite(preco)) continue;
    opcoes.push({ q, custo, preco, multiplo: preco / custo, porUnidade: preco / q, ladoKit, cabe: true });
  }
  if (!opcoes.length) return null;
  if (unit.multiplo < MULTIPLO_DIFICIL) return null;
  const melhorMult = Math.min(...opcoes.map((o) => o.multiplo));
  // menor quantidade que fica a até 0,10 do melhor múltiplo (kits menores vendem mais fácil)
  const escolhida = opcoes.find((o) => o.multiplo <= melhorMult + 0.1)!;
  const ganho = unit.multiplo - escolhida.multiplo;
  if (ganho < (jaConjunto ? 0.35 : 0.2)) return null;
  const motivos: string[] = [];
  if (p.custo < 20) motivos.push('ticket baixo: o custo fixo de envio come o lucro da unidade');
  motivos.push(`sozinho precisa vender a ${fmt(unit.multiplo)}× o custo; em kit de ${escolhida.q}, ${fmt(escolhida.multiplo)}×`);
  motivos.push(`no kit o comprador paga ${brl(escolhida.porUnidade)} por unidade, contra ${brl(unit.preco)} comprando 1`);
  if (jaConjunto) motivos.push('o nome já indica um conjunto: confira se faz sentido vender mais de um');
  return { q: escolhida.q, ganho, jaConjunto, unidade: unit, kit: escolhida, opcoes, motivos };
}

/** Opções de kit para qualquer produto (Montar kit): limitadas só por 30 kg e pelo tamanho da caixa. */
export function opcoesKit(p: Produto, premissas: Premissas, tabela: TabelaFrete, ladoMax: number): OpcaoKit[] {
  const unidade = montarItem(p, 1);
  const out: OpcaoKit[] = [];
  for (const q of QTDS_KIT) {
    if (q * unidade.peso > PESO_MAX_CORREIOS) break;
    const ladoKit = p.dims ? maiorLadoKit(p.dims, q) : NaN;
    const custo = q * p.custo;
    const preco = precoParaMargem(custo, q * unidade.peso, premissas.margemDesejada, premissas, tabela);
    if (!Number.isFinite(preco)) continue;
    out.push({ q, custo, preco, multiplo: preco / custo, porUnidade: preco / q, ladoKit, cabe: !(ladoMax > 0 && ladoKit > ladoMax) });
  }
  return out;
}
