import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { deleteApp, getApps } from 'firebase-admin/app';
import { DocumentReference, Firestore, WriteBatch } from 'firebase-admin/firestore';
import { FirebaseTenantSettingsRepository } from '../../data/repositories/FirebaseTenantSettingsRepository';
import { FirebaseWorkflowExecutionRepository } from '../../data/repositories/FirebaseWorkflowExecutionRepository';
import { makeRunPortalRecordActionUseCase, type PortalActionRunner } from '../../domain/usecases/PortalActionUseCases';
import { makeProjectPortalRecordUseCase } from '../../domain/usecases/PortalProjectionUseCases';
import { makeRunCalledWorkflowUseCase } from '../../domain/usecases/RunCalledWorkflowUseCase';
import { CITY_SCREENS, makeFakePortalRepository } from '../../domain/repositories/fakePortalRepository';
import type { PortalScreen } from '../../domain/repositories/IPortalRepository';
import type { IWorkflowDefinitionRepository } from '../../domain/repositories/IWorkflowDefinitionRepository';
import type { StepDefinition } from '../../domain/engine/StepDefinition';
import type { StepRegistry } from '../../domain/engine/StepRegistry';
import type { WorkflowContextHydrator } from '../../domain/engine/WorkflowContextHydrator';
import type { WorkflowServices } from '../../domain/entities/WorkflowContext';
import type { WorkflowDefinition } from '../../domain/entities/Workflow';
import { WORKFLOW_CALLED_EVENT } from '../../domain/schema/eventCatalog';

const TENANT = 'salvador';

/** O passo que encerra o fluxo dizendo ao convidado como foi — o `status` que a ação devolve. */
const statusStep: StepDefinition = {
  id: 'status',
  version: 1,
  name: 'Status',
  description: '',
  icon: 'x',
  category: 'Action',
  type: 'Action',
  configurable: true,
  inputs: [{ id: 'message', label: 'Message', required: true, type: 'String' }],
  outputDefinitions: [],
  createExecutor: () => ({
    execute: async (inputs) => ({ success: true, outputs: { status: ['SUCCESS', String(inputs.message)] } }),
  }),
};

const registry: StepRegistry = {
  register: () => undefined,
  resolve: (id) => (id === 'status' ? statusStep : undefined),
  list: () => [statusStep],
};

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-10-29T12:00:00Z'),
};

const passthroughHydrator = {
  collectReferencedPaths: () => [],
  hydrate: async (event: unknown) => event,
} as unknown as WorkflowContextHydrator;

const say = (id: string, message: string) => ({
  id,
  stepDefinitionId: 'status',
  type: 'Action' as const,
  order: 0,
  configuration: { message: { kind: 'Literal' as const, value: message } },
  enabled: true,
});

/** A ação decide pelo `action` que o portal manda: é o nó `Condition` que gravava a linha com campo vazio. */
const acceptWorkflow: WorkflowDefinition = {
  id: 'wf-accept',
  tenantId: TENANT,
  name: 'Accept',
  eventName: WORKFLOW_CALLED_EVENT,
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  parameters: [],
  steps: [{
    id: 'decide',
    stepDefinitionId: '',
    type: 'Condition',
    order: 0,
    configuration: {},
    enabled: true,
    condition: { kind: 'FieldComparison', fieldPath: 'event.payload.action', operator: '==', value: 'accept', valueType: 'literal' },
    branches: { whenTrue: [say('accepted', '@portal.test/accepted')], whenFalse: [say('ignored', '@portal.test/ignored')] },
  }],
  createdAt: new Date('2026-10-01T00:00:00Z'),
  updatedAt: new Date('2026-10-01T00:00:00Z'),
};

const definitions = {
  findByRef: async (_tenantId: string, ref: string) => (ref === acceptWorkflow.id ? acceptWorkflow : null),
} as unknown as IWorkflowDefinitionRepository;

const screens: PortalScreen[] = CITY_SCREENS.map((screen) => (
  screen.id === 'companies'
    ? { ...screen, viewActionIds: ['act-accept'], portal: { ...screen.portal!, actions: ['accept'] } }
    : screen
));

