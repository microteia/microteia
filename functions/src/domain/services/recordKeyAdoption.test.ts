import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import type { SchemaScreen } from '../schema/pathResolver';
import { createSchemaContext } from '../schema/pathResolver';
import type { IRecordKeyAdoptionRepository } from '../repositories/IRecordKeyAdoptionRepository';
import { readRecordKeyAdoptionState, RECORD_KEY_ADOPTION_MAX_LISTED } from '../schema/recordKeyAdoption';
import type { RecordKeyAdoptionState } from '../schema/recordKeyAdoption';
import type { RecordKeySpec } from '../schema/recordKeys';
import { planRecordKeys, scopeRecordKeys, storedRecordKeyRefs } from '../schema/recordKeys';
import {
  claimRecordKeyAdoptionRound,
  completeRecordKeyAdoptionRound,
  decideRecordKeyAdoption,
  recheckRecordKeyIssues,
  reconcileRecordKeyAdoptions,
  recordWriteMayResolveKeyIssue,
  requestRecordKeyRecheck,
  runRecordKeyAdoptionRound,
} from './recordKeyAdoption';
import type { RecordKeyAdoptionDeps } from './recordKeyAdoption';

const field = (key: string): FieldDefinition => ({ key, label: key, type: 'text', required: false, order: 0, origin: 'design' });

const EMAIL: RecordKeySpec = { name: 'email', kind: 'unique', fields: ['email'], normalize: { caseInsensitive: true } };

const pessoas = (keys: RecordKeySpec[] = [EMAIL]): SchemaScreen => ({
  id: 'pessoas',
  titleSingular: 'Pessoa',
  titleFieldKey: 'nome',
  fields: [field('nome'), field('email')],
  keys,
});

const NOW = 9_000_000;

interface World {
  deps: RecordKeyAdoptionDeps;
  jobs: Map<string, RecordKeyAdoptionState>;
  records: Map<string, Record<string, unknown>>;
  reservations: Map<string, { recordId: string; keyName: string }>;
  finished: RecordKeyAdoptionState[];
  setScreens: (screens: SchemaScreen[]) => void;
}

/**
 * O mundo em memória: a "transação" de `adoptRecord` é síncrona dentro de uma chamada assíncrona — o
 * suficiente para que dois registros com o mesmo valor, processados em paralelo, se encontrem na
 * reserva como no Firestore.
 */
const world = (records: Record<string, Record<string, unknown>>, screens: SchemaScreen[] = [pessoas()]): World => {
  let ctx = createSchemaContext(screens);
  const jobs = new Map<string, RecordKeyAdoptionState>();
  const recordMap = new Map(Object.entries(records));
  const reservations = new Map<string, { recordId: string; keyName: string }>();
  const finished: RecordKeyAdoptionState[] = [];

  const repository: IRecordKeyAdoptionRepository = {
    listStates: async () => new Map(jobs),
    update: async (_tenantId, collection, mutate) => {
      const next = mutate(jobs.get(collection) ?? null);
      if (next) jobs.set(collection, next);
      return next;
    },
    listRecords: async (_tenantId, _collection, afterId, limit) =>
      [...recordMap.keys()].sort()
        .filter((id) => afterId === null || id > afterId)
        .slice(0, limit)
        .map((id) => ({ id, data: recordMap.get(id) as Record<string, unknown> })),
    adoptRecord: async (_tenantId, _collection, recordId, planFor) => {
      const data = recordMap.get(recordId);
      if (!data) return { gone: true, reserved: 0, issues: [] };
      const stored = storedRecordKeyRefs(data);
      const request = planFor(data);
      const ids = [...request.plan.entries.map((entry) => entry.keyId), ...Object.values(stored)];
      const read = new Map(ids.map((id) => [id, reservations.get(id)?.recordId ?? null]));
      const liveHolders = new Set(ids.filter((id) => {
        const reservation = reservations.get(id);
        if (!reservation || reservation.recordId === recordId) return false;
        const holder = recordMap.get(reservation.recordId);
        return holder !== undefined && storedRecordKeyRefs(holder)[reservation.keyName] === id;
      }));
      const decision = decideRecordKeyAdoption({ recordId, stored, request, reservations: read, liveHolders });
      for (const id of decision.release) reservations.delete(id);
      for (const entry of decision.create) reservations.set(entry.keyId, { recordId, keyName: entry.name });
      const refs: Record<string, string> = { ...stored };
      for (const [name, id] of Object.entries(decision.refs)) {
        if (id === null) delete refs[name];
        else refs[name] = id;
      }
      if (Object.keys(decision.refs).length > 0) recordMap.set(recordId, { ...data, keyRefs: refs });
      return { gone: false, reserved: decision.create.length, issues: decision.issues };
    },
  };

  return {
    jobs,
    records: recordMap,
    reservations,
    finished,
    setScreens: (next) => { ctx = createSchemaContext(next); },
    deps: {
      adoptionRepository: repository,
      freshSchemaContext: async () => ctx,
      now: () => NOW,
      recordPassFinished: async (_tenantId, _collection, state) => { finished.push(state); },
    },
  };
};

