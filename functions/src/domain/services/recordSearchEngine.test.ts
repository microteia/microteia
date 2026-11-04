import { describe, expect, it } from 'vitest';
import type { CustomFieldOption, FieldDefinition } from '../entities/entitySchemas';
import type { IRecordSearchRepository, SearchableRecord } from '../repositories/IRecordSearchRepository';
import { createSchemaContext } from '../schema/pathResolver';
import type { SchemaScreen } from '../schema/pathResolver';
import {
  matchesSearchTerms,
  RECORD_SEARCH_ROUND_SIZE,
  RECORD_SEARCH_STALL_MS,
  recordSearchBackfillJobId,
  recordSearchPropagationJobId,
  searchQueryTerms,
} from '../schema/recordSearch';
import type { RecordSearchJobState, RecordSearchScan } from '../schema/recordSearch';
import type { RecordSearchDeps } from './recordSearchEngine';
import { deriveRecordSearchOnWrite, reconcileRecordSearch, runRecordSearchRound } from './recordSearchEngine';

const TENANT = 't1';

const field = (key: string, type: FieldDefinition['type'], extra: Partial<FieldDefinition> = {}): FieldDefinition => ({
  key, label: key, type, required: false, order: 0, origin: 'design', ...extra,
});

const personsScreen = (): SchemaScreen => ({
  id: 'persons', titleSingular: 'Pessoa', titleFieldKey: 'name', fields: [field('name', 'text')],
});

const casesScreen = (extra: FieldDefinition[] = []): SchemaScreen => ({
  id: 'cases',
  titleSingular: 'Processo',
  titleFieldKey: 'title',
  fields: [
    field('title', 'text'),
    field('activePole', 'reference', { refEntity: 'persons', multi: true, searchable: true }),
    field('lawyer', 'reference', { refEntity: 'persons', searchable: true }),
    field('area', 'select', { lookupCollection: 'caseAreas', searchable: true }),
    ...extra,
  ],
});

interface Stored { data: Record<string, unknown>; version: number }

/** O Firestore que importa aqui: versão por documento, varredura por id e o job em transação. */
class MemoryRepository implements IRecordSearchRepository {
  readonly collections = new Map<string, Map<string, Stored>>();
  readonly jobs = new Map<string, RecordSearchJobState>();
  writes = 0;

  put(collection: string, id: string, data: Record<string, unknown>): SearchableRecord {
    const docs = this.collections.get(collection) ?? new Map<string, Stored>();
    const version = (docs.get(id)?.version ?? 0) + 1;
    docs.set(id, { data, version });
    this.collections.set(collection, docs);
    return { id, data, version: String(version) };
  }

  read(collection: string, id: string): Record<string, unknown> | undefined {
    return this.collections.get(collection)?.get(id)?.data;
  }

  async getRecords(_tenantId: string, collection: string, ids: readonly string[]) {
    const found = new Map<string, Record<string, unknown>>();
    for (const id of ids) {
      const data = this.read(collection, id);
      if (data) found.set(id, data);
    }
    return found;
  }

  async getLookupOptions(_tenantId: string, collection: string, keys: readonly string[]): Promise<CustomFieldOption[]> {
    return [...(this.collections.get(collection)?.values() ?? [])]
      .map((stored) => stored.data as unknown as CustomFieldOption)
      .filter((option) => keys.includes(option.key));
  }

  async writeTerms(_tenantId: string, collection: string, record: SearchableRecord, terms: string[]) {
    const stored = this.collections.get(collection)?.get(record.id);
    if (!stored || String(stored.version) !== record.version) return false;
    stored.data = { ...stored.data, searchTerms: terms };
    stored.version += 1;
    this.writes += 1;
    return true;
  }

  async scanPage(_tenantId: string, scan: RecordSearchScan, afterId: string | null, limit: number) {
    const docs = [...(this.collections.get(scan.collection) ?? new Map<string, Stored>())]
      .filter(([id]) => afterId === null || id > afterId)
      .filter(([, stored]) => {
        if (!scan.fieldKey) return true;
        const value = stored.data[scan.fieldKey];
        return scan.multi ? Array.isArray(value) && value.includes(scan.value) : value === scan.value;
      })
      .sort(([left], [right]) => (left < right ? -1 : 1))
      .slice(0, limit);
    return docs.map(([id, stored]) => ({ id, data: stored.data, version: String(stored.version) }));
  }

  async getJob(_tenantId: string, jobId: string) {
    return this.jobs.get(jobId) ?? null;
  }

  async listJobs() {
    return new Map(this.jobs);
  }

  async updateJob(_tenantId: string, jobId: string, mutate: (current: RecordSearchJobState | null) => RecordSearchJobState | 'delete' | null) {
    const next = mutate(this.jobs.get(jobId) ?? null);
    if (next === 'delete') {
      this.jobs.delete(jobId);
      return null;
    }
    if (next) this.jobs.set(jobId, next);
    return next;
  }
}

