// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportXlsx.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReportCsvTable } from './reportCsv';

/**
 * A planilha do relatório em XLSX — o MESMO conteúdo do CSV (`ReportCsvTable`), com uma diferença que
 * justifica o formato: o número é NÚMERO. No CSV ele é texto que a planilha adivinha — e adivinha pelo
 * idioma de quem abre, de modo que `1234.5` vira data num Excel em português. Aqui a célula diz o tipo.
 *
 * Gerado à mão, sem biblioteca: um XLSX é um ZIP de quatro XMLs, e um gerador mínimo (ZIP sem
 * compressão, strings em linha) é menor que qualquer dependência que o traria — e roda igual no
 * navegador e na Cloud Function.
 */

const encoder = new TextEncoder();

/**
 * O texto de célula que é NÚMERO cru — o que `rawNumber` do CSV produz. Zero à esquerda fica texto:
 * "00123" é um código, e virar 123 apagaria o que ele identifica.
 */
const NUMERIC = /^-?(0|[1-9]\d*)(\.\d+)?(e[+-]?\d+)?$/i;

/** O XML não aceita os caracteres de controle, nem escapados: eles saem da célula. */
// eslint-disable-next-line no-control-regex -- é justamente o intervalo de controle que o XML recusa
const XML_INVALID = /[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g;

const escapeXml = (value: string): string =>
  value
    .replace(XML_INVALID, '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');

/** A coluna da célula: A..Z, AA..ZZ, AAA... */
const columnName = (index: number): string => {
  let name = '';
  let current = index + 1;
  while (current > 0) {
    const rest = (current - 1) % 26;
    name = String.fromCharCode(65 + rest) + name;
    current = Math.floor((current - 1) / 26);
  }
  return name;
};

const cellXml = (value: string, column: number, row: number, bold: boolean): string => {
  const ref = columnName(column) + String(row);
  const style = bold ? ' s="1"' : '';
  if (value === '') return '';
  if (!bold && NUMERIC.test(value)) return `<c r="${ref}"${style}><v>${value}</v></c>`;
  return `<c r="${ref}"${style} t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
};

const rowXml = (values: string[], row: number, bold = false): string =>
  `<row r="${row}">${values.map((value, column) => cellXml(value, column, row, bold)).join('')}</row>`;

const sheetXml = (table: ReportCsvTable): string => {
  const lines: string[] = [];
  let row = 1;
  if (table.notice) {
    lines.push(rowXml([table.notice], row));
    row += 2;
  }
  lines.push(rowXml(table.header, row, true));
  row += 1;
  for (const values of table.rows) {
    lines.push(rowXml(values, row));
    row += 1;
  }
  if (table.totals) {
    if (table.totalsHeader) {
      row += 1;
      lines.push(rowXml(table.totalsHeader, row, true));
      row += 1;
    }
    lines.push(rowXml(table.totals, row, true));
  }
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + `<sheetData>${lines.join('')}</sheetData></worksheet>`;
};

/** A aba nomeada como o relatório: até 31 caracteres, sem os que o Excel recusa num nome de aba. */
const sheetName = (title: string): string => {
  const clean = title.replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 31);
  return clean === '' ? 'Sheet1' : clean;
};

const STATIC_PARTS = {
  contentTypes: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    + '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    + '<Default Extension="xml" ContentType="application/xml"/>'
    + '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    + '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    + '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>'
    + '</Types>',
  rootRels: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    + '</Relationships>',
  workbookRels: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    + '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    + '<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>'
    + '</Relationships>',
  // Dois estilos: o comum e o negrito do cabeçalho e do total.
  styles: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    + '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    + '<fonts count="2"><font/><font><b/></font></fonts>'
    + '<fills count="1"><fill><patternFill patternType="none"/></fill></fills>'
    + '<borders count="1"><border/></borders>'
    + '<cellStyleXfs count="1"><xf/></cellStyleXfs>'
    + '<cellXfs count="2"><xf/><xf fontId="1" applyFont="1"/></cellXfs>'
    + '</styleSheet>',
};

const workbookXml = (title: string): string =>
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
  + '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
  + 'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
  + `<sheets><sheet name="${escapeXml(sheetName(title))}" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

const crc32 = (data: Uint8Array): number => {
  let crc = 0xffffffff;
  for (const byte of data) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
};

/** Um ZIP "stored" (sem compressão) — o que todo leitor de XLSX aceita. */
const zip = (files: { name: string; content: string }[]): Uint8Array => {
  const chunks: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;

  for (const file of files) {
    const name = encoder.encode(file.name);
    const data = encoder.encode(file.content);
    const crc = crc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);
    local.setUint16(8, 0, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    chunks.push(new Uint8Array(local.buffer), name, data);

    const entry = new DataView(new ArrayBuffer(46));
    entry.setUint32(0, 0x02014b50, true);
    entry.setUint16(4, 20, true);
    entry.setUint16(6, 20, true);
    entry.setUint16(8, 0x0800, true);
    entry.setUint16(10, 0, true);
    entry.setUint32(16, crc, true);
    entry.setUint32(20, data.length, true);
    entry.setUint32(24, data.length, true);
    entry.setUint16(28, name.length, true);
    entry.setUint32(42, offset, true);
    central.push(new Uint8Array(entry.buffer), name);

    offset += 30 + name.length + data.length;
  }

  const centralSize = central.reduce((sum, part) => sum + part.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, centralSize, true);
  end.setUint32(16, offset, true);

  const parts = [...chunks, ...central, new Uint8Array(end.buffer)];
  const output = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let at = 0;
  for (const part of parts) {
    output.set(part, at);
    at += part.length;
  }
  return output;
};

export const reportResultToXlsx = (table: ReportCsvTable, title: string): Uint8Array =>
  zip([
    { name: '[Content_Types].xml', content: STATIC_PARTS.contentTypes },
    { name: '_rels/.rels', content: STATIC_PARTS.rootRels },
    { name: 'xl/workbook.xml', content: workbookXml(title) },
    { name: 'xl/_rels/workbook.xml.rels', content: STATIC_PARTS.workbookRels },
    { name: 'xl/styles.xml', content: STATIC_PARTS.styles },
    { name: 'xl/worksheets/sheet1.xml', content: sheetXml(table) },
  ]);

export const XLSX_MIME_TYPE = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
