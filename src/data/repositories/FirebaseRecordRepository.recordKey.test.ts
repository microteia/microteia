import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { FieldDefinition } from '../../domain/entities/entitySchemas';
import type { RecordKeySpec } from '../../domain/schema/recordKeys';

/**
 * O caminho de gravação do FRONT com chave declarada.
 *
 * O `firebase/firestore` é substituído por um duplo que reproduz UMA propriedade — a que a regra
 * de segurança concede e da qual a corretude depende: gravar sobre um documento que já existe numa
 * coleção que só libera `create` é negado, e a negação derruba o lote INTEIRO. O resto do SDK não
 * interessa aqui; o que se exercita é o que o repositório monta e o que ele faz com a recusa.
 *
 * A regra de verdade tem o seu próprio teste, contra o emulador (`rules-tests/recordKeys.test.ts`).
 * Este cobre a outra metade: o lote certo, a liberação certa e a mensagem certa.
 */

interface StoredDoc {
  path: string;
  data: Record<string, unknown>;
}

const store = new Map<string, Record<string, unknown>>();
/** Os caminhos em que a "regra" só permite criar — as reservas. */
const CREATE_ONLY = /\/recordKeys\//;

class FakeBatch {
  private readonly ops: { kind: 'set' | 'update' | 'delete'; doc: StoredDoc; data?: Record<string, unknown> }[] = [];

  set(doc: StoredDoc, data: Record<string, unknown>) { this.ops.push({ kind: 'set', doc, data }); }

  update(doc: StoredDoc, data: Record<string, unknown>) { this.ops.push({ kind: 'update', doc, data }); }

  delete(doc: StoredDoc) { this.ops.push({ kind: 'delete', doc }); }

  async commit() {
    // A recusa acontece ANTES de qualquer escrita: é o que "o lote inteiro cai junto" significa.
    for (const op of this.ops) {
      if (op.kind === 'set' && CREATE_ONLY.test(op.doc.path) && store.has(op.doc.path)) {
        const error = new Error('PERMISSION_DENIED') as Error & { code: string };
        error.code = 'permission-denied';
        throw error;
      }
    }
    for (const op of this.ops) {
      if (op.kind === 'delete') store.delete(op.doc.path);
      else store.set(op.doc.path, { ...(store.get(op.doc.path) ?? {}), ...op.data });
    }
  }
}

const batches: FakeBatch[] = [];

vi.mock('../../infrastructure/firebase/config', () => ({ db: {} }));
vi.mock('firebase/firestore', () => ({
  collection: (_db: unknown, ...segments: string[]) => ({ path: segments.join('/') }),
  doc: (parent: { path: string }, id?: string) => ({
    path: `${parent.path}/${id ?? `auto-${store.size + 1}`}`,
    id: id ?? `auto-${store.size + 1}`,
  }),
  getDoc: async (ref: StoredDoc) => ({
    exists: () => store.has(ref.path),
    data: () => store.get(ref.path),
    id: ref.path.split('/').pop(),
  }),
  getDocs: async () => ({ empty: true, docs: [] }),
  addDoc: async (parent: { path: string }, data: Record<string, unknown>) => {
    const ref = { path: `${parent.path}/auto-${store.size + 1}`, id: `auto-${store.size + 1}` };
    store.set(ref.path, data);
    return ref;
  },
  setDoc: async (ref: StoredDoc, data: Record<string, unknown>) => { store.set(ref.path, data); },
  updateDoc: async (ref: StoredDoc, data: Record<string, unknown>) => {
    store.set(ref.path, { ...(store.get(ref.path) ?? {}), ...data });
  },
  deleteDoc: async (ref: StoredDoc) => { store.delete(ref.path); },
  writeBatch: () => { const batch = new FakeBatch(); batches.push(batch); return batch; },
  serverTimestamp: () => 'SERVER_TIME',
  onSnapshot: () => () => {},
  query: (...args: unknown[]) => args,
  orderBy: () => 'orderBy',
  limit: () => 'limit',
  Timestamp: class { static now() { return 'NOW'; } },
}));
vi.mock('../utils/stampDeletionActor', () => ({ stampDeletionActor: vi.fn(async () => {}) }));

const { FirebaseRecordRepository } = await import('./FirebaseRecordRepository');
const { setRecordRulesScreens, RecordKeyConflictError, RecordKeyMissingError } = await import('../utils/recordRulesGate');

const field = (key: string, over: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key, label: key, type: 'text', required: false, order: 0, origin: 'design', ...over,
});

const declareScreen = (keys: RecordKeySpec[]) => {
  setRecordRulesScreens([{
    id: 'produtos',
    titleSingular: 'Produto',
    titleFieldKey: 'nome',
    fields: [field('nome'), field('sku'), field('linha')],
    keys,
  }]);
};

const repo = new FirebaseRecordRepository();
const TENANT = 't1';
const KEY = (id: string) => `tenants/${TENANT}/recordKeys/${id}`;
const RECORD = (id: string) => `tenants/${TENANT}/produtos/${id}`;

beforeEach(() => {
  store.clear();
  batches.length = 0;
  declareScreen([{ name: 'sku', kind: 'unique', fields: ['sku'] }]);
});

