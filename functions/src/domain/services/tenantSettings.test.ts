import { describe, expect, it } from 'vitest';
import { settingsValuesOf } from './tenantSettings';

describe('valores de configuração do escritório', () => {
  /**
   * O formato que o cliente grava: a raiz é do documento, e as chaves declaradas ficam em `values`.
   * Ler a raiz não dá erro — dá uma lista vazia com cara de configuração legítima, que foi o que a
   * ingestão registrou como "Remetentes permitidos: []".
   */
  it('lê as chaves declaradas de dentro de `values`', () => {
    const doc = {
      scope: 'tenant',
      updatedBy: 'u1',
      values: { 'push.allowedSenders': ['pje@tjba.jus.br'] },
    };

    expect(settingsValuesOf(doc)).toEqual({ 'push.allowedSenders': ['pje@tjba.jus.br'] });
  });

  it('devolve vazio quando o documento não existe ou ainda não tem valores', () => {
    expect(settingsValuesOf(undefined)).toEqual({});
    expect(settingsValuesOf({ scope: 'tenant' })).toEqual({});
    expect(settingsValuesOf({ values: ['não é mapa'] })).toEqual({});
  });
});
