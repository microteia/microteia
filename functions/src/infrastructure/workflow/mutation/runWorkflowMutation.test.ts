import { describe, it, expect } from 'vitest';
import { runWorkflowRemove, runWorkflowUpsert } from './runWorkflowMutation';
import type { WorkflowMutationDeps } from './runWorkflowMutation';
import type { IWorkflowMutationRepository } from '../../../domain/repositories/IWorkflowMutationRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { UpsertSpec, RemoveSpec } from '../../../domain/schema/mutationSpec';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';

/**
 * Pessoa vem de extensão: a tela declara a coleção inteira (`name`), e o escritório acrescenta o
 * que quiser (`apelido`). Para a gravação por automação as duas origens são a mesma coisa.
 */
const personsScreen: SchemaScreen = {
  id: 'pessoas',
  collection: 'persons',
  eventPrefix: 'person',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [
    { key: 'name', label: 'Nome', type: 'text', required: true, order: 0, origin: 'plugin' },
    { key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 1, origin: 'design' },
  ],
};

const processosScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'title',
  fields: [
    { key: 'title', label: 'Título', type: 'text', required: true, order: 0, origin: 'design' },
    { key: 'valor', label: 'Valor', type: 'number', required: false, order: 1, origin: 'design' },
  ],
};

const screenProvider: IScreenDefinitionProvider = fakeScreenProvider([personsScreen, processosScreen]);

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
  it('inclui um registro em entidade fixa com campos do kernel e do tenant, todos na raiz', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, {
      table: 'persons',
      data: { name: 'Ana', apelido: 'Aninha' },
    });

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(true);
    const call = repo.createCalls[0];
    expect(call.tenantId).toBe('t1');
    expect(call.collection).toBe('persons');
    expect(call.data).toMatchObject({ name: 'Ana', apelido: 'Aninha', createdBy: 'workflow-engine' });
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

  it('grava numa tela do Form Design como em qualquer entidade: coleção própria, campos na raiz', () => {
    const repo = new FakeMutationRepository();
    return upsert(repo, { table: 'processos', data: { title: 'Caso X', valor: 10 } }).then((outcome) => {
      expect(outcome.ok).toBe(true);
      const call = repo.createCalls[0];
      expect(call.collection).toBe('processos');
      expect(call.data).toMatchObject({ title: 'Caso X', valor: 10 });
      // Nada de envelope nem de campo derivado: o documento tem só o que a tela declara.
      expect(call.data).not.toHaveProperty('values');
      expect(call.data).not.toHaveProperty('screenKey');
      expect(call.data).not.toHaveProperty('title2');
    });
  });

  it('grava valores de lista (lookup)', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await upsert(repo, { table: 'contractTypes', data: { key: 'servico', label: 'Serviço' } });

    expect(outcome.ok).toBe(true);
    expect(repo.createCalls[0].collection).toBe('contractTypes');
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
    expect((await upsert(repo, { table: 'processos', data: { naoDeclarado: 'x' } })).ok).toBe(false);
    expect((await upsert(repo, { table: 'processos', data: { createdAt: 'forjado' } })).ok).toBe(false);
    expect(repo.createCalls).toHaveLength(0);
  });

  it('registra updatedBy do workflow ao atualizar', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    await upsert(repo, { table: 'persons', id: 'p1', data: { name: 'Novo' } });
    expect(repo.updateCalls[0].data).toMatchObject({ name: 'Novo', updatedBy: 'workflow-engine' });
  });

  it('com ignoreUnwritableFields, descarta campos reservados/desconhecidos em vez de falhar', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const outcome = await runWorkflowUpsert(
      {
        table: 'persons',
        id: 'p1',
        data: {
          name: 'Novo',
          createdAt: 'x',
          updatedAt: 'y',
          createdBy: 'alguém',
          title: 'z',
          naoExiste: 'w',
        },
      },
      context(),
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.created).toBe(false);
    const written = repo.updateCalls[0].data ?? {};
    expect(written).toMatchObject({ name: 'Novo', updatedBy: 'workflow-engine' });
    expect(written).not.toHaveProperty('createdAt');
    expect(written).not.toHaveProperty('createdBy');
    expect(written).not.toHaveProperty('title');
    expect(written).not.toHaveProperty('naoExiste');
  });

  it('avisa no log quais campos foram descartados por ignoreUnwritableFields', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const warnings: string[] = [];
    const capturing = context();
    capturing.logger = { info: () => {}, warn: (m: string) => warnings.push(m), error: () => {} };

    await runWorkflowUpsert(
      { table: 'persons', id: 'p1', data: { name: 'Novo', createdBy: 'alguém', naoExiste: 'w' } },
      capturing,
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(warnings).toHaveLength(1);
    expect(warnings[0]).toContain('createdBy');
    expect(warnings[0]).toContain('naoExiste');
    expect(warnings[0]).not.toContain('name');
  });

  it('não avisa quando todos os campos são graváveis', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('persons', 'p1', { name: 'Antigo' });
    const warnings: string[] = [];
    const capturing = context();
    capturing.logger = { info: () => {}, warn: (m: string) => warnings.push(m), error: () => {} };

    await runWorkflowUpsert(
      { table: 'persons', id: 'p1', data: { name: 'Novo' } },
      capturing,
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(warnings).toHaveLength(0);
  });

  it('grava title em entidades nativas que o têm como campo próprio', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('contracts', 'c1', { title: 'Antigo' });
    const outcome = await runWorkflowUpsert(
      { table: 'contracts', id: 'c1', data: { title: 'Novo título' } },
      context(),
      deps(repo),
      { ignoreUnwritableFields: true },
    );

    expect(outcome.ok).toBe(true);
    expect(repo.updateCalls[0].data).toMatchObject({ title: 'Novo título' });
  });

  it('um id de outra tela simplesmente não existe na coleção — a gravação cria o registro', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('outra', 'r1', { title: 'De outra tela' });
    const outcome = await upsert(repo, { table: 'processos', id: 'r1', data: { title: 'X' } });
    expect(outcome.ok).toBe(true);
    expect(repo.createCalls[0].collection).toBe('processos');
    expect(repo.store.get('outra/r1')).toMatchObject({ title: 'De outra tela' });
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

  it('não alcança registro de outra tela: a coleção isola por construção', async () => {
    const repo = new FakeMutationRepository();
    repo.seed('outra', 'r1', { title: 'De outra tela' });
    const outcome = await remove(repo, { table: 'processos', id: 'r1' });
    expect(outcome.ok).toBe(true);
    if (!outcome.ok) return;
    expect(outcome.value.removed).toBe(false);
    expect(repo.deleteCalls).toHaveLength(0);
    expect(repo.store.has('outra/r1')).toBe(true);
  });

  it('bloqueia exclusão em entidades sensíveis', async () => {
    const repo = new FakeMutationRepository();
    const outcome = await remove(repo, { table: 'members', id: 'm1' });
    expect(outcome.ok).toBe(false);
  });
});
