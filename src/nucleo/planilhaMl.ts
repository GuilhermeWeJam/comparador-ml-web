// Planilha "Anunciar em massa" do Mercado Livre: leitura, DE-PARA por EAN e preenchimento.
// As regras estão em docs/regras-planilha-ml.md. Só as células das linhas de produto são alteradas,
// direto no XML, para manter fórmulas, listas de opções e formatação do modelo do ML.
import { crc32, lerZip } from './xlsx';

export const ABAS_IGNORADAS = ['Ajuda', 'extra info', 'Informações legais'];
export const LINHA_CABECALHO = 3;
export const PRIMEIRA_LINHA = 8;

/** Colunas que o sistema preenche (nome da coluna até o primeiro ":"). */
export const COL = {
  catalogo: 'Código do catálogo ML',
  titulo: 'Título',
  condicao: 'Condição',
  ean: 'Código universal de produto',
  fotos: 'Fotos',
  sku: 'SKU',
  preco: 'Preço [R$]',
  formato: 'Formato de venda',
  tipo: 'Tipo de anúncio',
  envio: 'Forma de envio',
  custoEnvio: 'Custo de envio',
  retirar: 'Retirar pessoalmente',
  garantia: 'Tipo de garantia',
  tempoGarantia: 'Tempo de garantia',
  unidadeGarantia: 'Unidade de Tempo de garantia',
} as const;

/** Valores fixos das regras. */
export const FIXOS = {
  condicao: 'Novo',
  envio: 'Mercado Envios',
  custoEnvio: 'Por conta do comprador',
  retirar: 'Não aceito',
  garantia: 'Garantia do vendedor',
  tempoGarantia: 7,
  unidadeGarantia: 'dias',
};

export type Valor = string | number | null;
export const APAGAR = Symbol('apagar');

export interface LinhaProduto {
  aba: string;
  linha: number; // número da linha na planilha (8, 9, …)
  eans: string[]; // como vieram do ML
  catalogo: string;
  tituloMl: string;
}

export interface AbaMl {
  nome: string;
  caminho: string; // xl/worksheets/sheetN.xml
  colunas: Map<string, string>; // nome curto da coluna -> letra
  quantidades: string[]; // letras das colunas "Quantidade de …" do formato de venda
  opcoes: Map<string, string[]>; // letra -> opções válidas (listas do ML)
  produtos: LinhaProduto[];
}

export interface PlanilhaMl {
  arquivos: Map<string, Uint8Array>;
  ordem: string[];
  abas: AbaMl[];
}

const dec = new TextDecoder();
const enc = new TextEncoder();
const xmlDoc = (b: Uint8Array) => new DOMParser().parseFromString(dec.decode(b), 'application/xml');
const tags = (raiz: Document | Element, nome: string) => Array.from(raiz.getElementsByTagNameNS('*', nome));

/** EAN só com dígitos e sem zeros à esquerda (o ML às vezes manda 14 dígitos: 07899…). */
export function normalizarEan(e: string | null | undefined): string {
  return String(e || '').replace(/\D/g, '').replace(/^0+/, '');
}

/** Nome curto da coluna: a primeira linha do cabeçalho, até o ":". */
export function nomeCurto(cabecalho: string): string {
  return cabecalho.split('\n')[0].split(':')[0].trim();
}

function indiceColuna(letras: string): number {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n;
}

function valorCelula(c: Element, compart: string[]): string {
  const t = c.getAttribute('t');
  if (t === 'inlineStr') return tags(c, 't').map((x) => x.textContent || '').join('');
  const v = tags(c, 'v')[0]?.textContent ?? '';
  if (t === 's') return compart[Number(v)] ?? '';
  return v;
}

