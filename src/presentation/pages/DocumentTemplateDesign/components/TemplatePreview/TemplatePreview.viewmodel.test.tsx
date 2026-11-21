// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { DocumentTemplateSpec } from '../../../../../domain/schema/document/documentTemplate';

const state: {
  loaded: Set<string>;
  options: Record<string, { value: string; label: string }[]>;
  demanded: { collections: readonly string[]; limit: number | undefined }[];
  queries: { slot: string; collection: string | null | undefined; text: string }[];
  previewDocument: ReturnType<typeof vi.fn>;
} = {
  loaded: new Set(),
  options: {},
  demanded: [],
  queries: [],
  previewDocument: vi.fn(),
};

vi.mock('../../../../../stores/useDocumentTemplates', () => ({
  useDocumentTemplates: () => ({ previewDocument: state.previewDocument }),
}));
vi.mock('../../../../../stores/useScreenDefinitions', () => ({
  useScreenDefinitions: () => ({ getDefinition: (id: string) => (id === 'pets' ? { id: 'pets' } : undefined) }),
}));
vi.mock('../../../../../domain/services/screenDataCollection', () => ({
  screenDataCollection: (definition: { id: string }) => definition.id,
}));
vi.mock('../../../../../stores/useRecordDemand', () => ({
  useRecordDemand: (collections: readonly string[], limit?: number) => {
    state.demanded.push({ collections, limit });
  },
}));
vi.mock('../../../../../stores/useRecords', () => ({
  useRecords: () => ({ loadedCollections: state.loaded }),
}));
vi.mock('../../../../hooks/useReferenceOptions', () => ({
  useReferenceOptions: () => state.options,
}));
vi.mock('../../../../shared/useReferenceSearch', () => ({
  useReferenceSearch: () => ({
    onQuery: (slot: string, collection: string | null | undefined, text: string) => {
      state.queries.push({ slot, collection, text });
    },
    matchesFor: () => new Set<string>(),
  }),
}));
vi.mock('../../../../shared/i18n/useT', () => ({
  useLabel: () => (text: string) => text,
}));

const { useTemplatePreviewViewModel } = await import('./TemplatePreview.viewmodel');

const recordTemplate: DocumentTemplateSpec = {
  key: 'pet-card',
  title: 'Pet card',
  collection: 'pets',
  format: 'markdown',
  body: '# {{name}}',
};

beforeEach(() => {
  state.loaded = new Set();
  state.options = {};
  state.demanded = [];
  state.queries = [];
  state.previewDocument = vi.fn(async () => ({ preview: { text: '# Rex', fileName: 'Pet card', output: 'pdf' }, empty: [] }));
});

describe('a prévia de um modelo de tela (#17)', () => {
  it('pede a coleção da tela, em vez de depender de outra tela tê-la carregado', () => {
    renderHook(() => useTemplatePreviewViewModel({ template: recordTemplate }));
    expect(state.demanded.at(-1)).toEqual({ collections: ['pets'], limit: 50 });
  });

  it('não diz que a tela não tem registros enquanto a coleção não respondeu', () => {
    const { result } = renderHook(() => useTemplatePreviewViewModel({ template: recordTemplate }));
    expect(result.current.noRecords).toBe(false);
  });

  it('diz que não há registros só quando a coleção respondeu vazia', () => {
    state.loaded = new Set(['pets']);
    const { result } = renderHook(() => useTemplatePreviewViewModel({ template: recordTemplate }));
    expect(result.current.noRecords).toBe(true);
  });

  it('escolhe o primeiro registro carregado e mescla com ele', async () => {
    state.loaded = new Set(['pets']);
    state.options = { pets: [{ value: 'rex', label: 'Rex' }] };
    const { result } = renderHook(() => useTemplatePreviewViewModel({ template: recordTemplate }));

    expect(result.current.noRecords).toBe(false);
    expect(result.current.recordId).toBe('rex');
    await waitFor(() => expect(result.current.text).toBe('# Rex'));
    expect(state.previewDocument).toHaveBeenCalledWith({ template: recordTemplate, recordId: 'rex' });
  });

  it('busca no servidor, na coleção da tela, o que a pessoa digita', () => {
    const { result } = renderHook(() => useTemplatePreviewViewModel({ template: recordTemplate }));
    act(() => result.current.onRecordQuery('rex'));
    expect(state.queries).toEqual([{ slot: 'preview-record', collection: 'pets', text: 'rex' }]);
  });
});

describe('a prévia de um modelo de dados', () => {
  it('não pede coleção nem busca registro: mescla com o exemplo', () => {
    const payloadTemplate: DocumentTemplateSpec = {
      ...recordTemplate,
      collection: '',
      source: 'payload',
      sample: { name: 'Rex' },
    };
    const { result } = renderHook(() => useTemplatePreviewViewModel({ template: payloadTemplate }));

    expect(state.demanded.at(-1)).toEqual({ collections: [], limit: 50 });
    expect(result.current.noRecords).toBe(false);
    act(() => result.current.onRecordQuery('rex'));
    expect(state.queries).toEqual([{ slot: 'preview-record', collection: null, text: 'rex' }]);
  });
});
