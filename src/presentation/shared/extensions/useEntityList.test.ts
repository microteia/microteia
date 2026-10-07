// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { renderHook } from '@testing-library/react';

const state: { screens: unknown[]; sources: Record<string, unknown>[] } = { screens: [], sources: [] };

vi.mock('../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ dynamicScreens: state.screens }),
}));
vi.mock('../entityScreen/useRecordListViewModel', () => ({
  useRecordListViewModel: (source: Record<string, unknown>) => {
    state.sources.push(source);
    return {};
  },
}));

const { useEntityList } = await import('./useEntityList');

const lastParent = () => state.sources[state.sources.length - 1].parent;

beforeEach(() => {
  state.sources = [];
  state.screens = [{
    id: 'prazos',
    sourceId: 'microteia:prazo',
    parentEntity: 'contratos',
    parentFieldKey: 'contrato',
    fields: [
      { key: 'processo', type: 'reference', refEntity: 'processos' },
      { key: 'contrato', type: 'reference' },
    ],
  }];
});

describe('a lista presa ao registro pai', () => {
  it('sem parent, é a lista de sempre', () => {
    renderHook(() => useEntityList('microteia:prazo'));
    expect(lastParent()).toBeUndefined();
  });

  it('acha a entidade do pai no alvo do campo de referência', () => {
    renderHook(() => useEntityList('microteia:prazo', { parent: { fieldKey: 'processo', recordId: 'p1' } }));
    expect(lastParent()).toEqual({ entityKey: 'processos', fieldKey: 'processo', recordId: 'p1' });
  });

  it('cai no parentEntity da tela quando o campo é o vínculo dela', () => {
    renderHook(() => useEntityList('microteia:prazo', { parent: { fieldKey: 'contrato', recordId: 'c1' } }));
    expect(lastParent()).toEqual({ entityKey: 'contratos', fieldKey: 'contrato', recordId: 'c1' });
  });

  /** A view passa um literal novo a cada render; a trava não pode recomeçar a lista por isso. */
  it('a trava é estável entre renders com o mesmo pai', () => {
    const { rerender } = renderHook(() => useEntityList('microteia:prazo', { parent: { fieldKey: 'processo', recordId: 'p1' } }));
    rerender();
    expect(state.sources[0].parent).toBe(state.sources[state.sources.length - 1].parent);
  });
});
