import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O caminho de gravação do FRONT com janela de edição declarada: a recusa chega ANTES da rede, com o
 * motivo, e nada é escrito. A regra de verdade — a que vale contra quem grava direto no banco — tem o
 * próprio teste, contra o emulador (`rules-tests/editWindow.test.ts`).
 */

const store = new Map<string, Record<string, unknown>>();
const writes: string[] = [];

vi.mock('../../infrastructure/firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (parent: { path: string }, id?: string) => ({ path: `${parent.path}/${id ?? 'auto'}`, id: id ?? 'auto' }),
  getDoc: async (ref: { path: string }) => ({
    exists: () => store.has(ref.path),
    data: () => store.get(ref.path),
    id: ref.path.split('/').pop(),
  }),
  getDocs: async () => ({ empty: true, docs: [] }),
  addDoc: async () => ({ path: 'x', id: 'x' }),
  setDoc: async () => {},
  updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    writes.push(`update ${ref.path}`);
    store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
  },
  deleteDoc: async (ref: { path: string }) => { writes.push(`delete ${ref.path}`); store.delete(ref.path); },
  writeBatch: () => ({ set() {}, update() {}, delete() {}, commit: async () => {} }),
  serverTimestamp: () => 'SERVER_TIME',
  onSnapshot: () => () => {},
  query: (...args: unknown[]) => args,
  orderBy: () => 'orderBy',
  limit: () => 'limit',
  Timestamp: class { static now() { return 'NOW'; } },
}));
vi.mock('../utils/stampDeletionActor', () => ({
  stampDeletionActor: vi.fn(async (ref: { path: string }) => { writes.push(`stamp ${ref.path}`); }),
}));

const { FirebaseRecordRepository } = await import('./FirebaseRecordRepository');
const { setRecordRulesScreens, EditWindowClosedError } = await import('../utils/recordRulesGate');

const repo = new FirebaseRecordRepository();
const TENANT = 't1';
const RECORD = (id: string) => `tenants/${TENANT}/mensagens/${id}`;
const actor = { uid: 'u1', name: 'U', photoURL: '' };
const at = (minutesAgo: number) => ({ toMillis: () => Date.now() - minutesAgo * 60_000 });

beforeEach(() => {
  store.clear();
  writes.length = 0;
  setRecordRulesScreens([{
    id: 'mensagens',
    titleSingular: 'Mensagem',
    titleFieldKey: 'texto',
    fields: [
      { key: 'texto', label: 'texto', type: 'text', required: false, order: 0, origin: 'plugin' },
      { key: 'lida', label: 'lida', type: 'checkbox', required: false, order: 1, origin: 'plugin' },
    ],
    editWindow: { minutes: 15, delete: true },
    memberWritableFields: ['lida'],
  }]);
});

describe('janela de edição no repositório do front', () => {
  it('altera dentro do prazo', async () => {
    store.set(RECORD('r1'), { texto: 'oi', createdAt: at(1) });
    await repo.update(TENANT, 'mensagens', 'r1', { texto: 'olá' } as never);
    expect(store.get(RECORD('r1'))?.texto).toBe('olá');
  });

  it('fora do prazo, recusa com o motivo e não escreve nada', async () => {
    store.set(RECORD('r1'), { texto: 'oi', createdAt: at(60) });
    const attempt = repo.update(TENANT, 'mensagens', 'r1', { texto: 'olá' } as never);
    await expect(attempt).rejects.toBeInstanceOf(EditWindowClosedError);
    await expect(attempt).rejects.toMatchObject({
      message: '@core.records/edit-window.update-closed',
      messageParams: { minutes: '15' },
    });
    expect(writes).toEqual([]);
  });

  it('fora do prazo, o formulário que reenvia tudo igual e muda só o campo de membro passa', async () => {
    store.set(RECORD('r1'), { texto: 'oi', lida: false, createdAt: at(60) });
    await repo.update(TENANT, 'mensagens', 'r1', { texto: 'oi', lida: true } as never);
    expect(store.get(RECORD('r1'))?.lida).toBe(true);
  });

  it('com `delete: true`, recusa excluir fora do prazo antes do carimbo de exclusão', async () => {
    store.set(RECORD('r1'), { texto: 'oi', createdAt: at(60) });
    await expect(repo.delete(TENANT, 'mensagens', 'r1', actor)).rejects.toBeInstanceOf(EditWindowClosedError);
    expect(writes).toEqual([]);
    await expect(repo.ensureDeletable(TENANT, 'mensagens', 'r1')).rejects.toBeInstanceOf(EditWindowClosedError);
  });

  it('dentro do prazo, exclui', async () => {
    store.set(RECORD('r1'), { texto: 'oi', createdAt: at(1) });
    await repo.delete(TENANT, 'mensagens', 'r1', actor);
    expect(writes).toEqual([`stamp ${RECORD('r1')}`, `delete ${RECORD('r1')}`]);
  });
});
