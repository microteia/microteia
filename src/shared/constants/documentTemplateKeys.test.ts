import { describe, expect, it } from 'vitest';
import {
  DOCUMENT_TEMPLATE_DESIGN_TAB,
  buildDocumentTemplateCloneTabKey,
  buildDocumentTemplateDesignTabKey,
  parseDocumentTemplateDesignTabKey,
} from './documentTemplateKeys';

describe('abas da autoria de modelo de documento', () => {
  it('sem sufixo, a aba cria um modelo novo', () => {
    expect(parseDocumentTemplateDesignTabKey(DOCUMENT_TEMPLATE_DESIGN_TAB)).toEqual({ mode: 'new' });
  });

  it('a chave do modelo volta inteira, hífens incluídos', () => {
    expect(parseDocumentTemplateDesignTabKey(buildDocumentTemplateDesignTabKey('acme-recibo')))
      .toEqual({ mode: 'edit', key: 'acme-recibo' });
  });

  it('o clone aponta para o original, e não para uma chave "clone:…" da autoria', () => {
    expect(parseDocumentTemplateDesignTabKey(buildDocumentTemplateCloneTabKey('acme-recibo')))
      .toEqual({ mode: 'clone', key: 'acme-recibo' });
  });
});
