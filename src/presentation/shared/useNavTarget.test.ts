import { describe, expect, it } from 'vitest';
import type { ScreenDefinition } from '../../domain/entities';
import { menuActionTarget, navEntryOf, resolveNavTarget } from './useNavTarget';

const screen = (id: string, sourceId?: string): ScreenDefinition =>
  ({ id, ...(sourceId ? { sourceId } : {}) }) as unknown as ScreenDefinition;

describe('resolveNavTarget', () => {
  it('devolve a chave de aba como está', () => {
    expect(resolveNavTarget({ key: 'reports' }, [], new Set())).toEqual({ tabKey: 'reports' });
  });

  /** O item sobrevive à desambiguação: o pacote dizia `produtos`, o escritório tem `produtos_2`. */
  it('acha a tela pelo sourceId e abre a lista da chave INSTALADA', () => {
    const installed = screen('produtos_2', 'acme:produtos');
    expect(resolveNavTarget({ screenSourceId: 'acme:produtos' }, [screen('produtos'), installed], new Set()))
      .toEqual({ tabKey: 'dyn:produtos_2', screen: installed });
  });

  it('abre a página própria da extensão quando ela tem a chave da tela', () => {
    expect(resolveNavTarget({ screenSourceId: 'acme:news' }, [screen('news', 'acme:news')], new Set(['news']))?.tabKey)
      .toBe('news');
  });

  it('não abre nada quando a tela não está no escritório, ou quando o alvo ficou sem tradução', () => {
    expect(resolveNavTarget({ screenSourceId: 'acme:fora' }, [screen('produtos', 'acme:produtos')], new Set())).toBeNull();
    expect(resolveNavTarget({ screen: 'produtos' }, [screen('produtos')], new Set())).toBeNull();
  });

  it('lê o openTab do menu na mesma forma', () => {
    expect(menuActionTarget({ kind: 'openTab', tabKey: 'profile' })).toEqual({ key: 'profile', screen: undefined, screenSourceId: undefined });
  });
});

describe('navEntryOf', () => {
  const filter = [{ key: 'status', values: ['waiting'] }];

  /** O recado vai para a chave INSTALADA, que é a que a lista assina — não a do pacote. */
  it('endereça o filtro à tela resolvida', () => {
    const installed = screen('conversas_2', 'acme:conversas');
    expect(navEntryOf({ filter }, { tabKey: 'dyn:conversas_2', screen: installed }))
      .toEqual({ tabKey: 'dyn:conversas_2', intent: { screenKey: 'conversas_2', tokens: filter } });
  });

  it('não leva recado quando o item não declara filtro, ou quando o alvo é uma página', () => {
    expect(navEntryOf({}, { tabKey: 'dyn:conversas', screen: screen('conversas') })).toEqual({ tabKey: 'dyn:conversas' });
    expect(navEntryOf({ filter: [] }, { tabKey: 'dyn:conversas', screen: screen('conversas') })).toEqual({ tabKey: 'dyn:conversas' });
    expect(navEntryOf({ filter }, { tabKey: 'reports' })).toEqual({ tabKey: 'reports' });
  });
});
