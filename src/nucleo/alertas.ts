// Alertas de regulação e logística, a partir do nome, categoria e peso do item.
// É uma triagem pelo nome: confirme sempre com o fornecedor.
import { maiorLadoKit, tamanho } from './calc';
import type { Alerta, Item, NivelAlerta } from './tipos';

const CAT_BRINQUEDO = new Set(['Brinquedos', 'Jogos e Educativos', 'Bonecas e Casinhas', 'Carrinhos e Pistas', 'Passeio e Elétricos', 'Brinquedos Pet']);
const CAT_ELETRICO = new Set(['Eletroportáteis', 'Eletroportáteis de Cozinha', 'Climatização', 'Eletrônicos e Acessórios', 'Iluminação Natalina', 'Acessórios para Elétricas']);
const CAT_BEBE = new Set(['Bebês']);
const CAT_BELEZA = new Set(['Beleza e Cuidado Pessoal']);

interface Regra {
  nivel: NivelAlerta;
  tipo: string;
  texto: string;
  re?: RegExp;
  teste?: (cat: string, nome: string, peso: number) => boolean;
}

const REGRAS: Regra[] = [
  { nivel: 'bloqueio', tipo: 'Restrito', re: /\b(arma|pistola (de )?(brinquedo|lan[çc]a)|metralhadora|fuzil|simulacro|soco ingl[eê]s|spray de pimenta|spray (repelente )?contra (animais|pessoas)|canivete autom|taser|choque)\b/i,
    texto: 'Parece simulacro de arma ou item de defesa: o Mercado Livre restringe esse tipo de produto.' },
  { nivel: 'atencao', tipo: 'Anatel', re: /\b(bluetooth|wi-?fi|wireless|sem fio|smart ?(watch|tv|plug|lâmpada|lampada)|r[áa]dio|transmissor|walkie|drone|controle remoto)\b/i,
    texto: 'Usa rádio, Bluetooth ou Wi-Fi: precisa de homologação da Anatel (o número vai no anúncio).' },
  { nivel: 'atencao', tipo: 'INMETRO', teste: (c, n) => CAT_BRINQUEDO.has(c) || /\bbrinquedos?\b/i.test(n),
    texto: 'Brinquedo exige selo do INMETRO. Confirme com o fornecedor.' },
  { nivel: 'atencao', tipo: 'INMETRO', teste: (c, n) => CAT_ELETRICO.has(c) || /\b(127 ?v|220 ?v|bivolt|el[ée]tric[oa]|tomada|carregador|extens[ãa]o el[ée]trica|benjamim|filtro de linha|l[âa]mpada|panela de press[ãa]o|capacete)\b/i.test(n),
    texto: 'Elétrico, lâmpada, panela de pressão ou capacete: há exigência de certificação do INMETRO.' },
  { nivel: 'atencao', tipo: 'INMETRO', teste: (c, n) => CAT_BEBE.has(c) || /\b(mamadeira|chupeta|bico|cadeirinha|ber[çc]o|andador|carrinho de beb[êe])\b/i.test(n),
    texto: 'Produto para bebê: categoria regulada (INMETRO e, às vezes, ANVISA).' },
  { nivel: 'atencao', tipo: 'ANVISA', teste: (c, n) => CAT_BELEZA.has(c) || /\b(cosm[ée]tico|shampoo|creme|hidratante|perfume|repelente|[áa]lcool|desinfetante|saneante|alvejante|inseticida|suplemento|protetor solar|esmalte|maquiagem)\b/i.test(n),
    texto: 'Cosmético, saneante ou repelente: pode exigir registro ou notificação na ANVISA.' },
  { nivel: 'atencao', tipo: 'Licenciado', re: /\b(barbie|disney|marvel|hot wheels|patrulha canina|frozen|homem[- ]aranha|spider|lamborghini|ferrari|stitch|minecraft|pok[eé]mon|sonic|legend[aá]rios|princesas?|batman|hello kitty|homem de ferro|branca de neve|gatinha marie|mickey|minnie|star wars|vingadores|naruto|harry potter|peppa|bluey|nasa|coca[- ]cola)\b/i,
    texto: 'Marca ou personagem licenciado: só anuncie com garantia de que é original (risco de denúncia).' },
  { nivel: 'info', tipo: 'Frágil', re: /\b(vidro|cer[âa]mica|porcelana|cristal|espelho|borossilicato|lou[çc]a|ta[çc]as?)\b/i,
    texto: 'Exige embalagem reforçada; quebra no transporte vira devolução.' },
  { nivel: 'info', tipo: 'Voltagem', teste: (_c, n) => /\b(127|110|220) ?v\b/i.test(n) && !/bivolt/i.test(n),
    texto: 'Só uma voltagem: deixe claro no título e nas fotos; comprador que erra devolve.' },
  { nivel: 'info', tipo: 'Bateria', re: /\b(recarreg[aá]vel|bateria|power ?bank|l[íi]tio)\b/i,
    texto: 'Confira se o fornecedor envia normalmente (baterias de lítio têm regras de transporte).' },
  { nivel: 'info', tipo: 'Pesado', teste: (_c, _n, peso) => peso > 5,
    texto: 'Pesado ou volumoso (mais de 5 kg para frete): frete alto e devolução cara.' },
];

const ORDEM: Record<NivelAlerta, number> = { bloqueio: 0, atencao: 1, info: 2 };

/** Alertas do item. `ladoMax` = regra de tamanho (0 = desligada). */
export function analisarAlertas(item: Item, ladoMax: number): Alerta[] {
  const p = item.produto;
  const nome = item.nomeOriginal || item.nome || '';
  const out: Alerta[] = [];
  if (p.dims) {
    const t = tamanho(p.dims, ladoMax);
    const lado = item.q > 1 ? maiorLadoKit(p.dims, item.q) : Math.max(...p.dims);
    if (t.status === 'suspeita') out.push({ nivel: 'atencao', tipo: 'Medida', texto: `Medida suspeita no catálogo (${Math.round(t.maior)} cm): confira com o fornecedor.` });
    else if (ladoMax > 0 && lado > ladoMax)
      out.push({ nivel: 'bloqueio', tipo: 'Tamanho', texto: `${item.q > 1 ? 'A caixa do kit tem' : 'Tem'} um lado de ${Math.round(lado)} cm: passa do limite de ${ladoMax} cm.` });
  }
  const vistos = new Set<string>();
  for (const r of REGRAS) {
    const bate = r.re ? r.re.test(nome) : r.teste!(p.categoria, nome, item.peso);
    if (!bate) continue;
    if (r.tipo === 'INMETRO' && vistos.has('INMETRO')) continue; // um alerta de INMETRO basta
    if (vistos.has(r.tipo + r.texto)) continue;
    vistos.add(r.tipo);
    vistos.add(r.tipo + r.texto);
    out.push({ nivel: r.nivel, tipo: r.tipo, texto: r.texto });
  }
  out.sort((a, b) => ORDEM[a.nivel] - ORDEM[b.nivel]);
  return out;
}

export const temRestrito = (alertas: Alerta[]) => alertas.some((a) => a.tipo === 'Restrito');
export const temFragil = (alertas: Alerta[]) => alertas.some((a) => a.tipo === 'Frágil');
/** Alerta de certificação ou marca (Anatel, INMETRO, ANVISA, Licenciado). */
export const temRegulado = (alertas: Alerta[]) => alertas.some((a) => ['Anatel', 'INMETRO', 'ANVISA', 'Licenciado'].includes(a.tipo));