const setup = (screens: SchemaScreen[] = [personsScreen(), casesScreen()], now = { value: 1_000_000 }) => {
  const repository = new MemoryRepository();
  const ctx = () => createSchemaContext(screens, [{ collection: 'caseAreas', label: 'Áreas' }]);
  const deps: RecordSearchDeps = {
    repository,
    schemaContext: async () => ctx(),
    freshSchemaContext: async () => ctx(),
    catalog: async () => ({ locale: 'pt-BR', messages: { 'com.acme/area.family': 'Família' } }),
    now: () => now.value,
    logger: { warn: () => undefined },
  };
  return { repository, deps, now };
};

/** Roda o job até o fim, como os gatilhos fariam: cada avanço acorda a rodada seguinte. */
const drain = async (repository: MemoryRepository, deps: RecordSearchDeps, jobId: string): Promise<number> => {
  let rounds = 0;
  for (;;) {
    const job = repository.jobs.get(jobId);
    if (!job || job.status !== 'running') return rounds;
    await runRecordSearchRound(TENANT, jobId, job.round, deps);
    rounds += 1;
    if (rounds > 100) throw new Error('o job não terminou');
  }
};

const finds = (data: Record<string, unknown> | undefined, typed: string): boolean =>
  matchesSearchTerms(data?.searchTerms, searchQueryTerms(typed));

describe('a gravação de um registro', () => {
  it('ganha os termos do título, das partes apontadas e do rótulo da opção', async () => {
    const { repository, deps } = setup();
    repository.put('persons', 'p1', { name: 'Alexnaldo Carvalho' });
    repository.put('persons', 'p2', { name: 'Maria Isabel' });
    repository.put('caseAreas', 'o1', { key: 'familia', label: 'Família' });
    const record = repository.put('cases', 'c1', { title: 'Curatela', activePole: ['p1', 'p2'], lawyer: 'p1', area: 'familia' });

    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', null, record, deps);

    const saved = repository.read('cases', 'c1');
    for (const typed of ['curat', 'isabel', 'carvalho', 'familia']) expect(finds(saved, typed)).toBe(true);
  });

  it('traduz o rótulo que é referência de mensagem, no idioma do escritório', async () => {
    const { repository, deps } = setup();
    repository.put('caseAreas', 'o1', { key: 'family', label: '@com.acme/area.family' });
    const record = repository.put('cases', 'c1', { title: 'Curatela', area: 'family' });

    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', null, record, deps);

    expect(finds(repository.read('cases', 'c1'), 'familia')).toBe(true);
  });

  it('não regrava termos iguais, nem reage à própria gravação dos termos', async () => {
    const { repository, deps } = setup();
    const first = repository.put('cases', 'c1', { title: 'Curatela' });
    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', null, first, deps);
    expect(repository.writes).toBe(1);

    const withTerms = repository.read('cases', 'c1') as Record<string, unknown>;
    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', { title: 'Curatela' }, { id: 'c1', data: withTerms, version: '2' }, deps);
    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', withTerms, { id: 'c1', data: { ...withTerms }, version: '2' }, deps);
    expect(repository.writes).toBe(1);
  });

  it('não grava sobre uma versão mais nova — quem a gravou deriva os próprios termos', async () => {
    const { repository, deps } = setup();
    const stale = repository.put('cases', 'c1', { title: 'Antigo' });
    repository.put('cases', 'c1', { title: 'Novo' });

    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', null, stale, deps);

    expect(repository.read('cases', 'c1')?.searchTerms).toBeUndefined();
  });

  it('coleção que não é tela não ganha termo', async () => {
    const { repository, deps } = setup();
    const record = repository.put('caseAreas', 'o1', { key: 'familia', label: 'Família' });
    await deriveRecordSearchOnWrite(TENANT, 'caseAreas', 'o1', null, record, deps);
    expect(repository.writes).toBe(0);
  });
});

