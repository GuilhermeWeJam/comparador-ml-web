// Leitura e escrita mínimas de .xlsx, sem bibliotecas externas (usa APIs do navegador).
// Um .xlsx é um .zip com XMLs dentro.

type Celula = string | number | boolean | null;

async function inflar(bytes: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([bytes as BlobPart]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

function lerZip(buffer: ArrayBuffer): Record<string, () => Promise<Uint8Array>> {
  const dv = new DataView(buffer);
  const bytes = new Uint8Array(buffer);
  let eocd = -1;
  for (let i = buffer.byteLength - 22; i >= Math.max(0, buffer.byteLength - 65557); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('O arquivo não parece ser um .xlsx válido.');
  const total = dv.getUint16(eocd + 10, true);
  let pos = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  const entradas: Record<string, () => Promise<Uint8Array>> = {};
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(pos, true) !== 0x02014b50) throw new Error('Arquivo .xlsx corrompido.');
    const metodo = dv.getUint16(pos + 10, true);
    const tamComp = dv.getUint32(pos + 20, true);
    const lenNome = dv.getUint16(pos + 28, true);
    const lenExtra = dv.getUint16(pos + 30, true);
    const lenCom = dv.getUint16(pos + 32, true);
    const offLocal = dv.getUint32(pos + 42, true);
    const nome = dec.decode(bytes.subarray(pos + 46, pos + 46 + lenNome));
    entradas[nome] = async () => {
      const lnNome = dv.getUint16(offLocal + 26, true);
      const lnExtra = dv.getUint16(offLocal + 28, true);
      const ini = offLocal + 30 + lnNome + lnExtra;
      const dados = bytes.subarray(ini, ini + tamComp);
      if (metodo === 0) return dados;
      if (metodo === 8) return inflar(dados);
      throw new Error('Compressão não suportada no arquivo ' + nome);
    };
    pos += 46 + lenNome + lenExtra + lenCom;
  }
  return entradas;
}

const xml = (texto: string) => new DOMParser().parseFromString(texto, 'application/xml');
const porNome = (raiz: Document | Element, nome: string) => Array.from(raiz.getElementsByTagNameNS('*', nome));

function colunaParaIndice(letras: string): number {
  let n = 0;
  for (const ch of letras) n = n * 26 + (ch.charCodeAt(0) - 64);
  return n - 1;
}

export interface PastaXlsx {
  abas: string[];
  lerAba: (nome: string) => Promise<Celula[][] | null>;
}

/** Abre um .xlsx e devolve as abas; cada aba vira uma matriz linhas × colunas (índice 0). */
export async function lerXlsx(arrayBuffer: ArrayBuffer): Promise<PastaXlsx> {
  const zip = lerZip(arrayBuffer);
  const dec = new TextDecoder();
  const texto = async (caminho: string) => (zip[caminho] ? dec.decode(await zip[caminho]()) : null);

  const compartilhados: string[] = [];
  const ssTxt = await texto('xl/sharedStrings.xml');
  if (ssTxt) {
    for (const si of porNome(xml(ssTxt), 'si')) {
      let s = '';
      for (const t of porNome(si, 't')) {
        if (t.parentNode && (t.parentNode as Element).localName === 'rPh') continue;
        s += t.textContent;
      }
      compartilhados.push(s);
    }
  }

  const wbTxt = await texto('xl/workbook.xml');
  const relsTxt = await texto('xl/_rels/workbook.xml.rels');
  if (!wbTxt || !relsTxt) throw new Error('O arquivo não parece ser um .xlsx válido.');
  const rels: Record<string, string> = {};
  for (const r of porNome(xml(relsTxt), 'Relationship')) {
    let alvo = r.getAttribute('Target') || '';
    alvo = alvo.startsWith('/') ? alvo.slice(1) : 'xl/' + alvo.replace(/^\.\//, '');
    rels[r.getAttribute('Id') || ''] = alvo;
  }
  const abas: { nome: string; caminho: string }[] = [];
  for (const s of porNome(xml(wbTxt), 'sheet')) {
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id') || '';
    abas.push({ nome: s.getAttribute('name') || '', caminho: rels[rid] });
  }

  async function lerAba(nome: string): Promise<Celula[][] | null> {
    const aba = abas.find((a) => a.nome === nome);
    if (!aba) return null;
    const conteudo = await texto(aba.caminho);
    if (!conteudo) return null;
    const doc = xml(conteudo);
    const linhas: Celula[][] = [];
    for (const row of porNome(doc, 'row')) {
      const iLinha = parseInt(row.getAttribute('r') || '0', 10) - 1;
      const valores: Celula[] = [];
      for (const c of porNome(row, 'c')) {
        const ref = c.getAttribute('r') || '';
        const col = colunaParaIndice(ref.replace(/[0-9]/g, ''));
        const tipo = c.getAttribute('t');
        const v = porNome(c, 'v')[0];
        let valor: Celula = null;
        if (tipo === 's') valor = v ? compartilhados[parseInt(v.textContent || '0', 10)] : null;
        else if (tipo === 'inlineStr') valor = porNome(c, 't').map((t) => t.textContent).join('');
        else if (tipo === 'str' || tipo === 'e') valor = v ? v.textContent : null;
        else if (tipo === 'b') valor = v ? v.textContent === '1' : null;
        else valor = v && v.textContent !== '' ? Number(v.textContent) : null;
        valores[col] = valor;
      }
      if (iLinha >= 0) linhas[iLinha] = valores;
    }
    return linhas;
  }

  return { abas: abas.map((a) => a.nome), lerAba };
}

// ---------- escrita ----------

const TABELA_CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) c = TABELA_CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Monta um .zip sem compressão (suficiente para planilhas exportadas). */
function zipar(arquivos: { nome: string; dados: Uint8Array }[]): Uint8Array {
  const enc = new TextEncoder();
  const partes: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const a of arquivos) {
    const nome = enc.encode(a.nome);
    const crc = crc32(a.dados);
    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, a.dados.length, true);
    local.setUint32(22, a.dados.length, true);
    local.setUint16(26, nome.length, true);
    partes.push(new Uint8Array(local.buffer), nome, a.dados);
    const cd = new DataView(new ArrayBuffer(46));
    cd.setUint32(0, 0x02014b50, true);
    cd.setUint16(4, 20, true);
    cd.setUint16(6, 20, true);
    cd.setUint32(16, crc, true);
    cd.setUint32(20, a.dados.length, true);
    cd.setUint32(24, a.dados.length, true);
    cd.setUint16(28, nome.length, true);
    cd.setUint32(42, offset, true);
    central.push(new Uint8Array(cd.buffer), nome);
    offset += 30 + nome.length + a.dados.length;
  }
  const tamCentral = central.reduce((s, b) => s + b.length, 0);
  const fim = new DataView(new ArrayBuffer(22));
  fim.setUint32(0, 0x06054b50, true);
  fim.setUint16(8, arquivos.length, true);
  fim.setUint16(10, arquivos.length, true);
  fim.setUint32(12, tamCentral, true);
  fim.setUint32(16, offset, true);
  const todas = [...partes, ...central, new Uint8Array(fim.buffer)];
  const out = new Uint8Array(todas.reduce((s, b) => s + b.length, 0));
  let p = 0;
  for (const b of todas) { out.set(b, p); p += b.length; }
  return out;
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
  // remove caracteres de controle que o Excel recusa
  // eslint-disable-next-line no-control-regex
  .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '');

