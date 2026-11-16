import { describe, it, expect } from 'vitest';
import { pdfPageText } from './pdfText';

const items = [
  { str: 'CNPJ 00.000.000/0001-00', hasEOL: true },
  { str: 'TUSD', hasEOL: false },
  { str: '  0,83544863 ', hasEOL: false },
  { str: 'R$/kWh', hasEOL: true },
  { str: '', hasEOL: true },
  { str: 'Total' },
  {},
];

describe('texto de uma página de PDF', () => {
  it('flat é o texto que o Processador sempre mandou: uma linha, espaços colapsados', () => {
    expect(pdfPageText(items)).toBe('CNPJ 00.000.000/0001-00 TUSD 0,83544863 R$/kWh Total');
  });

  it('lines preserva a quebra marcada pelo PDF e descarta linhas vazias', () => {
    expect(pdfPageText(items, 'lines')).toBe('CNPJ 00.000.000/0001-00\nTUSD 0,83544863 R$/kWh\nTotal');
  });

  it('página sem texto vira vazio nos dois modos', () => {
    expect(pdfPageText([])).toBe('');
    expect(pdfPageText([], 'lines')).toBe('');
  });
});
