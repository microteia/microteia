// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';
import type { ReactElement } from 'react';

const state: { surfaces: string[]; tabs: { key: string; title: string }[] } = { surfaces: [], tabs: [] };

vi.mock('../settings/useSettingValue', () => ({
  useVisibleSurfaceTabs: (surface: string) => {
    state.surfaces.push(surface);
    return { tabs: state.tabs, registeredCount: state.tabs.length };
  },
}));
vi.mock('../../components/layout/RecordSurfaceTab', () => ({ RecordSurfaceTab: () => null }));

const { useRecordSurfaceTabs } = await import('./useRecordSurfaceTabs');

beforeEach(() => {
  state.surfaces = [];
  state.tabs = [{ key: 'prazos', title: 'Prazos' }, { key: 'financeiro', title: 'Financeiro' }];
});

describe('as abas que extensões penduram no detalhe de um registro', () => {
  it('lê a superfície pelo sourceId da tela, e não pela chave instalada', () => {
    renderHook(() => useRecordSurfaceTabs({ screenSourceId: 'microteia:processo', record: { id: 'p1' }, collection: 'processos' }));
    expect(state.surfaces).toContain('record:microteia:processo');
  });

  it('mantém a ordem resolvida e separa as chaves das abas nativas e das de tela-filha', () => {
    const tabs = renderHook(() => useRecordSurfaceTabs({
      screenSourceId: 'microteia:processo', record: { id: 'p1' }, collection: 'processos',
    })).result.current;
    expect(tabs.map((tab) => [tab.key, tab.label])).toEqual([['surface:prazos', 'Prazos'], ['surface:financeiro', 'Financeiro']]);
  });

  it('entrega à view o registro aberto, a coleção e a tela', () => {
    const record = { id: 'p1', numero: '0001' };
    const [first] = renderHook(() => useRecordSurfaceTabs({
      screenSourceId: 'microteia:processo', record, collection: 'processos_dados',
    })).result.current;
    expect((first.content as ReactElement<{ recordProps: unknown }>).props.recordProps).toEqual({
      recordId: 'p1', record, collection: 'processos_dados', screenSourceId: 'microteia:processo',
    });
  });

  /** Registro novo ainda não tem id: uma aba que lista "os prazos deste processo" não teria o que listar. */
  it('não mostra aba contribuída em registro novo', () => {
    const tabs = renderHook(() => useRecordSurfaceTabs({
      screenSourceId: 'microteia:processo', record: null, collection: 'processos',
    })).result.current;
    expect(tabs).toEqual([]);
  });
});