function letraColuna(i: number): string {
  let s = '';
  i += 1;
  while (i > 0) { const r = (i - 1) % 26; s = String.fromCharCode(65 + r) + s; i = Math.floor((i - 1) / 26); }
  return s;
}

/** Gera um .xlsx com uma aba. Números ficam como número; o resto como texto. */
export function escreverXlsx(nomeAba: string, linhas: Celula[][]): Blob {
  const enc = new TextEncoder();
  const rows = linhas.map((l, i) => {
    const cells = l.map((v, j) => {
      const ref = letraColuna(j) + (i + 1);
      if (v === null || v === undefined || v === '') return '';
      if (typeof v === 'number' && Number.isFinite(v)) return `<c r="${ref}"${i === 0 ? ' s="1"' : ''}><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"${i === 0 ? ' s="1"' : ''}><is><t xml:space="preserve">${esc(String(v))}</t></is></c>`;
    }).join('');
    return `<row r="${i + 1}">${cells}</row>`;
  }).join('');
  const sheet = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetData>${rows}</sheetData></worksheet>`;
  const arquivos = [
    { nome: '[Content_Types].xml', texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>' },
    { nome: '_rels/.rels', texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>' },
    { nome: 'xl/workbook.xml', texto: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${esc(nomeAba.slice(0, 31))}" sheetId="1" r:id="rId1"/></sheets></workbook>` },
    { nome: 'xl/_rels/workbook.xml.rels', texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>' },
    { nome: 'xl/styles.xml', texto: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="2"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>' },
    { nome: 'xl/worksheets/sheet1.xml', texto: sheet },
  ];
  const zip = zipar(arquivos.map((a) => ({ nome: a.nome, dados: enc.encode(a.texto) })));
  return new Blob([zip as BlobPart], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}

/** CSV com ponto e vírgula, vírgula decimal e BOM (abre direto no Excel em português). */
export function escreverCsv(linhas: Celula[][]): Blob {
  const cel = (v: Celula) => {
    if (v === null || v === undefined) return '';
    if (typeof v === 'number') return Number.isFinite(v) ? String(Math.round(v * 100) / 100).replace('.', ',') : '';
    const s = String(v);
    return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
  };
  const texto = '﻿' + linhas.map((l) => l.map(cel).join(';')).join('\r\n');
  return new Blob([texto], { type: 'text/csv;charset=utf-8' });
}