/** O gatilho do job: uma rodada por gravação, até nada mais mudar. */
const drain = async (w: World, collection = 'pessoas'): Promise<RecordKeyAdoptionState | undefined> => {
  for (let guard = 0; guard < 50; guard += 1) {
    const before = JSON.stringify(w.jobs.get(collection));
    await runRecordKeyAdoptionRound('t1', collection, w.deps);
    if (JSON.stringify(w.jobs.get(collection)) === before) break;
  }
  return w.jobs.get(collection);
};

const startAndDrain = async (w: World): Promise<RecordKeyAdoptionState | undefined> => {
  await reconcileRecordKeyAdoptions('t1', w.deps);
  return drain(w);
};

describe('decideRecordKeyAdoption', () => {
  const request = (data: Record<string, unknown>, keys: RecordKeySpec[] = [EMAIL]) => ({
    plan: planRecordKeys(scopeRecordKeys(keys, null), data, 'c'),
    names: keys.map((key) => key.name),
  });
  const decide = (
    data: Record<string, unknown>,
    reservations: Record<string, string>,
    live: string[] = [],
    keys?: RecordKeySpec[],
  ) => decideRecordKeyAdoption({
    recordId: 'b',
    stored: storedRecordKeyRefs(data),
    request: request(data, keys),
    reservations: new Map(Object.entries(reservations)),
    liveHolders: new Set(live),
  });

  it('valor livre: reserva e passa a citar', () => {
    const decision = decide({ email: 'A@x' }, {});
    expect(decision.create.map((entry) => entry.keyId)).toEqual(['c|email|a@x']);
    expect(decision.refs).toEqual({ email: 'c|email|a@x' });
  });

  it('valor de outro registro vivo: conflito, e nada é gravado', () => {
    const decision = decide({ email: 'a@x' }, { 'c|email|a@x': 'a' }, ['c|email|a@x']);
    expect(decision).toEqual({
      create: [],
      release: [],
      refs: {},
      issues: [{ key: 'email', kind: 'duplicate', recordId: 'b', holderId: 'a', values: ['a@x'] }],
    });
  });

  it('reserva que ninguém cita é resto de gravação interrompida: é tomada', () => {
    const decision = decide({ email: 'a@x' }, { 'c|email|a@x': 'fantasma' });
    expect(decision.create).toHaveLength(1);
    expect(decision.issues).toEqual([]);
  });

  it('a reserva já é dele, mas ele não a cita: só passa a citar', () => {
    const decision = decide({ email: 'a@x' }, { 'c|email|a@x': 'b' });
    expect(decision.create).toEqual([]);
    expect(decision.refs).toEqual({ email: 'c|email|a@x' });
  });

  it('normalização nova: troca a reserva antiga, que era dele, pela nova', () => {
    const decision = decide({ email: 'A@x', keyRefs: { email: 'c|email|A@x' } }, { 'c|email|A@x': 'b' });
    expect(decision.release).toEqual(['c|email|A@x']);
    expect(decision.refs).toEqual({ email: 'c|email|a@x' });
  });

  it('em conflito sob a normalização nova, conserva a antiga — ela ainda impede o valor de antes', () => {
    const decision = decide(
      { email: 'A@x', keyRefs: { email: 'c|email|A@x' } },
      { 'c|email|A@x': 'b', 'c|email|a@x': 'a' },
      ['c|email|a@x'],
    );
    expect(decision.release).toEqual([]);
    expect(decision.refs).toEqual({});
  });

  it('chave obrigatória sem valor: lacuna; esparsa que ficou vazia: solta o que citava', () => {
    const required = [{ ...EMAIL, sparse: false }];
    expect(decide({}, {}, [], required).issues).toEqual([{ key: 'email', kind: 'missing', recordId: 'b', values: [] }]);
    const emptied = decide({ email: '', keyRefs: { email: 'c|email|velho' } }, { 'c|email|velho': 'b' });
    expect(emptied.release).toEqual(['c|email|velho']);
    expect(emptied.refs).toEqual({ email: null });
  });
});

