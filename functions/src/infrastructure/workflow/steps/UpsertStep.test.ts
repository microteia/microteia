import { describe, it, expect } from 'vitest';
import { makeUpsertStepDefinition } from './UpsertStep';
import { FakeMutationRepository } from '../../../domain/repositories/fakeWorkflowMutationRepository';
import { fakeScreenProvider } from '../../../domain/repositories/fakeScreenProvider';
import type { SchemaScreen } from '../../../domain/schema/pathResolver';
import type { UpsertStepConfig } from '../../../domain/schema/mutationSpec';
import type { WorkflowContext } from '../../../domain/entities/WorkflowContext';
import type { WorkflowEvent } from '../../../domain/entities/Workflow';

const lotesScreen: SchemaScreen = {
  id: 'lotes',
  titleSingular: 'Lote',
  titleFieldKey: 'codigo',
  fields: [
    { key: 'codigo', label: 'Código', type: 'text', required: true, order: 0, origin: 'design', rules: { format: { preset: 'upper' } } },
    { key: 'total', label: 'Total', type: 'number', required: false, order: 1, origin: 'design' },
  ],
  keys: [{ name: 'codigo', kind: 'primary', fields: ['codigo'] }],
};

const semChaveScreen: SchemaScreen = {
  id: 'notas',
  titleSingular: 'Nota',
  titleFieldKey: 'texto',
  fields: [{ key: 'texto', label: 'Texto', type: 'text', required: false, order: 0, origin: 'design' }],
};

const logger = { info: () => {}, warn: () => {}, error: () => {} };

const context = (input: Record<string, unknown>): WorkflowContext => ({
  event: { id: 'e1', tenantId: 't1', name: 'lote.saved', payload: {}, timestamp: new Date() } as WorkflowEvent,
  outputs: {},
  variables: {},
  services: { logger, now: () => new Date() },
  logger,
  execution: { id: 'x1', workflowDefinitionId: 'w1', tenantId: 't1' },
  input,
});

const gravar = (repo: FakeMutationRepository, config: UpsertStepConfig, input: Record<string, unknown>) =>
  makeUpsertStepDefinition({ mutationRepository: repo, screenProvider: fakeScreenProvider([lotesScreen, semChaveScreen]) })
    .createExecutor()
    .execute({ upsert: config }, context(input));

describe('passo upsert — endereçamento pela chave primary', () => {
  const porChave: UpsertStepConfig = { table: 'lotes', source: 'input', matchPrimaryKey: true };

  it('com matchPrimaryKey, repetir a mesma gravação ALTERA o registro em vez de falhar', async () => {
    const repo = new FakeMutationRepository();
    const first = await gravar(repo, porChave, { codigo: 'L-1', total: 10 });
    const again = await gravar(repo, porChave, { codigo: 'l-1', total: 12 });

    expect(first).toMatchObject({ success: true, outputs: { created: true } });
    expect(again).toMatchObject({ success: true, message: '@core.automation/step.upsert.updated', outputs: { created: false } });
    expect(again.outputs?.id).toBe(first.outputs?.id);
    expect(repo.createCalls).toHaveLength(1);
    expect(repo.store.get(`lotes/${String(first.outputs?.id)}`)).toMatchObject({ codigo: 'L-1', total: 12 });
  });

  it('sem a opção, a segunda gravação continua recusada como duplicata — quem não pede não muda', async () => {
    const repo = new FakeMutationRepository();
    const config: UpsertStepConfig = { table: 'lotes', source: 'input' };
    await gravar(repo, config, { codigo: 'L-1', total: 10 });
    const again = await gravar(repo, config, { codigo: 'L-1', total: 12 });

    expect(again).toMatchObject({ success: false, message: '@core.automation/mutation.upsert.key-conflict' });
    expect(repo.createCalls).toHaveLength(1);
  });

  it('o id no objeto continua mandando: a chave não é consultada', async () => {
    const repo = new FakeMutationRepository();
    const first = await gravar(repo, porChave, { codigo: 'L-1', total: 10 });
    const outro = await gravar(repo, porChave, { codigo: 'L-2', total: 1 });
    const porId = await gravar(repo, porChave, { id: first.outputs?.id, total: 99 });

    expect(porId).toMatchObject({ success: true, outputs: { created: false, id: first.outputs?.id } });
    expect(repo.store.get(`lotes/${String(outro.outputs?.id)}`)).toMatchObject({ total: 1 });
  });

  it('coleção sem chave primary grava como sempre: cada execução cria', async () => {
    const repo = new FakeMutationRepository();
    const config: UpsertStepConfig = { table: 'notas', source: 'input', matchPrimaryKey: true };
    await gravar(repo, config, { texto: 'a' });
    const again = await gravar(repo, config, { texto: 'a' });

    expect(again).toMatchObject({ success: true, outputs: { created: true } });
    expect(repo.createCalls).toHaveLength(2);
  });
});
