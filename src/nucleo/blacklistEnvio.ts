// Blacklist do Mercado Envios: produtos perigosos que o Mercado Livre não transporta.
// Fonte: tabela de artigos perigosos do Mercado Envios (classes 1 a 9).
// A busca é pelo nome e pela categoria do produto (sem acento, sem maiúsculas). É uma triagem: confirme com o fornecedor.
//
// Para incluir um produto: acrescente o termo em `termos` da classe certa (um texto por termo).
// Para liberar um caso que o sistema marcou sem motivo: acrescente o termo em `EXCECOES`.

export interface ClasseEnvio {
  classe: string; // "Classe 2"
  nome: string; // "Gases comprimidos"
  exemplos: string; // texto da tabela do ML, para o tooltip
  termos: string[]; // palavras ou expressões procuradas no nome/categoria
}

export const BLACKLIST_ENVIO: ClasseEnvio[] = [
  {
    classe: 'Classe 1',
    nome: 'Explosivos',
    exemplos: 'Fogos de artifício, cartuchos geradores de fumaça, pirotecnia.',
    termos: ['fogos de artificio', 'fogo de artificio', 'rojao', 'rojoes', 'bombinha', 'estalinho', 'traque', 'pirotecnia', 'pirotecnico', 'sinalizador', 'cartucho de fumaca', 'gerador de fumaca', 'granada de fumaca', 'fumaca colorida', 'vela de fumaca'],
  },
  {
    classe: 'Classe 2',
    nome: 'Gases comprimidos',
    exemplos: 'Garrafas/cartuchos de gás butano, propano, CO₂, oxigênio, refrigerante, gás pimenta, alguns aerossóis. Cilindros de gás diversos (argônio, nitrogênio), isqueiros, cartuchos de gás diversos.',
    termos: ['isqueiro', 'macarico', 'butano', 'propano', 'refil de gas', 'cartucho de gas', 'cilindro de gas', 'botijao de gas', 'gas refrigerante', 'gas pimenta', 'spray de pimenta', 'aerossol', 'aerosol', 'cilindro de co2', 'capsula de co2', 'co2', 'oxigenio', 'argonio', 'nitrogenio', 'fogareiro a gas', 'gas de cozinha'],
  },
  {
    classe: 'Classes 3 e 4',
    nome: 'Líquidos e sólidos inflamáveis',
    exemplos: 'Álcool, solventes, combustíveis líquidos, adesivos, tintas, espuma expansiva, acetona, benzeno, aguarrás, tintas. Inclui sólidos inflamáveis como fogos de bengala, naftalina, enxofre em pó.',
    termos: ['alcool', 'solvente', 'thinner', 'tiner', 'combustivel', 'gasolina', 'querosene', 'diesel', 'cola de contato', 'cola instantanea', 'adesivo instantaneo', 'adesivo de contato', 'super bonder', 'tinta spray', 'tinta a oleo', 'tinta esmalte', 'esmalte sintetico', 'verniz spray', 'verniz liquido', 'verniz incolor', 'verniz maritimo', 'espuma expansiva', 'acetona', 'removedor de esmalte', 'benzeno', 'aguarras', 'fogo de bengala', 'naftalina', 'enxofre', 'fluido de isqueiro', 'acendedor de churrasqueira', 'acendedor liquido'],
  },
  {
    classe: 'Classe 5',
    nome: 'Substâncias oxidantes',
    exemplos: 'Água oxigenada, peróxido de hidrogênio. Substâncias oxidantes diversas (persulfatos).',
    termos: ['agua oxigenada', 'peroxido', 'persulfato'],
  },
  {
    classe: 'Classe 6',
    nome: 'Substâncias tóxicas/infecciosas',
    exemplos: 'Glifosato, inseticida, veneno, herbicidas. Substâncias tóxicas diversas (tricloroetileno, mercúrio, pesticidas). Materiais que contêm microrganismos (bactérias, vírus, fungos, parasitas).',
    termos: ['glifosato', 'inseticida', 'veneno', 'herbicida', 'pesticida', 'raticida', 'formicida', 'cupinicida', 'tricloroetileno', 'mercurio', 'agrotoxico'],
  },
  {
    classe: 'Classe 7',
    nome: 'Substâncias radioativas',
    exemplos: 'Substâncias radioativas (Cobalto-60, Iodo-131, Tecnécio-99m, Flúor-18, Rádio-223).',
    termos: ['radioativo', 'radioativa', 'cobalto-60', 'iodo-131'],
  },
  {
    classe: 'Classe 8',
    nome: 'Substâncias corrosivas',
    exemplos: 'Soda cáustica, cloro, ácido clorídrico, muriático, nítrico, sulfúrico, sulfônico, peeling fenólico, baterias de chumbo-ácido.',
    termos: ['soda caustica', 'cloro', 'pastilha de cloro', 'acido cloridrico', 'acido muriatico', 'muriatico', 'acido nitrico', 'acido sulfurico', 'acido sulfonico', 'peeling fenolico', 'chumbo-acido', 'chumbo acido', 'bateria de chumbo', 'bateria automotiva 12v', 'bateria de moto 12v'],
  },
  {
    classe: 'Classe 9',
    nome: 'Substâncias e vários artigos perigosos',
    exemplos: 'Baterias de lítio avulsas (notebooks, veículos, drones, power banks). Baterias não seladas. Substâncias altamente perigosas para o meio ambiente.',
    termos: ['power bank', 'powerbank', 'carregador portatil', 'bateria de litio', 'bateria litio', 'bateria avulsa', 'bateria reserva', 'bateria extra', 'bateria para notebook', 'bateria de notebook', 'bateria para drone', 'bateria de drone', 'bateria nao selada'],
  },
];

/** Termos que parecem perigosos mas não são (ex.: "cloro" em "clorofila"). Ficam fora da busca. */
export const EXCECOES: string[] = [
  'sem alcool', 'adesivo de parede', 'adesivo decorativo', 'acido hialuronico',
  'posto de gasolina', // brinquedo
  'saboneteira alcool gel', 'dispenser de alcool', 'porta alcool', // embalagem vazia
  'botijao termico', // garrafa térmica
  'suporte para botijao', // acessório sem gás
];

export interface RestricaoEnvio {
  classe: string;
  nome: string;
  exemplos: string;
  termo: string; // o termo que foi encontrado
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// cada termo vira uma expressão com borda de palavra ("cloro" não pega "clorofila")
const REGRAS = BLACKLIST_ENVIO.flatMap((c) => c.termos.map((t) => ({ c, termo: t, re: new RegExp(`(^|[^a-z0-9])${escapar(semAcento(t)).replace(/ /g, '[\\s-]+')}($|[^a-z0-9])`) })));

/** Procura o produto na blacklist. Devolve a primeira classe encontrada, ou null. */
export function restricaoEnvio(nome: string, categoria = ''): RestricaoEnvio | null {
  let texto = ` ${semAcento(`${nome} ${categoria}`)} `;
  for (const e of EXCECOES) texto = texto.split(semAcento(e)).join(' ');
  for (const { c, termo, re } of REGRAS) {
    if (re.test(texto)) return { classe: c.classe, nome: c.nome, exemplos: c.exemplos, termo };
  }
  return null;
}