describe('a propagação quando o título apontado muda', () => {
  it('renomear a pessoa rederiva os processos em que ela é parte, e o job some ao terminar', async () => {
    const { repository, deps } = setup();
    repository.put('persons', 'p1', { name: 'Maria Souza' });
    for (const [id, data] of [['c1', { title: 'A', activePole: ['p1'] }], ['c2', { title: 'B', lawyer: 'p1' }], ['c3', { title: 'C' }]] as const) {
      await deriveRecordSearchOnWrite(TENANT, 'cases', id, null, repository.put('cases', id, data), deps);
    }
    expect(finds(repository.read('cases', 'c1'), 'souza')).toBe(true);

    const renamed = repository.put('persons', 'p1', { name: 'Maria Oliveira' });
    await deriveRecordSearchOnWrite(TENANT, 'persons', 'p1', { name: 'Maria Souza' }, renamed, deps);

    const jobId = recordSearchPropagationJobId('persons', 'p1');
    expect(repository.jobs.get(jobId)?.scans.map((scan) => scan.fieldKey)).toEqual(['activePole', 'lawyer']);
    await drain(repository, deps, jobId);

    expect(finds(repository.read('cases', 'c1'), 'oliveira')).toBe(true);
    expect(finds(repository.read('cases', 'c1'), 'souza')).toBe(false);
    expect(finds(repository.read('cases', 'c2'), 'oliveira')).toBe(true);
    expect(repository.jobs.has(jobId)).toBe(false);
  });

  it('apagar a pessoa tira o nome dela da busca dos processos', async () => {
    const { repository, deps } = setup();
    repository.put('persons', 'p1', { name: 'Maria Souza' });
    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', null, repository.put('cases', 'c1', { title: 'A', lawyer: 'p1' }), deps);

    repository.collections.get('persons')?.delete('p1');
    await deriveRecordSearchOnWrite(TENANT, 'persons', 'p1', { name: 'Maria Souza' }, null, deps);
    await drain(repository, deps, recordSearchPropagationJobId('persons', 'p1'));

    expect(finds(repository.read('cases', 'c1'), 'souza')).toBe(false);
  });

  it('cadastrar uma pessoa não propaga nada — ninguém a aponta ainda', async () => {
    const { repository, deps } = setup();
    await deriveRecordSearchOnWrite(TENANT, 'persons', 'p1', null, repository.put('persons', 'p1', { name: 'Maria' }), deps);
    expect(repository.jobs.size).toBe(0);
  });

  it('editar a pessoa sem mudar o nome não propaga', async () => {
    const { repository, deps } = setup([
      { ...personsScreen(), fields: [field('name', 'text'), field('phone', 'text')] },
      casesScreen(),
    ]);
    const edited = repository.put('persons', 'p1', { name: 'Maria', phone: '2' });
    await deriveRecordSearchOnWrite(TENANT, 'persons', 'p1', { name: 'Maria', phone: '1' }, edited, deps);
    expect(repository.jobs.size).toBe(0);
  });

  it('renomear a opção de uma lista rederiva quem a guarda', async () => {
    const { repository, deps } = setup();
    repository.put('caseAreas', 'o1', { key: 'familia', label: 'Família' });
    await deriveRecordSearchOnWrite(TENANT, 'cases', 'c1', null, repository.put('cases', 'c1', { title: 'A', area: 'familia' }), deps);

    const renamed = repository.put('caseAreas', 'o1', { key: 'familia', label: 'Direito de Família' });
    await deriveRecordSearchOnWrite(TENANT, 'caseAreas', 'o1', { key: 'familia', label: 'Família' }, renamed, deps);
    await drain(repository, deps, recordSearchPropagationJobId('caseAreas', 'o1'));

    expect(finds(repository.read('cases', 'c1'), 'direito')).toBe(true);
  });
});

describe('o backfill dos registros que já existiam', () => {
  it('a conferência põe em marcha toda coleção sem termos, em várias rodadas', async () => {
    const { repository, deps } = setup();
    const total = RECORD_SEARCH_ROUND_SIZE + 5;
    for (let index = 0; index < total; index += 1) repository.put('cases', `c${String(index).padStart(4, '0')}`, { title: `Processo ${index}` });

    expect(await reconcileRecordSearch(TENANT, deps)).toBe(2);
    const rounds = await drain(repository, deps, recordSearchBackfillJobId('cases'));

    expect(rounds).toBe(2);
    expect(repository.jobs.get(recordSearchBackfillJobId('cases'))).toMatchObject({ status: 'done', processed: total, written: total });
    expect(finds(repository.read('cases', 'c0204'), 'processo 204')).toBe(true);
  });

  it('com a coleção em dia, a conferência não mexe em nada', async () => {
    const { repository, deps } = setup();
    await reconcileRecordSearch(TENANT, deps);
    await drain(repository, deps, recordSearchBackfillJobId('cases'));
    await drain(repository, deps, recordSearchBackfillJobId('persons'));
    expect(await reconcileRecordSearch(TENANT, deps)).toBe(0);
  });

  it('mudar o que entra na busca recomeça a passada', async () => {
    const state = setup();
    await reconcileRecordSearch(TENANT, state.deps);
    await drain(state.repository, state.deps, recordSearchBackfillJobId('cases'));

    const changed = setup([personsScreen(), casesScreen([field('court', 'text', { searchable: true })])]);
    for (const [id, job] of state.repository.jobs) changed.repository.jobs.set(id, job);
    expect(await reconcileRecordSearch(TENANT, changed.deps)).toBe(1);
    expect(changed.repository.jobs.get(recordSearchBackfillJobId('cases'))).toMatchObject({ status: 'running', generation: 2 });
  });

  it('a passada parada é acordada, e a rodada de uma entrega velha é ignorada', async () => {
    const { repository, deps, now } = setup();
    for (let index = 0; index < RECORD_SEARCH_ROUND_SIZE + 1; index += 1) repository.put('cases', `c${String(index).padStart(4, '0')}`, { title: 'x' });
    await reconcileRecordSearch(TENANT, deps);
    const jobId = recordSearchBackfillJobId('cases');
    await runRecordSearchRound(TENANT, jobId, 0, deps);

    await runRecordSearchRound(TENANT, jobId, 0, deps);
    expect(repository.jobs.get(jobId)?.round).toBe(1);

    now.value += RECORD_SEARCH_STALL_MS + 1;
    expect(await reconcileRecordSearch(TENANT, deps)).toBeGreaterThanOrEqual(1);
    expect(repository.jobs.get(jobId)?.touchedAt).toBe(now.value);
  });
});
