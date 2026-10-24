import { describe, expect, it, vi } from 'vitest';
import { makeDeleteRecordUseCase } from './DeleteRecordUseCase';
import type {
  IRecordDocumentRepository,
  IRecordNoteRepository,
  IRecordRepository,
} from '../../repositories/IRecordRepository';

describe('DeleteRecordUseCase', () => {
  const actor = { uid: 'u1', name: 'U', photoURL: '' };

  it('a recusa da janela de edição vem ANTES da cascata: a prova não perde os anexos', async () => {
    const refusal = new Error('closed');
    const repo = { ensureDeletable: vi.fn(async () => { throw refusal; }), delete: vi.fn() } as unknown as IRecordRepository;
    const notes = { getNotes: vi.fn(async () => []), deleteNote: vi.fn() } as unknown as IRecordNoteRepository;
    const documents = { getDocuments: vi.fn(async () => []), deleteDocument: vi.fn() } as unknown as IRecordDocumentRepository;

    await expect(makeDeleteRecordUseCase(repo, notes, documents).execute('t1', 'mensagens', 'r1', actor)).rejects.toBe(refusal);
    expect(notes.getNotes).not.toHaveBeenCalled();
    expect(documents.getDocuments).not.toHaveBeenCalled();
    expect(repo.delete).not.toHaveBeenCalled();
  });

  it('sem recusa, apaga anotações, documentos e então o registro', async () => {
    const order: string[] = [];
    const repo = {
      ensureDeletable: vi.fn(async () => { order.push('ensure'); }),
      delete: vi.fn(async () => { order.push('record'); }),
    } as unknown as IRecordRepository;
    const notes = {
      getNotes: vi.fn(async () => [{ id: 'n1' }]),
      deleteNote: vi.fn(async () => { order.push('note'); }),
    } as unknown as IRecordNoteRepository;
    const documents = {
      getDocuments: vi.fn(async () => [{ id: 'd1', storagePath: 'p' }]),
      deleteDocument: vi.fn(async () => { order.push('document'); }),
    } as unknown as IRecordDocumentRepository;

    await makeDeleteRecordUseCase(repo, notes, documents).execute('t1', 'mensagens', 'r1', actor);
    expect(order).toEqual(['ensure', 'note', 'document', 'record']);
  });
});
