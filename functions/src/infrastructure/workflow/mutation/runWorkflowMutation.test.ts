import { describe, it, expect } from 'vitest';
import { runWorkflowRemove, runWorkflowUpsert } from './runWorkflowMutation';
import type { WorkflowMutationDeps } from './runWorkflowMutation';
import type { IWorkflowMutationRepository } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { UpsertSpec, RemoveSpec } from '../../../domain/schema/mutationSpec';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';

const personsScreen: SchemaScreen = {
  id: 'persons',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0 }],
};

const processosScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Título', type: 'text', required: true, order: 0 },
    { key: 'valor', label: 'Valor', type: 'number', required: false, order: 1 },
  ],
};

const screenProvider: IScreenDefinitionProvider = {
  getScreens: async () => [personsScreen, processosScreen],
};

interface WriteCall {
  tenantId: string;
  collection: string;
  id?: string;
  data?: Record<string, unknown>;
}

class FakeMutationRepository implements IWorkflowMutationRepository {
  store = new Map<string, Record<string, unknown>>();
  createCalls: WriteCall[] = [];
  updateCalls: WriteCall[] = [];
  deleteCalls: WriteCall[] = [];
  private seq = 0;

  private key(collection: string, id: string): string {
    return `${collection}/${id}`;
  }

  seed(collection: string, id: string, data: Record<string, unknown>): void {
    this.store.set(this.key(collection, id), data);
  }

  async getById(_tenantId: string, collection: string, id: string) {
    return this.store.get(this.key(collection, id)) ?? null;
  }

  async create(tenantId: string, collection: string, data: Record<string, unknown>, id?: string) {
    const finalId = id ?? `gen-${(this.seq += 1)}`;
    this.createCalls.push({ tenantId, collection, id, data });
    this.store.set(this.key(collection, finalId), { ...data });
    return finalId;
  }

  async update(tenantId: string, collection: string, id: string, data: Record<string, unknown>) {
    this.updateCalls.push({ tenantId, collection, id, data });
    const current = this.store.get(this.key(collection, id)) ?? {};
    this.store.set(this.key(collection, id), { ...current, ...data });
  }

  async delete(tenantId: string, collection: string, id: string) {
    this.deleteCalls.push({ tenantId, collection, id });
    this.store.delete(this.key(collection, id));
  }
}

const logger = { info: () => {}, warn: () => {}, error: () => {} };

const context = (): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'contract.saved', payload: {}, timestamp: new Date() } as WorkflowEvent,
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date() },
  logger,
  execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
});

const deps = (repo: FakeMutationRepository): WorkflowMutationDeps => ({
  mutationRepository: repo,
  screenProvider,
});

const upsert = (repo: FakeMutationRepository, spec: UpsertSpec) => runWorkflowUpsert(spec, context(), deps(repo));
const remove = (repo: FakeMutationRepository, spec: RemoveSpec) => runWorkflowRemove(spec, context(), deps(repo));

describe('runWorkflowUpsert', () => {
  it('inclui um registro em entidade fixa com campos nativos e customizados', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, {
      table: 'persons',
      data: { name: 'Ana', customValues: { apelido: 'Aninha' } },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(true);
    const call = repo.createCalls[0];
    expect(call.tenantId).toBe('t1');
    expect(call.collection).toBe('persons');
    expect(call.data).toMatchObject({ name: 'Ana', customValues: { apelido: 'Aninha' }, createdBy: 'workflow-engine' });
  });

  it('atualiza (merge) quando o id existe', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const outcome = await upsert(repo, { table: 'persons', id: 'p1', data: { name: 'Novo' } });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(false);
    expect(repo.updateCalls[0]).toMatchObject({ collection: 'persons', id: 'p1' });
    expect(repo.store.get('persons/p1')).toMatchObject({ name: 'Novo' });
  });

  it('inclui registro customizado forçando screenKey e derivando o título', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, { table: 'processos', data: { values: { title: 'Caso X', valor: 10 } } });

    expect(outcome.ok).toBe(true);
    const call = repo.createCalls[0];
    expect(call.collection).toBe('customRecords');
    expect(call.data).toMatchObject({ screenKey: 'processos', title: 'Caso X', values: { title: 'Caso X', valor: 10 } });
  });

  it('grava valores de lista (lookup)', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, { table: 'personTypes', data: { key: 'cliente', label: 'Cliente' } });

    expect(outcome.ok).toBe(true);
    expect(repo.createCalls[0].collection).toBe('personTypes');
  });

  it('bloqueia gravação em entidades sensíveis (members, pushes, news)', async () => {
    const repo = new FakeMutationRepository();
    for (const table of ['members', 'pushes', 'news']) {
      const outcome = await upsert(repo, { table, data: { name: 'x' } });
      expect(outcome.ok).toBe(false);
    }
    expect(repo.createCalls).toHaveLength(0);
  });

  it('rejeita campos desconhecidos e campos gerenciados pelo sistema', async () => {
    const repo = new FakeMutationRepository();
    expect((await upsert(repo, { table: 'persons', data: { naoExiste: 'x' } })).ok).toBe(false);
    expect((await upsert(repo, { table: 'persons', data: { id: 'forjado' } })).ok).toBe(false);
    expect((await upsert(repo, { table: 'processos', data: { title: 'fora do values' } })).ok).toBe(false);
    expect(repo.createCalls).toHaveLength(0);
  });

  it('impede alterar registro custom de outra tela', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('customRecords', 'r1', { screenKey: 'outra' });
    const outcome = await upsert(repo, { table: 'processos', id: 'r1', data: { values: { title: 'X' } } });
    expect(outcome.ok).toBe(false);
  });
});

describe('runWorkflowRemove', () => {
  it('exclui apenas o registro informado', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Ana' });
    const outcome = await remove(repo, { table: 'persons', id: 'p1' });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.removed).toBe(true);
    expect(repo.deleteCalls[0]).toMatchObject({ tenantId: 't1', collection: 'persons', id: 'p1' });
    expect(repo.store.has('persons/p1')).toBe(false);
  });

  it('retorna removed=false quando o registro não existe', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await remove(repo, { table: 'persons', id: 'zzz' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.removed).toBe(false);
    expect(repo.deleteCalls).toHaveLength(0);
  });

  it('impede excluir registro custom de outra tela', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('customRecords', 'r1', { screenKey: 'outra' });
    const outcome = await remove(repo, { table: 'processos', id: 'r1' });
    expect(outcome.ok).toBe(false);
    expect(repo.deleteCalls).toHaveLength(0);
  });

  it('bloqueia exclusão em entidades sensíveis', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await remove(repo, { table: 'members', id: 'm1' });
    expect(outcome.ok).toBe(false);
  });
});
