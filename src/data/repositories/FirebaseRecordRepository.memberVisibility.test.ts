import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * A leitura do FRONT numa tela com visibilidade por registro: a assinatura leva o filtro que a regra
 * prova, com a forma exata que `rules-tests/memberVisibility.test.ts` exercita contra o emulador — é a
 * metade que não precisa de Java para ser conferida.
 */

interface FakeQuery { constraints: unknown[] }
interface FakeSnapshotDoc { id: string; data: () => Record<string, unknown> }

const subscribed: FakeQuery[] = [];
let snapshotDocs: FakeSnapshotDoc[] = [];
let readBackDenied = false;

vi.mock('../../infrastructure/firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (parent: { path: string }, id?: string) => ({ path: `${parent.path}/${id ?? 'auto'}`, id: id ?? 'auto' }),
  getDoc: async () => {
    if (readBackDenied) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
    return { exists: () => true, data: () => ({ texto: 'lido' }), id: 'r1' };
  },
  getDocs: async () => {
    throw Object.assign(new Error('denied'), { code: 'permission-denied' });
  },
  addDoc: async () => ({ path: 'tenants/t1/respostas/novo', id: 'novo' }),
  setDoc: async () => {},
  updateDoc: async () => {},
  deleteDoc: async () => {},
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
  serverTimestamp: () => 'SERVER_TIME',
  onSnapshot: (query: FakeQuery, onNext: (snap: { docs: FakeSnapshotDoc[] }) => void) => {
    subscribed.push(query);
    onNext({ docs: snapshotDocs });
    return () => {};
  },
  query: (_ref: unknown, ...constraints: unknown[]) => ({ constraints }),
  or: (...filters: unknown[]) => ({ or: filters }),
  where: (field: string, op: string, value: unknown) => ({ where: [field, op, value] }),
  orderBy: (field: string, dir: string) => ({ orderBy: [field, dir] }),
  limit: (count: number) => ({ limit: count }),
  Timestamp: class {},
}));

const { FirebaseRecordRepository } = await import('./FirebaseRecordRepository');
const { setRecordRulesScreens } = await import('../utils/recordRulesGate');

const repo = new FirebaseRecordRepository();
const SPEC = { userFields: ['emissor', 'equipe'] };

beforeEach(() => {
  subscribed.length = 0;
  snapshotDocs = [];
  readBackDenied = false;
  setRecordRulesScreens([{
    id: 'respostas',
    titleSingular: 'Resposta',
    titleFieldKey: 'texto',
    fields: [{ key: 'texto', label: 'texto', type: 'text', required: false, order: 0, origin: 'plugin' }],
  }]);
});

describe('a assinatura de quem a visibilidade restringe', () => {
  it('leva o `or()` que a regra prova — e perde o `orderBy`, que pediria índice composto por campo', () => {
    repo.subscribe('t1', 'respostas', () => {}, undefined, { uid: 'ana', spec: SPEC });
    expect(subscribed[0].constraints).toEqual([
      {
        or: [
          { where: ['emissor', '==', 'ana'] },
          { where: ['emissor', 'array-contains', 'ana'] },
          { where: ['equipe', '==', 'ana'] },
          { where: ['equipe', 'array-contains', 'ana'] },
        ],
      },
      { limit: 500 },
    ]);
  });

  it('a ordem volta em memória: mais recentes primeiro, como a lista sempre mostrou', () => {
    snapshotDocs = [
      { id: 'velho', data: () => ({ emissor: 'ana', createdAt: new Date('2026-01-01') }) },
      { id: 'novo', data: () => ({ emissor: 'ana', createdAt: new Date('2026-10-01') }) },
    ];
    let ids: string[] = [];
    repo.subscribe('t1', 'respostas', (records) => { ids = records.map((record) => record.id); }, undefined, { uid: 'ana', spec: SPEC });
    expect(ids).toEqual(['novo', 'velho']);
  });

  it('a declaração sem campo não consulta: não há filtro que a regra aceite, e a lista é vazia', () => {
    let delivered: unknown[] | null = null;
    repo.subscribe('t1', 'respostas', (records) => { delivered = records; }, undefined, { uid: 'ana', spec: { userFields: [] } });
    expect(subscribed).toHaveLength(0);
    expect(delivered).toEqual([]);
  });

  it('quem não é restringido assina como sempre', () => {
    repo.subscribe('t1', 'respostas', () => {});
    expect(subscribed[0].constraints).toEqual([{ orderBy: ['createdAt', 'desc'] }, { limit: 500 }]);
  });
});

describe('gravar numa tela com visibilidade por registro', () => {
  it('criar nomeando OUTRA pessoa não quebra quando a releitura é recusada — o registro existe, só não é seu', async () => {
    readBackDenied = true;
    const created = await repo.create('t1', 'respostas', { texto: 'para a bia', emissor: 'bia' } as never);
    expect(created).toMatchObject({ id: 'novo', texto: 'para a bia', emissor: 'bia', collection: 'respostas' });
  });

  it('sem como saber se a coleção está vazia, a resposta é "tem registros" — a exclusão da tela não passa', async () => {
    await expect(repo.hasRecords('t1', 'respostas')).resolves.toBe(true);
  });
});
