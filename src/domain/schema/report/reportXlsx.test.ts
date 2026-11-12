import { describe, it, expect } from 'vitest';
import { reportResultToXlsx } from './reportXlsx';
import { reportFileName } from './reportCsv';

/** Lê um ZIP "stored" de volta — o suficiente para conferir o que o gerador escreveu. */
const unzip = (bytes: Uint8Array): Map<string, string> => {
  const files = new Map<string, string>();
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const decoder = new TextDecoder();
  let at = 0;
  while (view.getUint32(at, true) === 0x04034b50) {
    const size = view.getUint32(at + 18, true);
    const nameLength = view.getUint16(at + 26, true);
    const name = decoder.decode(bytes.subarray(at + 30, at + 30 + nameLength));
    const start = at + 30 + nameLength;
    files.set(name, decoder.decode(bytes.subarray(start, start + size)));
    at = start + size;
  }
  return files;
};

const table = {
  header: ['Cliente', 'Total'],
  rows: [['Ana & Filhos', '1234.5'], ['<Bruno>', '-20'], ['Código 00123', '00123'], ['Vazio', '']],
  totals: ['Total', '1214.5'],
  notice: 'Resultado parcial: 2000 registros lidos.',
};

describe('reportResultToXlsx', () => {
  const files = unzip(reportResultToXlsx(table, 'Receita: por cliente / mês'));
  const sheet = files.get('xl/worksheets/sheet1.xml') ?? '';

  it('é um pacote XLSX com as partes que o Excel exige', () => {
    expect([...files.keys()]).toEqual([
      '[Content_Types].xml', '_rels/.rels', 'xl/workbook.xml', 'xl/_rels/workbook.xml.rels', 'xl/styles.xml',
      'xl/worksheets/sheet1.xml',
    ]);
  });

  it('o número é NÚMERO — e o código com zero à esquerda continua texto', () => {
    expect(sheet).toContain('<c r="B4"><v>1234.5</v></c>');
    expect(sheet).toContain('<c r="B5"><v>-20</v></c>');
    expect(sheet).toContain('<c r="B6" t="inlineStr"><is><t xml:space="preserve">00123</t></is></c>');
  });

  it('o texto é escapado, o vazio não vira célula, e o aviso de parcial vai na primeira linha', () => {
    expect(sheet).toContain('Ana &amp; Filhos');
    expect(sheet).toContain('&lt;Bruno&gt;');
    expect(sheet).not.toContain('r="B7"');
    expect(sheet).toContain('<row r="1"><c r="A1" t="inlineStr"><is><t xml:space="preserve">Resultado parcial');
  });

  it('cabeçalho e total em negrito', () => {
    expect(sheet).toContain('<c r="A3" s="1" t="inlineStr">');
    expect(sheet).toContain('<c r="B8" s="1" t="inlineStr"><is><t xml:space="preserve">1214.5</t></is></c>');
  });

  it('a aba se chama como o relatório, sem o que o Excel recusa num nome de aba', () => {
    expect(files.get('xl/workbook.xml')).toContain('<sheet name="Receita  por cliente   mês"');
  });
});

describe('reportFileName', () => {
  it('nome-base, dia e extensão do formato', () => {
    expect(reportFileName('Receita por mês', new Date('2026-11-12T10:00:00Z'), 'xlsx')).toBe('receita-por-mês-2026-11-12.xlsx');
  });
});
