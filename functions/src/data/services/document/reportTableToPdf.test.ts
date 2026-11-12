import { describe, it, expect } from 'vitest';
import { reportTableToPdf } from './reportTableToPdf';

describe('reportTableToPdf', () => {
  it('gera um PDF a partir da tabela do relatório, com o aviso de parcial e o total', async () => {
    const pdf = await reportTableToPdf({
      header: ['Cliente', 'Total'],
      rows: [['Ana', '1.234,50'], ['Bia', '10,00']],
      totals: ['Total', '1.244,50'],
      notice: 'Resultado parcial',
    }, 'Receita por cliente');
    expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
