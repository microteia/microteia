import { describe, expect, it } from 'vitest';
import {
  PORTAL_TEXT_MAX_LENGTH,
  asPortalTextOverride,
  portalContentOf,
  portalTextDocId,
} from './portalText';

const LAW = '@br.gov.dte.legislacao/portal.legislacao';
const bundle = (namespace: string, locale: string, messages: Record<string, string>) => ({ locale, namespace, messages });

describe('texto do portal editado pelo escritório', () => {
  it('o id do documento troca a barra por dois-pontos — e só de referência', () => {
    expect(portalTextDocId(LAW)).toBe('br.gov.dte.legislacao:portal.legislacao');
    expect(portalTextDocId('Legislação')).toBeNull();
    expect(portalTextDocId('@semchave')).toBeNull();
  });

  it('o documento é lido com desconfiança: idioma inválido, texto vazio e o que passa do teto saem', () => {
    expect(asPortalTextOverride({
      ref: LAW,
      texts: { 'pt-br': 'Lei', en: '   ', 'xx yy': 'nope', es: 'x'.repeat(PORTAL_TEXT_MAX_LENGTH + 1), fr: 3 },
    })).toEqual({ ref: LAW, texts: { 'pt-BR': 'Lei' } });
    expect(asPortalTextOverride({ ref: LAW, texts: {} })).toBeNull();
    expect(asPortalTextOverride({ ref: 'texto solto', texts: { en: 'x' } })).toBeNull();
    expect(asPortalTextOverride(null)).toBeNull();
  });
});

describe('o texto de um nó markdown', () => {
  const bundles = [
    bundle('br.gov.dte.legislacao', 'pt-BR', { 'portal.legislacao': 'Lei do pacote' }),
    bundle('br.gov.dte.legislacao', 'en', { 'portal.legislacao': 'Package law' }),
  ];

  it('vem do bundle instalado, de qualquer namespace, no idioma de quem lê', () => {
    expect(portalContentOf(bundles, [], 'pt-BR')(LAW)).toBe('Lei do pacote');
    expect(portalContentOf(bundles, [], 'en')(LAW)).toBe('Package law');
  });

  it('a edição do escritório vence no MESMO idioma, e só nele', () => {
    const overrides = [{ ref: LAW, texts: { 'pt-BR': 'Lei corrigida' } }];
    expect(portalContentOf(bundles, overrides, 'pt-BR')(LAW)).toBe('Lei corrigida');
    expect(portalContentOf(bundles, overrides, 'en')(LAW)).toBe('Package law');
  });

  it('a edição num idioma genérico não passa por cima do pacote no específico', () => {
    const overrides = [{ ref: LAW, texts: { en: 'Edited' } }];
    expect(portalContentOf(bundles, overrides, 'pt-BR')(LAW)).toBe('Lei do pacote');
    expect(portalContentOf([], overrides, 'pt-BR')(LAW)).toBe('Edited');
  });

  it('sem edição nem bundle com a chave, não há texto — e o que não é referência também não', () => {
    const contentOf = portalContentOf(bundles, [], 'pt-BR');
    expect(contentOf('@br.gov.dte.legislacao/outra')).toBeNull();
    expect(contentOf('# Texto solto')).toBeNull();
  });
});