describe('gravar um registro com chave', () => {
  it('grava registro e reserva no MESMO lote, e carimba o que sustenta o registro', async () => {
    await repo.create(TENANT, 'produtos', { sku: 'AB-1', nome: 'Cadeira' } as never, 'r1');

    expect(batches).toHaveLength(1);
    expect(store.get(KEY('produtos|sku|AB-1'))).toMatchObject({ collection: 'produtos', recordId: 'r1' });
    expect(store.get(RECORD('r1'))?.keyRefs).toEqual({ sku: 'produtos|sku|AB-1' });
  });

  it('a coleção SEM chave não vira lote — o caminho de sempre segue igual', async () => {
    declareScreen([]);
    await repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r1');

    expect(batches).toHaveLength(0);
    expect(store.get(RECORD('r1'))).not.toHaveProperty('keyRefs');
  });

  it('a segunda gravação com o mesmo valor é recusada, dizendo o campo e o valor', async () => {
    await repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r1');

    await expect(repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r2'))
      .rejects.toBeInstanceOf(RecordKeyConflictError);

    const error = await repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r3').catch((e) => e);
    expect((error as InstanceType<typeof RecordKeyConflictError>).issues[0]).toMatchObject({
      path: 'sku',
      error: '@core.records/key.duplicate',
      errorParams: { key: 'sku', value: 'AB-1' },
    });
  });

  it('o registro NÃO fica gravado quando a reserva é recusada', async () => {
    await repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r1');
    await repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r2').catch(() => {});

    expect(store.has(RECORD('r2'))).toBe(false);
  });

  it('a chave OBRIGATÓRIA sem valor é recusada ANTES da rede', async () => {
    declareScreen([{ name: 'sku', kind: 'unique', fields: ['sku'], sparse: false }]);

    await expect(repo.create(TENANT, 'produtos', { nome: 'X' } as never))
      .rejects.toBeInstanceOf(RecordKeyMissingError);
    expect(batches).toHaveLength(0);
    expect(store.size).toBe(0);
  });

  it('a chave esparsa sem valor deixa dois registros vazios conviverem', async () => {
    await repo.create(TENANT, 'produtos', { nome: 'A' } as never, 'r1');
    await repo.create(TENANT, 'produtos', { nome: 'B' } as never, 'r2');

    expect(store.has(RECORD('r1'))).toBe(true);
    expect(store.has(RECORD('r2'))).toBe(true);
  });
});

describe('alterar um registro com chave', () => {
  beforeEach(async () => {
    await repo.create(TENANT, 'produtos', { sku: 'AB-1', nome: 'Cadeira' } as never, 'r1');
  });

  it('trocar o valor solta a reserva antiga e cria a nova, no mesmo lote', async () => {
    await repo.update(TENANT, 'produtos', 'r1', { sku: 'AB-2' } as never);

    expect(store.has(KEY('produtos|sku|AB-1'))).toBe(false);
    expect(store.get(KEY('produtos|sku|AB-2'))).toMatchObject({ recordId: 'r1' });
    expect(store.get(RECORD('r1'))?.keyRefs).toEqual({ sku: 'produtos|sku|AB-2' });
  });

  it('gravar de novo o MESMO valor não solta nem recria — não se abre janela', async () => {
    const before = store.get(KEY('produtos|sku|AB-1'));
    await repo.update(TENANT, 'produtos', 'r1', { nome: 'Outra' } as never);

    expect(store.get(KEY('produtos|sku|AB-1'))).toBe(before);
  });

  it('um update PARCIAL de chave composta a reconstitui do registro gravado', async () => {
    declareScreen([{ name: 'linha-nome', kind: 'unique', fields: ['linha', 'nome'] }]);
    await repo.create(TENANT, 'produtos', { linha: 'casa', nome: 'Cadeira' } as never, 'r2');

    await repo.update(TENANT, 'produtos', 'r2', { linha: 'escritorio' } as never);

    expect(store.has(KEY('produtos|linha-nome|escritorio|Cadeira'))).toBe(true);
    expect(store.has(KEY('produtos|linha-nome|casa|Cadeira'))).toBe(false);
  });

  it('tomar um valor de OUTRO registro é recusado', async () => {
    await repo.create(TENANT, 'produtos', { sku: 'AB-9' } as never, 'r2');

    await expect(repo.update(TENANT, 'produtos', 'r2', { sku: 'AB-1' } as never))
      .rejects.toBeInstanceOf(RecordKeyConflictError);
  });
});

describe('excluir um registro com chave', () => {
  it('solta as reservas no mesmo lote, e o valor volta a ficar livre', async () => {
    await repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r1');

    await repo.delete(TENANT, 'produtos', 'r1', { userId: 'u1' } as never);

    expect(store.has(RECORD('r1'))).toBe(false);
    expect(store.has(KEY('produtos|sku|AB-1'))).toBe(false);
    await expect(repo.create(TENANT, 'produtos', { sku: 'AB-1' } as never, 'r2')).resolves.toBeDefined();
  });

  /**
   * A reserva é achada pelo que o REGISTRO cita, nunca recomputada: uma feita sob a declaração
   * anterior só existe em `keyRefs`, e recomputar a deixaria presa para sempre.
   */
  it('solta a reserva que o registro cita, mesmo que a declaração já não a produza', async () => {
    store.set(RECORD('r1'), { sku: 'AB-1', keyRefs: { sku: 'produtos|sku|FORMATO-ANTIGO' } });
    store.set(KEY('produtos|sku|FORMATO-ANTIGO'), { recordId: 'r1' });

    await repo.delete(TENANT, 'produtos', 'r1', { userId: 'u1' } as never);

    expect(store.has(KEY('produtos|sku|FORMATO-ANTIGO'))).toBe(false);
  });

  it('a coleção sem chave exclui pelo caminho de sempre, sem lote', async () => {
    declareScreen([]);
    store.set(RECORD('r1'), { sku: 'AB-1' });

    await repo.delete(TENANT, 'produtos', 'r1', { userId: 'u1' } as never);

    expect(batches).toHaveLength(0);
    expect(store.has(RECORD('r1'))).toBe(false);
  });
});
