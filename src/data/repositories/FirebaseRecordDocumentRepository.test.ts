import { describe, expect, it, vi } from 'vitest';

/**
 * O Firestore de verdade recusa `undefined` em qualquer campo; o dublê aqui recusa igual, e é o que prova
 * que anexar sem tipo — e sem foto de quem anexa — chega ao banco sem os campos ausentes.
 */
const added: Record<string, unknown>[] = [];

vi.mock('../../infrastructure/firebase/config', () => ({ db: {}, storage: {} }));
vi.mock('firebase/storage', () => ({}));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  addDoc: async (_ref: unknown, data: Record<string, unknown>) => {
    const undefinedField = Object.entries(data).find(([, value]) => value === undefined);
    if (undefinedField) throw new Error(`Unsupported field value: undefined (found in field ${undefinedField[0]})`);
    added.push(data);
    return { id: 'd1' };
  },
  serverTimestamp: () => 'SERVER_TIME',
}));

const { FirebaseRecordDocumentRepository } = await import('./FirebaseRecordDocumentRepository');

describe('FirebaseRecordDocumentRepository.addDocument', () => {
  it('anexar sem tipo e sem foto grava o documento sem esses campos, em vez de falhar', async () => {
    const created = await new FirebaseRecordDocumentRepository().addDocument('t1', 'bills', 'b1', {
      name: 'conta.pdf',
      type: undefined,
      url: 'https://x',
      storagePath: 'tenants/t1/bills/b1/1_conta.pdf',
      createdBy: 'u1',
      createdByName: 'U',
      createdByPhotoUrl: undefined,
    });
    expect(created.id).toBe('d1');
    expect(added[0]).toEqual({
      name: 'conta.pdf',
      url: 'https://x',
      storagePath: 'tenants/t1/bills/b1/1_conta.pdf',
      createdBy: 'u1',
      createdByName: 'U',
      createdAt: 'SERVER_TIME',
    });
  });
});
