import { describe, expect, it } from 'vitest';
import type { DocumentTemplateSpec } from '../../../domain/schema/document/documentTemplate';
import { specOf } from './useDocumentTemplateCatalog';

/**
 * #47, achado no E2E: `specOf` copia o modelo campo a campo, e `encoding`/`lineEnding` ficaram de fora —
 * o designer mostrava UTF-8/LF num modelo gravado em Latin-1/CRLF, e salvar ou clonar por ele os apagava.
 */
const TEXT_TEMPLATE: DocumentTemplateSpec = {
  key: 'layout',
  title: 'Layout',
  collection: 'empresas',
  format: 'text',
  encoding: 'latin1',
  lineEnding: 'crlf',
  outputs: ['txt'],
  body: 'H{{padLeft(code, 6, "0")}}',
};

describe('specOf — o que o designer edita é o modelo inteiro (#47)', () => {
  it('mantém a codificação e a quebra de linha do modelo de texto', () => {
    expect(specOf(TEXT_TEMPLATE)).toMatchObject({ encoding: 'latin1', lineEnding: 'crlf' });
  });

  it('não inventa codificação num modelo que não a declara', () => {
    const spec = specOf({ ...TEXT_TEMPLATE, encoding: undefined, lineEnding: undefined });
    expect('encoding' in spec).toBe(false);
    expect('lineEnding' in spec).toBe(false);
  });
});
