import { describe, it, expect } from 'vitest';
import { isMessageRef, parseMessageRef, resolveLabel, resolveOptionalLabel } from './messageRef';
import { buildMessageCatalog } from './messages';

const catalog = buildMessageCatalog(
  [
    {
      locale: 'pt-BR',
      namespace: 'com.microteia.processo',
      messages: { 'screen.title': 'Processo' },
    },
  ],
  'pt-BR',
);

describe('isMessageRef', () => {
  it('reconhece a referência', () => {
    expect(isMessageRef('@com.microteia.processo/screen.title')).toBe(true);
  });

  it('não confunde e-mail com referência', () => {
    expect(isMessageRef('suporte@microteia.app')).toBe(false);
  });

  it('exige namespace e chave', () => {
    expect(isMessageRef('@sem-barra')).toBe(false);
    expect(isMessageRef('@/chave')).toBe(false);
    expect(isMessageRef('')).toBe(false);
    expect(isMessageRef(null)).toBe(false);
  });
});

describe('parseMessageRef', () => {
  it('separa namespace, chave e a chave plena', () => {
    expect(parseMessageRef('@com.microteia.processo/screen.title')).toEqual({
      namespace: 'com.microteia.processo',
      key: 'screen.title',
      full: 'com.microteia.processo/screen.title',
    });
  });

  it('devolve null para o que não é referência', () => {
    expect(parseMessageRef('Processo')).toBeNull();
  });
});

describe('resolveLabel', () => {
  it('traduz o que a EXTENSÃO declarou', () => {
    expect(resolveLabel(catalog, '@com.microteia.processo/screen.title')).toBe('Processo');
  });

  /**
   * O outro lado da mesma regra: o que o escritório digitou no Form Design não começa com `@` e
   * portanto fica intocado. É assim que dado do tenant permanece fora da tradução.
   */
  it('deixa passar intacto o que o ESCRITÓRIO digitou', () => {
    expect(resolveLabel(catalog, 'Contrato de Locação')).toBe('Contrato de Locação');
  });

  it('volta ao texto cru da referência quando a chave não existe', () => {
    expect(resolveLabel(catalog, '@com.acme.docs/sumiu')).toBe('com.acme.docs/sumiu');
  });

  it('trata ausência como string vazia', () => {
    expect(resolveLabel(catalog, null)).toBe('');
    expect(resolveLabel(catalog, undefined)).toBe('');
  });
});

describe('resolveOptionalLabel', () => {
  it('preserva a ausência em vez de virar string vazia', () => {
    expect(resolveOptionalLabel(catalog, null)).toBeNull();
    expect(resolveOptionalLabel(catalog, undefined)).toBeUndefined();
    expect(resolveOptionalLabel(catalog, '@com.microteia.processo/screen.title')).toBe('Processo');
  });
});