describe('a passada de adoção', () => {
  it('coleção sem repetição: reserva o que falta, não toca em mais nada, e a chave passa a valer', async () => {
    const w = world({ a: { nome: 'Ana', email: 'ana@x', updatedAt: 1 }, b: { nome: 'Bia', email: 'bia@x', updatedAt: 2 }, c: { nome: 'Caio' } });
    const state = await startAndDrain(w);

    expect(state?.status).toBe('done');
    expect(state?.pending).toEqual({});
    expect(Object.keys(state?.adopted ?? {})).toEqual(['email']);
    expect(w.records.get('a')).toEqual({ nome: 'Ana', email: 'ana@x', updatedAt: 1, keyRefs: { email: 'pessoas|email|ana@x' } });
    expect(w.records.get('c')).toEqual({ nome: 'Caio' });
    expect(state?.reserved).toBe(2);
    expect(w.finished).toHaveLength(1);
  });

  it('o registro que já cita a reserva certa passa sem transação — o escritório anterior a esta versão', async () => {
    const w = world({ a: { email: 'ana@x', keyRefs: { email: 'pessoas|email|ana@x' } } });
    w.reservations.set('pessoas|email|ana@x', { recordId: 'a', keyName: 'email' });
    const state = await startAndDrain(w);
    expect(state?.reserved).toBe(0);
    expect(state?.adopted).toHaveProperty('email');
  });

  it('duplicata antiga: a chave fica pendente e o conflito é listado com o valor', async () => {
    const w = world({ a: { email: 'Ana@x' }, b: { email: 'ana@X ' }, c: { email: 'caio@x' } });
    const state = await startAndDrain(w);

    expect(state?.status).toBe('done');
    expect(state?.pending).toHaveProperty('email');
    expect(state?.adopted).toEqual({});
    expect(state?.issueCount).toBe(1);
    expect(state?.issues).toEqual([{ key: 'email', kind: 'duplicate', recordId: 'b', holderId: 'a', values: ['ana@x'] }]);
    expect(w.records.get('b')).toEqual({ email: 'ana@X ' });
  });

  it('a correção do duplicado reconfere a lista e a chave passa a valer sozinha', async () => {
    const w = world({ a: { email: 'ana@x' }, b: { email: 'ana@x' } });
    await startAndDrain(w);

    // O formulário grava o valor novo com a reserva dele, como sempre.
    const before = w.records.get('b') as Record<string, unknown>;
    const after = { email: 'bia@x', keyRefs: { email: 'pessoas|email|bia@x' } };
    w.records.set('b', after);
    w.reservations.set('pessoas|email|bia@x', { recordId: 'b', keyName: 'email' });

    const ctx = await w.deps.freshSchemaContext('t1');
    expect(await recheckRecordKeyIssues('t1', 'pessoas', 'b', before, after, async () => ctx, w.deps)).toBe(true);
    const state = await drain(w);

    expect(state?.pending).toEqual({});
    expect(state?.adopted).toHaveProperty('email');
    expect(state?.issues).toEqual([]);
    expect(w.finished.map((one) => Object.keys(one.pending).length)).toEqual([1, 0]);
  });

  it('apagar o DONO da reserva também resolve: o duplicado herda o valor', async () => {
    const w = world({ a: { email: 'ana@x' }, b: { email: 'ana@x' } });
    await startAndDrain(w);

    const before = w.records.get('a') as Record<string, unknown>;
    w.records.delete('a');
    w.reservations.delete('pessoas|email|ana@x');
    const ctx = await w.deps.freshSchemaContext('t1');
    await recheckRecordKeyIssues('t1', 'pessoas', 'a', before, null, async () => ctx, w.deps);
    const state = await drain(w);

    expect(state?.adopted).toHaveProperty('email');
    expect(w.reservations.get('pessoas|email|ana@x')?.recordId).toBe('b');
  });

  it('a gravação de um registro fora da lista não pede reconferência', async () => {
    const w = world({ a: { email: 'ana@x' }, b: { email: 'ana@x' }, c: { email: 'caio@x' } });
    await startAndDrain(w);
    const job = w.jobs.get('pessoas') as RecordKeyAdoptionState;
    expect(requestRecordKeyRecheck(job, 'c', NOW)).toBeNull();
    expect(requestRecordKeyRecheck(job, 'a', NOW)?.recheck).toBe(true);
  });

  it('formatação desconhecida bloqueia; a declaração corrigida retoma', async () => {
    const withPreset = { ...EMAIL, normalize: { formatPreset: 'x/doc' } };
    const w = world({ a: { email: '1' } }, [pessoas([withPreset])]);
    const blocked = await startAndDrain(w);
    expect(blocked?.status).toBe('blocked');
    expect(blocked?.blocked).toEqual([{ key: 'email', preset: 'x/doc' }]);

    w.setScreens([pessoas()]);
    const state = await startAndDrain(w);
    expect(state?.adopted).toHaveProperty('email');
  });

  it('mudar a normalização varre de novo e refaz as reservas sob a nova forma', async () => {
    const caseSensitive = { ...EMAIL, normalize: {} };
    const w = world({ a: { email: 'Ana@x' }, b: { email: 'ana@x' } }, [pessoas([caseSensitive])]);
    expect((await startAndDrain(w))?.adopted).toHaveProperty('email');

    w.setScreens([pessoas()]);
    const state = await startAndDrain(w);
    // `b` já tinha a reserva que a forma nova pede; `a` é quem colide — e continua com a antiga, que
    // ainda impede o valor de antes enquanto alguém decide.
    expect(state?.issues.map((issue) => [issue.recordId, issue.holderId])).toEqual([['a', 'b']]);
    expect(storedRecordKeyRefs(w.records.get('a'))).toEqual({ email: 'pessoas|email|Ana@x' });
    expect(storedRecordKeyRefs(w.records.get('b'))).toEqual({ email: 'pessoas|email|ana@x' });
  });
});