/** O MESMO caminho do `portalActionRunner`, com o histórico gravado pelo repositório de verdade. */
const runnerOver = (db: Firestore): PortalActionRunner => {
  const runCalled = makeRunCalledWorkflowUseCase(
    definitions, new FirebaseWorkflowExecutionRepository(db), registry, services, passthroughHydrator,
  );
  return async ({ tenantId, workflowId, params }) => {
    const result = await runCalled.execute({ tenantId, targetWorkflowId: workflowId, params, callDepth: 1 });
    if (!result.found || result.status !== 'SUCCESS') return { ok: false };
    return { ok: true, outputs: result.outputs };
  };
};

const portalAction = async (db: Firestore) => {
  const fake = makeFakePortalRepository(screens);
  fake.users.set('ana', { userId: 'ana', email: 'ana@acme.com', displayName: 'Ana', subjectKeys: ['companies/acme'] });
  fake.actions.set('act-accept', {
    id: 'act-accept', key: 'accept', title: 'Accept', icon: 'check', workflowId: acceptWorkflow.id,
    enabled: true, confirmMessage: null, danger: false,
  });
  const company = { name: 'Acme', taxId: '123' };
  fake.records.set('companies/acme', company);
  await makeProjectPortalRecordUseCase(fake.repo).execute({ tenantId: TENANT, collection: 'companies', recordId: 'acme', data: company });
  return makeRunPortalRecordActionUseCase(fake.repo, runnerOver(db));
};

const resolve = (value: string) => value.replace('@portal.test/', '');

/** O que foi gravado em `workflow_executions` — o serializador correu, o `commit` não sai para a rede. */
const writtenExecutions = (calls: ReadonlyArray<ReadonlyArray<unknown>>) =>
  calls
    .filter(([ref]) => (ref as DocumentReference).path.includes('/workflow_executions/'))
    .map(([, data]) => data as { logs: Array<Record<string, unknown>> });

describe('ação do portal — o histórico da execução é gravado', () => {
  let sets: MockInstance;

  beforeEach(async () => {
    await Promise.all(getApps().map((app) => deleteApp(app)));
    vi.resetModules();
    vi.spyOn(WriteBatch.prototype, 'commit').mockResolvedValue([]);
    sets = vi.spyOn(WriteBatch.prototype, 'set');
  });

  afterEach(async () => {
    vi.restoreAllMocks();
    await Promise.all(getApps().map((app) => deleteApp(app)));
  });

  it('com nó Condition, depois de o handler ler as configurações do escritório, o convidado recebe o desfecho e a execução fica no histórico', async () => {
    const { initFirebase, getDb } = await import('../firebase/initFirebase');
    initFirebase();
    vi.spyOn(DocumentReference.prototype, 'get').mockResolvedValue(
      { data: () => ({ values: { 'regional.timeZone': 'America/Bahia' } }) } as never,
    );
    // A ordem do handler: as configurações (o fuso) são lidas ANTES de o motor pedir o banco.
    const settings = await new FirebaseTenantSettingsRepository(getDb()).getTenantValues(TENANT);
    expect(settings).toEqual({ 'regional.timeZone': 'America/Bahia' });

    const run = await portalAction(getDb());
    const outcome = await run.execute({
      tenantId: TENANT, userId: 'ana', projectionId: 'companies__acme', timeZone: 'America/Bahia', resolve, actionId: 'act-accept',
    });

    expect(outcome.status).toEqual({ code: 'SUCCESS', message: 'accepted' });
    const [execution] = writtenExecutions(sets.mock.calls);
    const branchLine = execution.logs.find((line) => line.message === '@core.automation/run.condition.true-branch');
    expect(branchLine).toMatchObject({ stepId: 'decide' });
    expect('stepDefinitionId' in branchLine!).toBe(false);
  });

  it('o histórico desse fluxo passa no serializador do Firestore mesmo numa instância SEM ignoreUndefinedProperties', async () => {
    // A segunda linha de defesa: o motor não depende da configuração da instância para gravar o que é dele.
    const strict = new Firestore({ projectId: 'demo-microteia' });
    const run = await portalAction(strict);

    const outcome = await run.execute({
      tenantId: TENANT, userId: 'ana', projectionId: 'companies__acme', resolve, actionId: 'act-accept',
    });

    expect(outcome.status).toEqual({ code: 'SUCCESS', message: 'accepted' });
    expect(writtenExecutions(sets.mock.calls)).toHaveLength(1);
    await strict.terminate();
  });
});
