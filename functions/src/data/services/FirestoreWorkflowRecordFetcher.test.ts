import { beforeEach, describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirestoreWorkflowRecordFetcher } from './FirestoreWorkflowRecordFetcher';

const fakeTimestamp = (date: Date): { toDate: () => Date } => ({ toDate: () => date });

const calls: number[] = [];

const makeFakeDb = (docs: Record<string, Record<string, unknown> | undefined>): Firestore => {
  const fakeDb = {
    doc: (path: string) => ({ path }),
    getAll: (...refs: { path: string }[]) => {
      calls.push(refs.length);
      return Promise.resolve(
        refs.map((ref) => {
          const id = ref.path.split('/').pop()!;
          const data = docs[id];
          return { exists: data !== undefined, data: () => data };
        }),
      );
    },
  };
  return fakeDb as unknown as Firestore;
};

beforeEach(() => { calls.length = 0; });

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

/**
 * O LOTE, e o alinhamento que ele pode quebrar.
 *
 * A busca passou a servir o relatório, que varre até 2000 linhas: um `getAll` único com 2000 refs
 * está acima do que o gRPC aceita, e a falha seria da chamada inteira. O risco do lote é o índice —
 * juntar os lotes de volta e casar cada resultado com o id certo.
 */
describe('lotes', () => {
  const many = (count: number): Record<string, Record<string, unknown>> =>
    Object.fromEntries(Array.from({ length: count }, (_, index) => [`r${index}`, { ordem: index }]));

  it('quebra em lotes de 300 em vez de mandar tudo de uma vez', async () => {
    const total = 750;
    const fetcher = new FirestoreWorkflowRecordFetcher(makeFakeDb(many(total)));

    await fetcher.fetchByIds('t1', 'lancamentos', Object.keys(many(total)));

    expect(calls).toEqual([300, 300, 150]);
  });

  it('cada id continua casado com o SEU documento depois de juntar os lotes', async () => {
    const total = 750;
    const docs = many(total);
    const fetcher = new FirestoreWorkflowRecordFetcher(makeFakeDb(docs));

    const result = await fetcher.fetchByIds('t1', 'lancamentos', Object.keys(docs));

    expect(result.size).toBe(total);
    // As bordas dos lotes são onde um deslocamento apareceria.
    for (const index of [0, 299, 300, 599, 600, 749]) {
      expect(result.get(`r${index}`), `r${index}`).toEqual({ ordem: index });
    }
  });

  it('não chama o banco quando não há id nenhum', async () => {
    const fetcher = new FirestoreWorkflowRecordFetcher(makeFakeDb({}));

    expect((await fetcher.fetchByIds('t1', 'lancamentos', [])).size).toBe(0);
    expect(calls).toEqual([]);
  });
});
