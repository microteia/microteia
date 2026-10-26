import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * O caminho de gravação do FRONT com campo numerado (`autoValue.sequence`).
 *
 * A transação aqui é uma imitação FIEL no ponto que importa: ela registra a versão de cada documento
 * lido e, no commit, recusa se algum deles mudou — e recusa o CONTADOR como o emulador recusa, com
 * `permission-denied` vindo da regra. É isso que permite provar, sem emulador, que o repositório lê o
 * contador DENTRO da transação, grava no registro o valor que leu e recomeça quando perde a corrida:
 * um repositório que lesse fora dela daria o mesmo número a dois registros.
 * A trava da regra (o contador só avança de um em um) tem o próprio teste, contra o emulador
 * (`rules-tests/recordSequences.test.ts`).
 */

interface Entry {
  data: Record<string, unknown>;
  version: number;
}

const store = new Map<string, Entry>();
let transactions = 0;
let retries = 0;
let nextId = 0;

const tick = () => new Promise<void>((resolve) => { setTimeout(resolve, Math.floor(Math.random() * 3)); });

const write = (path: string, data: Record<string, unknown>) =>
  store.set(path, { data, version: (store.get(path)?.version ?? 0) + 1 });

vi.mock('../../infrastructure/firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (parent: { path?: string }, ...segments: string[]) => {
    const docId = segments.length > 0 ? segments[segments.length - 1] : `auto${(nextId += 1)}`;
    const base = parent.path ? [parent.path, ...segments.slice(0, -1)] : segments.slice(0, -1);
    return { path: [...base, docId].join('/'), id: docId };
  },
  getDoc: async (ref: { path: string }) => ({
    exists: () => store.has(ref.path),
    data: () => store.get(ref.path)?.data,
    id: ref.path.split('/').pop(),
  }),
  getDocs: async () => ({ empty: true, docs: [] }),
  addDoc: async (parent: { path: string }, data: Record<string, unknown>) => {
    const id = `auto${(nextId += 1)}`;
    write(`${parent.path}/${id}`, data);
    return { path: `${parent.path}/${id}`, id };
  },
  setDoc: async (ref: { path: string }, data: Record<string, unknown>) => { write(ref.path, data); },
  updateDoc: async (ref: { path: string }, data: Record<string, unknown>) => {
    write(ref.path, { ...(store.get(ref.path)?.data ?? {}), ...data });
  },
  deleteDoc: async (ref: { path: string }) => { store.delete(ref.path); },
  writeBatch: () => {
    const pending: [string, Record<string, unknown>][] = [];
    return {
      set: (ref: { path: string }, data: Record<string, unknown>) => { pending.push([ref.path, data]); },
      update: () => {},
      delete: () => {},
      commit: async () => { for (const [path, data] of pending) write(path, data); },
    };
  },
  runTransaction: async (_db: unknown, run: (tx: unknown) => Promise<unknown>) => {
    transactions += 1;
    for (let attempt = 0; attempt < 100; attempt += 1) {
      const reads = new Map<string, number>();
      const pending: [string, Record<string, unknown>][] = [];
      const tx = {
        get: async (ref: { path: string }) => {
          await tick();
          const entry = store.get(ref.path);
          reads.set(ref.path, entry?.version ?? 0);
          return { exists: () => !!entry, data: () => entry?.data };
        },
        set: (ref: { path: string }, data: Record<string, unknown>) => { pending.push([ref.path, data]); return tx; },
      };
      const result = await run(tx);
      await tick();
      // Conferir e aplicar no MESMO trecho síncrono: é o commit atômico do servidor. Um contador lido
      // velho é recusado pela REGRA ("avança exatamente um"), que o Firestore avalia antes da
      // precondição — e chega como `permission-denied`, que o SDK não repete. O documento comum
      // lido velho é conflito de precondição, e esse o SDK repete sozinho.
      const stale = [...reads].filter(([path, version]) => (store.get(path)?.version ?? 0) !== version);
      if (stale.some(([path]) => path.includes('/recordSequences/'))) {
        retries += 1;
        throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      }
      if (stale.length > 0) continue;
      for (const [path, data] of pending) write(path, data);
      return result;
    }
    throw new Error('aborted');
  },
  serverTimestamp: () => 'SERVER_TIME',
  onSnapshot: () => () => {},
  query: (...args: unknown[]) => args,
  orderBy: () => 'orderBy',
  limit: () => 'limit',
  or: (...args: unknown[]) => args,
  where: (...args: unknown[]) => args,
  Timestamp: class { static now() { return 'NOW'; } },
}));

const { FirebaseRecordRepository } = await import('./FirebaseRecordRepository');
const { setRecordRulesScreens, RecordSequenceParentMissingError } = await import('../utils/recordRulesGate');
const { setAmbientTimeZone } = await import('../../domain/schema/clockGate');

const repo = new FirebaseRecordRepository();
const TENANT = 't1';
const COUNTERS = `tenants/${TENANT}/recordSequences`;

const field = (key: string, extra: Record<string, unknown> = {}) => ({
  key, label: key, type: 'text', required: false, order: 0, origin: 'plugin', ...extra,
});

const recordsOf = (collection: string): Record<string, unknown>[] =>
  [...store.entries()]
    .filter(([path]) => path.startsWith(`tenants/${TENANT}/${collection}/`))
    .map(([, entry]) => entry.data);

