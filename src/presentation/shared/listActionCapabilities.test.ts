import { describe, expect, it } from 'vitest';
import { resolveListActions, supportedListActions } from './listActionCapabilities';

describe('supportedListActions', () => {
  it('Prazos não oferece etiquetas nem duplicar — a entidade não suporta', () => {
    expect(supportedListActions('deadlines')).toEqual(['copyLink', 'delete']);
  });

  it('as demais telas fixas oferecem as quatro', () => {
    for (const key of ['persons', 'cases', 'contracts', 'financials']) {
      expect(supportedListActions(key)).toHaveLength(4);
    }
  });

  it('tela desconhecida não oferece nada', () => {
    expect(supportedListActions('vendas')).toEqual([]);
  });
});

describe('resolveListActions — sem configuração, mantém o card de hoje', () => {
  it('lista vazia cai no padrão da tela', () => {
    expect(resolveListActions('persons', [])).toEqual(['manageTags']);
    expect(resolveListActions('financials', [])).toEqual(['delete']);
    expect(resolveListActions('deadlines', [])).toEqual(['delete']);
    expect(resolveListActions('cases', [])).toEqual([]);
  });

  it('undefined (tela fixa sem definição gravada) também cai no padrão', () => {
    expect(resolveListActions('persons', undefined)).toEqual(['manageTags']);
  });

  it('configuração explícita prevalece sobre o padrão', () => {
    expect(resolveListActions('persons', ['copyLink', 'delete'])).toEqual(['copyLink', 'delete']);
  });

  it('descarta ação que a entidade não suporta, mesmo se gravada', () => {
    expect(resolveListActions('deadlines', ['manageTags', 'clone', 'copyLink']))
      .toEqual(['copyLink']);
  });
});
