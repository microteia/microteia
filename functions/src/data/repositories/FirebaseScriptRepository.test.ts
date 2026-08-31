import { describe, it, expect } from 'vitest';
import type { Firestore } from 'firebase-admin/firestore';
import { FirebaseScriptRepository } from './FirebaseScriptRepository';

interface FakeDoc { id: string; data: Record<string, unknown> }

const now = new Date('2026-01-01T00:00:00.000Z');

const makeFakeDb = (docs: FakeDoc[]): Firestore => {
  const collection = {
    doc: (id: string) => ({
      get: async () => {
        const found = docs.find((one) => one.id === id);
        return { exists: found !== undefined, id, data: () => found?.data };
      },
    }),
    where: (field: string, _op: string, value: unknown) => ({
      get: async () => ({
        docs: docs
          .filter((one) => one.data[field] === value)
          .map((one) => ({ id: one.id, data: () => one.data })),
      }),
    }),
  };
  return {
    collection: () => ({ doc: () => ({ collection: () => collection }) }),
  } as unknown as Firestore;
};

const script = (id: string, sourceId: string | null, owners: string[] | null): FakeDoc => ({
  id,
  data: {
    name: id, sourceTs: '', compiledJs: 'x', inputParams: [], outputParams: [],
    sourceId, ownerPluginIds: owners, createdAt: now, updatedAt: now,
  },
});

describe('FirebaseScriptRepository.findByRef', () => {
  const docs = [
    script('normalizar-cpf', 'normalizar-cpf', ['com.acme.utils']),
    script('normalizar-cpf-2', 'normalizar-cpf', ['com.outro.pack']),
    script('meu-script', null, null),
  ];

  it('resolve um id simples pelo documento', async () => {
    const found = await new FirebaseScriptRepository(makeFakeDb(docs)).findByRef('t1', 'meu-script');
    expect(found?.id).toBe('meu-script');
  });

  it('resolve a referência qualificada pelo sourceId da extensão dona', async () => {
    const found = await new FirebaseScriptRepository(makeFakeDb(docs))
      .findByRef('t1', 'com.acme.utils/normalizar-cpf');
    expect(found?.id).toBe('normalizar-cpf');
  });

  /**
   * A instalação deduplica por `sourceId` sem olhar de quem é, então duas extensões sem relação
   * nenhuma podem dividir o nome. Sem o filtro de dono, uma referência devolveria a cópia da outra —
   * uma troca de artefato entre extensões, sem sintoma nenhum.
   */
  it('NÃO resolve quando o sourceId bate e o dono não', async () => {
    const found = await new FirebaseScriptRepository(makeFakeDb(docs))
      .findByRef('t1', 'com.terceiro.pack/normalizar-cpf');
    expect(found).toBeNull();
  });

  it('escolhe a cópia do dono certo quando duas dividem o sourceId', async () => {
    const found = await new FirebaseScriptRepository(makeFakeDb(docs))
      .findByRef('t1', 'com.outro.pack/normalizar-cpf');
    expect(found?.id).toBe('normalizar-cpf-2');
  });
});