beforeEach(() => {
  store.clear();
  transactions = 0;
  retries = 0;
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date('2026-03-10T15:00:00Z'));
  setAmbientTimeZone('America/Sao_Paulo');
  setRecordRulesScreens([
    {
      id: 'comunicacoes',
      titleSingular: 'Comunicação',
      titleFieldKey: 'assunto',
      fields: [
        field('assunto'),
        field('protocolo', { autoValue: { pattern: 'YYYY/000000', sequence: { resetBy: 'year' } } }),
      ],
    },
    {
      id: 'andamentos',
      titleSingular: 'Andamento',
      titleFieldKey: 'texto',
      parentFieldKey: 'processoId',
      fields: [
        field('texto'),
        field('processoId', { type: 'reference', refEntity: 'processos' }),
        field('ordem', { type: 'number', autoValue: { pattern: '', sequence: { scope: 'parent' } } }),
      ],
    },
    {
      id: 'notas',
      titleSingular: 'Nota',
      titleFieldKey: 'texto',
      fields: [field('texto'), field('codigo', { autoValue: { pattern: 'AA-0000' } })],
    },
  ] as never);
});

afterEach(() => {
  vi.useRealTimers();
  setAmbientTimeZone(null);
});

describe('número sequencial no repositório do front', () => {
  it('o primeiro registro do ano recebe 1, formatado pelo padrão, e o contador nasce em 1', async () => {
    const created = await repo.create(TENANT, 'comunicacoes', { assunto: 'a' } as never);
    expect(created.protocolo).toBe('2026/000001');
    expect(store.get(`${COUNTERS}/comunicacoes|protocolo||2026`)?.data).toMatchObject({
      collection: 'comunicacoes', field: 'protocolo', parent: '', period: '2026', value: 1,
    });
  });

  it('o valor que vem do formulário é ignorado: quem numera é a gravação', async () => {
    await repo.create(TENANT, 'comunicacoes', { assunto: 'a' } as never);
    const created = await repo.create(TENANT, 'comunicacoes', { assunto: 'b', protocolo: '2026/999999' } as never);
    expect(created.protocolo).toBe('2026/000002');
  });

  it('sob concorrência, nenhum número se repete e nenhum é pulado', async () => {
    const total = 25;
    const created = await Promise.all(
      Array.from({ length: total }, (_, index) => repo.create(TENANT, 'comunicacoes', { assunto: `c${index}` } as never)),
    );
    const numbers = created.map((record) => record.protocolo as string).sort();
    expect(new Set(numbers).size).toBe(total);
    expect(numbers).toEqual(Array.from({ length: total }, (_, index) => `2026/${String(index + 1).padStart(6, '0')}`));
    expect(store.get(`${COUNTERS}/comunicacoes|protocolo||2026`)?.data.value).toBe(total);
    // A prova de que o teste exercitou a corrida, e não 25 gravações em fila.
    expect(retries).toBeGreaterThan(0);
  });

  it('o ano é o do fuso do escritório: 01/01 às 02h UTC ainda é 2026 em São Paulo', async () => {
    vi.setSystemTime(new Date('2027-01-01T02:00:00Z'));
    const created = await repo.create(TENANT, 'comunicacoes', { assunto: 'a' } as never);
    expect(created.protocolo).toBe('2026/000001');
    vi.setSystemTime(new Date('2027-01-01T04:00:00Z'));
    const next = await repo.create(TENANT, 'comunicacoes', { assunto: 'b' } as never);
    expect(next.protocolo).toBe('2027/000001');
  });

  it('no escopo do pai, cada pai conta do 1, e o campo `number` guarda o inteiro', async () => {
    const a1 = await repo.create(TENANT, 'andamentos', { texto: 'x', processoId: 'p1' } as never);
    const a2 = await repo.create(TENANT, 'andamentos', { texto: 'y', processoId: 'p1' } as never);
    const b1 = await repo.create(TENANT, 'andamentos', { texto: 'z', processoId: 'p2' } as never);
    expect([a1.ordem, a2.ordem, b1.ordem]).toEqual([1, 2, 1]);
  });

  it('no escopo do pai, sem o pai a gravação é recusada antes da rede e nada é escrito', async () => {
    await expect(repo.create(TENANT, 'andamentos', { texto: 'x' } as never))
      .rejects.toBeInstanceOf(RecordSequenceParentMissingError);
    expect(store.size).toBe(0);
  });

  it('o número é imutável: a alteração que o reenvia — igual ou outro — não o toca', async () => {
    const created = await repo.create(TENANT, 'comunicacoes', { assunto: 'a' } as never);
    await repo.update(TENANT, 'comunicacoes', created.id, { assunto: 'b', protocolo: '1999/000042' } as never);
    expect(recordsOf('comunicacoes')[0]).toMatchObject({ assunto: 'b', protocolo: '2026/000001' });
  });

  it('a coleção sem campo numerado grava como sempre, sem transação nem contador', async () => {
    const created = await repo.create(TENANT, 'notas', { texto: 'a' } as never);
    expect(transactions).toBe(0);
    expect(created.codigo).toBeUndefined();
    expect([...store.keys()].some((path) => path.startsWith(COUNTERS))).toBe(false);
  });
});
