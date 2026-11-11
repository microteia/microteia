// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type React from 'react';
import type { DocumentsPort, EntityDocument } from './types';

const notified: { text: string; kind: string }[] = [];

vi.mock('../../../stores/useNotification', () => ({
  useNotification: () => ({ notify: (text: string, kind: string) => { notified.push({ text, kind }); } }),
}));
vi.mock('../../../stores/useLookups', () => ({
  useLookups: () => ({ getOptions: () => [], addOption: vi.fn(), removeOption: vi.fn() }),
}));
vi.mock('../i18n/useT', () => ({
  useT: () => (key: string, params?: Record<string, unknown>) => (
    params ? `${key}:${JSON.stringify(params)}` : key
  ),
  useLabel: () => (ref: string) => ref,
}));

const { useEntityDocuments } = await import('./useEntityDocuments');
const { LocalizedError } = await import('../../../domain/errors/LocalizedError');

const arquivo = (name: string): File => new File(['x'], name, { type: 'text/plain' });

const escolha = (...files: File[]): React.ChangeEvent<HTMLInputElement> => ({
  target: { files, value: 'C:\\fakepath' },
} as unknown as React.ChangeEvent<HTMLInputElement>);

const gravados: { name: string; type?: string }[] = [];
const falharEm = new Set<string>();
const recusarEm = new Set<string>();

const port: DocumentsPort = {
  get: async () => [],
  upload: async (_recordId, file) => {
    if (falharEm.has(file.name)) throw new Error('storage fora do ar');
    if (recusarEm.has(file.name)) throw new LocalizedError('@core.ui/documents.upload-denied');
    return { url: `https://files/${file.name}`, storagePath: `p/${file.name}` };
  },
  add: async (_recordId, input) => {
    gravados.push({ name: input.name, type: input.type });
    return { id: input.name, createdByName: 'Ana', createdAt: new Date(), ...input } as EntityDocument;
  },
  remove: async () => {},
};

const montar = () => renderHook(() => useEntityDocuments({ enabled: true, recordId: 'r1', port }));

beforeEach(() => {
  notified.length = 0;
  gravados.length = 0;
  falharEm.clear();
  recusarEm.clear();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

/**
 * Anexar um documento por vez é um custo que cresce com o lote: quem chega com dez arquivos de um
 * processo repete dez vezes o mesmo caminho de tela. O tipo continua sendo de cada arquivo — é por
 * isso que a fila guarda o par, e não um tipo só para todos.
 */
describe('fila de envio de documentos', () => {
  it('enfileira um item por arquivo escolhido, e a escolha seguinte SOMA à fila', () => {
    const { result } = montar();

    act(() => { result.current.handleSelectFiles(escolha(arquivo('a.pdf'), arquivo('b.pdf'))); });
    expect(result.current.pendingUploads.map((p) => p.file.name)).toEqual(['a.pdf', 'b.pdf']);

    act(() => { result.current.handleSelectFiles(escolha(arquivo('c.pdf'))); });
    expect(result.current.pendingUploads.map((p) => p.file.name)).toEqual(['a.pdf', 'b.pdf', 'c.pdf']);
    expect(new Set(result.current.pendingUploads.map((p) => p.id)).size).toBe(3);
  });

  it('cada arquivo viaja com o tipo que foi informado NELE', async () => {
    const { result } = montar();

    act(() => { result.current.handleSelectFiles(escolha(arquivo('a.pdf'), arquivo('b.pdf'))); });
    const [primeiro, segundo] = result.current.pendingUploads;
    act(() => { result.current.setPendingUploadType(primeiro.id, 'contrato'); });
    act(() => { result.current.setPendingUploadType(segundo.id, 'recibo'); });

    await act(async () => { await result.current.handleConfirmUpload(); });

    expect(gravados).toEqual([
      { name: 'a.pdf', type: 'contrato' },
      { name: 'b.pdf', type: 'recibo' },
    ]);
    expect(result.current.pendingUploads).toEqual([]);
    expect(result.current.documents.map((d) => d.id)).toEqual(['b.pdf', 'a.pdf']);
    expect(notified.at(-1)?.kind).toBe('success');
  });

  it('o que falhou FICA na fila, com o tipo já informado; o que subiu sai', async () => {
    falharEm.add('b.pdf');
    const { result } = montar();

    act(() => { result.current.handleSelectFiles(escolha(arquivo('a.pdf'), arquivo('b.pdf'))); });
    const pendenteB = result.current.pendingUploads[1];
    act(() => { result.current.setPendingUploadType(pendenteB.id, 'recibo'); });

    await act(async () => { await result.current.handleConfirmUpload(); });

    await waitFor(() => expect(result.current.isUploadingDoc).toBe(false));
    expect(result.current.pendingUploads.map((p) => [p.file.name, p.type, p.status])).toEqual([
      ['b.pdf', 'recibo', 'failed'],
    ]);
    expect(result.current.documents.map((d) => d.id)).toEqual(['a.pdf']);
    expect(notified.at(-1)?.kind).toBe('error');
  });

  it('a recusa das regras chega à tela pelo motivo dela, e não como falha genérica', async () => {
    recusarEm.add('a.pdf');
    const { result } = montar();

    act(() => { result.current.handleSelectFiles(escolha(arquivo('a.pdf'))); });
    await act(async () => { await result.current.handleConfirmUpload(); });

    await waitFor(() => expect(result.current.isUploadingDoc).toBe(false));
    expect(notified.at(-1)).toEqual({ text: '@core.ui/documents.upload-denied', kind: 'error' });
    expect(result.current.pendingUploads.map((p) => p.status)).toEqual(['failed']);
    expect(console.error).toHaveBeenCalled();
  });

  it('tirar um item da fila não mexe nos outros, e cancelar limpa tudo', () => {
    const { result } = montar();

    act(() => { result.current.handleSelectFiles(escolha(arquivo('a.pdf'), arquivo('b.pdf'))); });
    act(() => { result.current.removePendingUpload(result.current.pendingUploads[0].id); });
    expect(result.current.pendingUploads.map((p) => p.file.name)).toEqual(['b.pdf']);

    act(() => { result.current.handleCancelPendingUpload(); });
    expect(result.current.pendingUploads).toEqual([]);
  });
});
