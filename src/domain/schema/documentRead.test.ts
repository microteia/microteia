import { describe, it, expect } from 'vitest';
import { parsePageSelection, readableDocumentKind } from './documentRead';

describe('leitura de documento — páginas e tipos', () => {
  it('vazio é o documento inteiro', () => {
    expect(parsePageSelection('', 3)).toEqual({ ok: true, pages: [1, 2, 3] });
  });

  it('aceita página, intervalo e lista, em ordem e sem repetir', () => {
    expect(parsePageSelection('3, 1-2, 2', 4)).toEqual({ ok: true, pages: [1, 2, 3] });
  });

  it('página que o documento não tem é recusa, não omissão', () => {
    const result = parsePageSelection('2', 1);
    expect(result.ok).toBe(false);
    expect(!result.ok && result.message).toBe('@core.automation/step.read-document.pages-out-of-range');
  });

  it('recusa o que não é número, zero e intervalo invertido', () => {
    for (const spec of ['a', '0', '3-1', '1-']) {
      const result = parsePageSelection(spec, 5);
      expect(!result.ok && result.message).toBe('@core.automation/step.read-document.pages-invalid');
    }
  });

  it('lê PDF e texto; imagem fica de fora', () => {
    expect(readableDocumentKind('application/pdf')).toBe('pdf');
    expect(readableDocumentKind('text/csv; charset=utf-8')).toBe('text');
    expect(readableDocumentKind('application/json')).toBe('text');
    expect(readableDocumentKind('image/png')).toBeNull();
  });
});