/** Abre a planilha devolvida pelo ML. */
export async function lerPlanilhaMl(buffer: ArrayBuffer): Promise<PlanilhaMl> {
  const zip = lerZip(buffer);
  const ordem = Object.keys(zip);
  const arquivos = new Map<string, Uint8Array>();
  for (const nome of ordem) arquivos.set(nome, new Uint8Array(await zip[nome]()));
  const ler = (n: string) => { const b = arquivos.get(n); if (!b) throw new Error(`A planilha não tem ${n}. É mesmo a planilha do Mercado Livre?`); return b; };

  const compart = arquivos.has('xl/sharedStrings.xml')
    ? tags(xmlDoc(ler('xl/sharedStrings.xml')), 'si').map((si) => tags(si, 't').map((t) => t.textContent || '').join(''))
    : [];
  const rels = new Map(tags(xmlDoc(ler('xl/_rels/workbook.xml.rels')), 'Relationship').map((r) => [r.getAttribute('Id') || '', r.getAttribute('Target') || '']));
  const folhas = tags(xmlDoc(ler('xl/workbook.xml')), 'sheet').map((s) => {
    const rid = s.getAttribute('r:id') || s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || '';
    const alvo = (rels.get(rid) || '').replace(/^\/?xl\//, '');
    return { nome: s.getAttribute('name') || '', caminho: 'xl/' + alvo };
  });

  // aba "extra info": cada linha é a lista de opções de uma coluna
  const extra = new Map<number, Map<number, string>>();
  const fExtra = folhas.find((f) => f.nome === 'extra info');
  if (fExtra && arquivos.has(fExtra.caminho)) {
    for (const row of tags(xmlDoc(ler(fExtra.caminho)), 'row')) {
      const r = Number(row.getAttribute('r'));
      const m = new Map<number, string>();
      for (const c of tags(row, 'c')) {
        const ref = c.getAttribute('r') || '';
        m.set(indiceColuna(ref.replace(/\d+/g, '')), valorCelula(c, compart));
      }
      extra.set(r, m);
    }
  }

  const abas: AbaMl[] = [];
  for (const f of folhas) {
    if (ABAS_IGNORADAS.includes(f.nome) || !arquivos.has(f.caminho)) continue;
    const doc = xmlDoc(ler(f.caminho));
    const linhas = new Map<number, Map<string, string>>();
    for (const row of tags(doc, 'row')) {
      const r = Number(row.getAttribute('r'));
      if (r !== LINHA_CABECALHO && r < PRIMEIRA_LINHA) continue;
      const m = new Map<string, string>();
      for (const c of tags(row, 'c')) {
        const ref = c.getAttribute('r') || '';
        const val = valorCelula(c, compart);
        if (val !== '') m.set(ref.replace(/\d+/g, ''), val);
      }
      if (m.size) linhas.set(r, m);
    }
    const cab = linhas.get(LINHA_CABECALHO);
    if (!cab) continue;
    const colunas = new Map<string, string>();
    const ordemCols = [...cab.entries()].sort((a, b) => indiceColuna(a[0]) - indiceColuna(b[0]));
    for (const [letra, texto] of ordemCols) {
      const n = nomeCurto(texto);
      if (!colunas.has(n)) colunas.set(n, letra);
    }
    if (!colunas.has(COL.ean) && !colunas.has(COL.catalogo)) continue;

    // "Quantidade de …" entre "Formato de venda" e "Tipo de anúncio"
    const quantidades: string[] = [];
    const iFmt = colunas.get(COL.formato), iTipo = colunas.get(COL.tipo);
    if (iFmt) {
      for (const [letra, texto] of ordemCols) {
        const i = indiceColuna(letra);
        if (i > indiceColuna(iFmt) && (!iTipo || i < indiceColuna(iTipo)) && nomeCurto(texto).startsWith('Quantidade de')) quantidades.push(letra);
      }
    }

    // listas de opções: <dataValidation type="list" sqref="E8:E10001"><formula1>'extra info'!$A$3:$E$3</formula1>
    const opcoes = new Map<string, string[]>();
    for (const dv of tags(doc, 'dataValidation')) {
      if (dv.getAttribute('type') !== 'list') continue;
      const f1 = tags(dv, 'formula1')[0]?.textContent || '';
      const m = /extra info'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)/.exec(f1);
      if (!m) continue;
      const linhaExtra = extra.get(Number(m[2]));
      if (!linhaExtra) continue;
      const lista: string[] = [];
      for (let i = indiceColuna(m[1]); i <= indiceColuna(m[3]); i++) { const v = linhaExtra.get(i); if (v) lista.push(v); }
      for (const parte of (dv.getAttribute('sqref') || '').split(/\s+/)) {
        const letra = parte.replace(/[\d:].*$/, '');
        if (letra) opcoes.set(letra, lista);
      }
    }

    const produtos: LinhaProduto[] = [];
    const lEan = colunas.get(COL.ean), lCat = colunas.get(COL.catalogo), lTit = colunas.get(COL.titulo);
    for (const [r, m] of [...linhas.entries()].sort((a, b) => a[0] - b[0])) {
      if (r < PRIMEIRA_LINHA) continue;
      const ean = lEan ? m.get(lEan) || '' : '';
      const cat = lCat ? m.get(lCat) || '' : '';
      if (!normalizarEan(ean) && !cat.replace(/[;\s]/g, '')) continue;
      produtos.push({ aba: f.nome, linha: r, eans: ean.split(/[,;\s]+/).filter((e) => normalizarEan(e)), catalogo: cat, tituloMl: lTit ? m.get(lTit) || '' : '' });
    }
    abas.push({ nome: f.nome, caminho: f.caminho, colunas, quantidades, opcoes, produtos });
  }
  return { arquivos, ordem, abas };
}

// ---------- escrita ----------

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function celulaXml(ref: string, estilo: string | null, valor: Valor | typeof APAGAR): string {
  const s = estilo ? ` s="${estilo}"` : '';
  if (valor === APAGAR || valor === null || valor === '') return `<c r="${ref}"${s}/>`;
  if (typeof valor === 'number') return `<c r="${ref}"${s}><v>${valor}</v></c>`;
  return `<c r="${ref}"${s} t="inlineStr"><is><t xml:space="preserve">${esc(valor)}</t></is></c>`;
}

/** Troca as células de uma linha no XML da aba. Mantém o estilo de cada célula. */
export function gravarLinha(xml: string, linha: number, valores: Map<string, Valor | typeof APAGAR>): string {
  const reLinha = new RegExp(`<row r="${linha}"([^>]*?)(/>|>([\\s\\S]*?)</row>)`);
  let m = reLinha.exec(xml);
  if (!m) {
    // linha não existe: cria antes da primeira linha maior
    const depois = [...xml.matchAll(/<row r="(\d+)"/g)].find((x) => Number(x[1]) > linha);
    const nova = `<row r="${linha}"></row>`;
    const pos = depois ? depois.index! : xml.indexOf('</sheetData>');
    xml = xml.slice(0, pos) + nova + xml.slice(pos);
    m = reLinha.exec(xml)!;
  }
  let corpo = m[3] ?? '';
  for (const [letra, valor] of valores) {
    const ref = `${letra}${linha}`;
    const reCel = new RegExp(`<c r="${ref}"([^>]*?)(?:/>|>[\\s\\S]*?</c>)`);
    const achou = reCel.exec(corpo);
    if (achou) {
      const estilo = /s="(\d+)"/.exec(achou[1])?.[1] ?? null;
      corpo = corpo.slice(0, achou.index) + celulaXml(ref, estilo, valor) + corpo.slice(achou.index + achou[0].length);
    } else {
      const alvo = indiceColuna(letra);
      const prox = [...corpo.matchAll(new RegExp(`<c r="([A-Z]+)${linha}"`, 'g'))].find((x) => indiceColuna(x[1]) > alvo);
      const pos = prox ? prox.index! : corpo.length;
      corpo = corpo.slice(0, pos) + celulaXml(ref, null, valor) + corpo.slice(pos);
    }
  }
  const abre = m[1].replace(/\s*spans="[^"]*"/, '');
  return xml.slice(0, m.index) + `<row r="${linha}"${abre}>${corpo}</row>` + xml.slice(m.index + m[0].length);
}

async function comprimir(dados: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([dados as BlobPart]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Monta o .xlsx de volta (com compressão, como o original). */
export async function montarXlsx(pl: PlanilhaMl, alterados: Map<string, string>): Promise<Blob> {
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const nome of pl.ordem) {
    const bruto = alterados.has(nome) ? enc.encode(alterados.get(nome)!) : pl.arquivos.get(nome)!;
    const comp = await comprimir(bruto);
    const crc = crc32(bruto);
    const n = enc.encode(nome);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true); // nomes em UTF-8
    local.setUint16(8, 8, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, comp.length, true);
    local.setUint32(22, bruto.length, true);
    local.setUint16(26, n.length, true);
    partes.push(new Uint8Array(local.buffer), n, comp);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint16(8, 0x0800, true);
    cd.setUint16(10, 8, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, comp.length, true);
    cd.setUint32(24, bruto.length, true);
    cd.setUint16(28, n.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), n);
    offset += 30 + n.length + comp.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, pl.ordem.length, true);
  fim.setUint16(10, pl.ordem.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  return new Blob([...partes, ...central, new Uint8Array(fim.buffer)] as BlobPart[], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

// ---------- regras ----------

export interface DadosItem {
  titulo: string;
  fotos: string[];
  sku: string;
  preco: number | null;
  tipo: 'Clássico' | 'Premium';
  q: number; // unidades (1 = unidade; 2+ = kit)
}

export interface Preenchimento {
  valores: Map<string, Valor | typeof APAGAR>;
  campos: string[]; // nomes das colunas preenchidas
  avisos: string[];
}

/** Aplica as regras de docs/regras-planilha-ml.md numa linha de produto. */
export function regrasDaLinha(aba: AbaMl, d: DadosItem, limiteTitulo = 60): Preenchimento {
  const valores = new Map<string, Valor | typeof APAGAR>();
  const campos: string[] = [];
  const avisos: string[] = [];
  const por = (nome: string, valor: Valor | typeof APAGAR, obrigatoria = false) => {
    const letra = aba.colunas.get(nome);
    if (!letra) { if (obrigatoria) avisos.push(`A aba não tem a coluna "${nome}".`); return; }
    if (valor !== APAGAR && valor !== null && typeof valor === 'string') {
      const ops = aba.opcoes.get(letra);
      if (ops && ops.length && !ops.includes(valor)) { avisos.push(`"${valor}" não é uma opção de "${nome}" nesta categoria (opções: ${ops.join(', ')}). Campo não preenchido.`); return; }
    }
    valores.set(letra, valor);
    campos.push(nome);
  };

  por(COL.catalogo, APAGAR);
  const titulo = d.titulo.replace(/\s+/g, ' ').trim();
  if (!titulo) avisos.push('Item sem título.');
  else {
    if (titulo.length > limiteTitulo) avisos.push(`Título com ${titulo.length} caracteres (o máximo é ${limiteTitulo}).`);
    por(COL.titulo, titulo, true);
  }
  if (aba.colunas.has(COL.condicao)) por(COL.condicao, FIXOS.condicao);
  if (d.fotos.length) por(COL.fotos, d.fotos.join(','), true);
  else avisos.push('Item sem links de fotos: a coluna Fotos ficou como o ML mandou.');
  por(COL.sku, d.sku, true);
  if (d.preco && d.preco > 0) por(COL.preco, Math.round(d.preco * 100) / 100, true);
  else avisos.push('Item sem preço.');
  por(COL.tipo, d.tipo, true);
  if (aba.colunas.has(COL.formato)) {
    por(COL.formato, d.q > 1 ? 'Kit' : 'Unidade');
    for (const letra of aba.quantidades) valores.set(letra, d.q);
  } else if (d.q > 1) {
    avisos.push(`Kit de ${d.q}, mas esta categoria não tem "Formato de venda": a quantidade só vai no título.`);
  }
  por(COL.envio, FIXOS.envio, true);
  por(COL.custoEnvio, FIXOS.custoEnvio, true);
  por(COL.retirar, FIXOS.retirar);
  por(COL.garantia, FIXOS.garantia, true);
  por(COL.tempoGarantia, FIXOS.tempoGarantia, true);
  por(COL.unidadeGarantia, FIXOS.unidadeGarantia, true);
  return { valores, campos, avisos };
}

