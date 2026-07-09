import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreWorkflowRecordFetcher } from './FirestoreWorkflowRecordFetcher';

const fakeTimestamp = (date: Date): { toDate: () => Date } => ({ toDate: () => date });

const makeFakeDb = (docs: Record<string, Record<string, unknown> | undefined>): Firestore => {
  const fakeDb = {
    doc: (path: string) => ({ path }),
    getAll: (...refs: { path: string }[]) =>
      Promise.resolve(
        refs.map((ref) => {
          const id = ref.path.split('/').pop()!;
          const data = docs[id];
          return { exists: data !== undefined, data: () => data };
        }),
      ),
  };
  return fakeDb as unknown as Firestore;
};

describe('FirestoreWorkflowRecordFetcher', () => {
  it('normaliza Timestamps do documento cru para Date antes de devolver o registro', async () => {
    const draftedAt = new Date('2026-01-01T00:00:00.000Z');
    const db = makeFakeDb({ c1: { number: '001/2026', draftedAt: fakeTimestamp(draftedAt) } });
    const fetcher = new FirestoreWorkflowRecordFetcher(db);

    const result = await fetcher.fetchByIds('tenant1', 'contracts', ['c1']);

    expect(result.get('c1')?.draftedAt).toEqual(draftedAt);
    expect(result.get('c1')?.draftedAt).toBeInstanceOf(Date);
  });

  it('mantém null para documento inexistente', async () => {
    const db = makeFakeDb({});
    const fetcher = new FirestoreWorkflowRecordFetcher(db);

    const result = await fetcher.fetchByIds('tenant1', 'contracts', ['inexistente']);

    expect(result.get('inexistente')).toBeNull();
  });
});