describe('o fechamento das rodadas', () => {
  const base = (over: Partial<RecordKeyAdoptionState> = {}): RecordKeyAdoptionState => ({
    ...readRecordKeyAdoptionState({}),
    status: 'running',
    pending: { email: 's' },
    touchedAt: NOW,
    ...over,
  });
  const result = (over: Partial<Parameters<typeof completeRecordKeyAdoptionRound>[2]> = {}) => ({
    processed: 0, reserved: 0, failed: 0, failedIds: [], issues: [], nextCursor: null, blocked: [], ...over,
  });

  it('a lista tem teto, a contagem não', () => {
    const issues = Array.from({ length: RECORD_KEY_ADOPTION_MAX_LISTED + 5 }, (_, index) => ({
      key: 'email', kind: 'missing' as const, recordId: `r${index}`, values: [],
    }));
    const next = completeRecordKeyAdoptionRound(base(), { generation: 0, round: 0, recheck: false }, result({ issues }), NOW);
    expect(next?.issues).toHaveLength(RECORD_KEY_ADOPTION_MAX_LISTED);
    expect(next?.issueCount).toBe(RECORD_KEY_ADOPTION_MAX_LISTED + 5);
  });

  it('resolvidos os listados, mas havendo mais do que a lista mostrava, começa uma passada nova', () => {
    const waiting = base({ status: 'done', issueCount: 60, issues: [{ key: 'email', kind: 'missing', recordId: 'r', values: [] }] });
    const next = completeRecordKeyAdoptionRound(waiting, { generation: 0, round: 0, recheck: true }, result(), NOW);
    expect(next?.status).toBe('running');
    expect(next?.generation).toBe(1);
  });

  it('a reconferência consome o pedido ao ser reservada — um pedido no meio dela pede outra', () => {
    const waiting = base({ status: 'done', issueCount: 1, recheck: true, issues: [{ key: 'email', kind: 'missing', recordId: 'r', values: [] }] });
    const claimed = claimRecordKeyAdoptionRound(waiting, NOW);
    expect(claimed?.recheck).toBe(false);
    expect(requestRecordKeyRecheck(claimed as RecordKeyAdoptionState, 'r', NOW)?.recheck).toBe(true);
  });

  it('a rodada de uma passada abandonada é descartada', () => {
    expect(completeRecordKeyAdoptionRound(base({ generation: 2 }), { generation: 1, round: 0, recheck: false }, result(), NOW)).toBeNull();
  });
});

describe('as gravações de registro', () => {
  it('só chega ao job a gravação que pode ter resolvido um conflito', () => {
    const ctx = createSchemaContext([pessoas()]);
    const adopted = { email: 'a@x', keyRefs: { email: 'pessoas|email|a@x' } };
    expect(recordWriteMayResolveKeyIssue(ctx, 'pessoas', adopted, { ...adopted, nome: 'x' })).toBe(false);
    expect(recordWriteMayResolveKeyIssue(ctx, 'pessoas', { email: 'a@x' }, { email: 'a@x', nome: 'x' })).toBe(true);
    expect(recordWriteMayResolveKeyIssue(ctx, 'pessoas', adopted, null)).toBe(true);
    expect(recordWriteMayResolveKeyIssue(ctx, 'outra', { a: 1 }, { a: 2 })).toBe(false);
  });
});
