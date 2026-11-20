import { describe, expect, it } from 'vitest';
import { PdfjsTextExtractor } from './PdfjsTextExtractor';
import { reportTableToPdf } from './document/reportTableToPdf';
import { PdfUnreadableError } from '../../domain/repositories/IPdfTextExtractor';
import { pdfPageText } from '../../domain/schema/pdfText';

/**
 * A biblioteca DE VERDADE, sobre um PDF gerado aqui mesmo: é o que prova que o import ESM sobrevive à
 * compilação CommonJS das functions — o defeito que nenhum dublê pegaria.
 */
describe('PdfjsTextExtractor', () => {
  it('lê a camada de texto de um PDF real, com as quebras de linha que ele marca', async () => {
    const pdf = await reportTableToPdf({ header: ['Item', 'Valor'], rows: [['TUSD', '0,83544863']] }, 'Conta de teste');
    const opened = await new PdfjsTextExtractor().open(new Uint8Array(pdf));
    try {
      expect(opened.pageCount).toBe(1);
      const items = await opened.pageItems(1);
      expect(pdfPageText(items)).toContain('0,83544863');
      expect(pdfPageText(items, 'lines').split('\n')[0]).toBe('Conta de teste');
    } finally {
      await opened.close();
    }
  }, 30_000);

  it('o arquivo que não é PDF é ilegível, não exceção crua', async () => {
    await expect(new PdfjsTextExtractor().open(new Uint8Array(Buffer.from('não sou um pdf'))))
      .rejects.toBeInstanceOf(PdfUnreadableError);
  }, 30_000);
});

describe('PdfjsTextExtractor — um PDF aberto por vez (#6)', () => {
  it('o segundo só abre depois que o primeiro fecha, e a recusa de um arquivo não prende a fila', async () => {
    const pdf = new Uint8Array(await reportTableToPdf({ header: ['Item'], rows: [['A']] }, 'Fila'));
    const extractor = new PdfjsTextExtractor();

    await expect(extractor.open(new Uint8Array(Buffer.from('não sou um pdf')))).rejects.toBeInstanceOf(PdfUnreadableError);

    const first = await extractor.open(pdf.slice());
    let secondOpened = false;
    const second = extractor.open(pdf.slice()).then((opened) => {
      secondOpened = true;
      return opened;
    });
    await new Promise((resolve) => { setTimeout(resolve, 50); });
    expect(secondOpened).toBe(false);

    await first.close();
    await first.close();
    const opened = await second;
    expect(secondOpened).toBe(true);
    await opened.close();
  }, 30_000);
});
