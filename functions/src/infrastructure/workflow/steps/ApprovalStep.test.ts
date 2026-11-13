import { describe, it, expect } from 'vitest';
import { runWorkflow } from '../../../domain/engine/WorkflowExecutor';
import type { StepRegistry } from '../../../domain/engine/StepRegistry';
import type { WorkflowServices } from '../../../domain/entities/WorkflowContext';
import type { WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../../../domain/entities/Workflow';
import type { IWorkflowTaskRepository } from '../../../domain/repositories/IWorkflowTaskRepository';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { DispatchNotificationRequest, DispatchNotificationUseCase } from '../../../domain/usecases/DispatchNotificationUseCase';
import type { WorkflowTask } from '../../../domain/schema/workflowTask';
import { makeApprovalStepDefinition } from './ApprovalStep';

const NOW = new Date('2026-11-11T12:00:00Z');

const harness = (guests: { inPortal: boolean; ids: string[] } = { inPortal: true, ids: ['cliente', 'socio'] }) => {
  const created: WorkflowTask[] = [];
  const sent: DispatchNotificationRequest[] = [];
  const tasks: IWorkflowTaskRepository = {
    createIfAbsent: async (task) => { if (!created.some((one) => one.id === task.id)) created.push(task); },
    findById: async () => null,
    listOpenForAssignee: async () => [],
    decide: async () => ({ ok: false, reason: 'not-found' }),
    expire: async () => undefined,
    dueReminders: async () => [],
    claimReminder: async () => false,
  };
  const dispatch: DispatchNotificationUseCase = {
    execute: async (request) => {
      sent.push(request);
      return {
        recipients: request.recipientIds.length,
        delivered: { audit: 0, inApp: 0, email: 0, push: 0, sms: 0 },
        failed: { audit: 0, inApp: 0, email: 0, push: 0, sms: 0 },
        optedOut: 0,
        issues: [],
      };
    },
  };
  const screens = {
    getScreens: async () => [{ id: 'pedidos', collection: 'pedidos', fields: [] }],
  } as unknown as IScreenDefinitionProvider;
  const approval = makeApprovalStepDefinition({
    tasks,
    dispatch,
    screens,
    memberIdsGranting: async (_tenant, permission) => (permission === 'pedidos.approve' ? ['gestor', 'ana'] : []),
    portalGuests: {
      execute: async () => ({ inPortal: guests.inPortal, guests: guests.ids.map((userId) => ({ userId, email: `${userId}@x.com` })) }),
    },
  });
  const registry: StepRegistry = {
    register: () => undefined,
    resolve: (id) => (id === 'approval' ? approval : undefined),
    list: () => [approval],
  };
  return { created, sent, registry };
};

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => NOW,
};

const approvalStep = (configuration: WorkflowStep['configuration']): WorkflowStep => ({
  id: 'aprovar',
  stepDefinitionId: 'approval',
  type: 'Action',
  order: 0,
  configuration: { title: { kind: 'Literal', value: 'Aprovar desconto' }, ...configuration },
  enabled: true,
});

const definition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  id: 'wf',
  tenantId: 't1',
  name: 'Desconto',
  eventName: 'pedidos.saved',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps,
  createdAt: NOW,
  updatedAt: NOW,
});

const event: WorkflowEvent = { id: 'ev', tenantId: 't1', name: 'pedidos.saved', payload: { id: 'p1' }, timestamp: NOW };

describe('passo approval', () => {
  it('cria a tarefa, avisa quem decide e pausa com a tarefa e o prazo', async () => {
    const { created, sent, registry } = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({
        assigneeMembers: { kind: 'Literal', value: ['bia'] },
        assigneePermission: { kind: 'Literal', value: 'pedidos.approve' },
        dueInDays: { kind: 'Literal', value: 2 },
      })]),
      event,
      registry,
      services,
      suspendable: true,
    });

    expect(run.status).toBe('WAITING');
    expect(run.suspension?.taskId).toBe(`${run.id}_aprovar`);
    expect(run.suspension?.resumeAt).toEqual(new Date('2026-11-13T12:00:00Z'));

    expect(created).toHaveLength(1);
    expect(created[0].assigneeIds.sort()).toEqual(['ana', 'bia', 'gestor']);
    expect(created[0].outcomes.map((one) => one.key)).toEqual(['approved', 'rejected']);
    expect(created[0].target).toEqual({ collection: 'pedidos', recordId: 'p1' });

    expect(sent[0].recipientIds).toEqual(created[0].assigneeIds);
    expect(sent[0].link).toBe('workflow-tasks');
    expect(sent[0].dedupKey).toBe(created[0].id);
  });

  it('deixa nas saídas o desfecho de expiração — é com ele que o prazo vencido retoma', async () => {
    const { registry } = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({
        assigneeMembers: { kind: 'Literal', value: ['bia'] },
        outcomes: { kind: 'Literal', value: ['Aprovar com ressalva', 'Recusar'] },
        onTimeout: { kind: 'Literal', value: 'Recusar' },
      })]),
      event,
      registry,
      services,
      suspendable: true,
    });

    expect(run.suspension?.outputs.aprovar).toMatchObject({ outcome: 'recusar', taskId: `${run.id}_aprovar` });
  });

  it('onde não pode esperar, recusa ANTES de criar a tarefa ou avisar alguém', async () => {
    const { created, sent, registry } = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({ assigneeMembers: { kind: 'Literal', value: ['bia'] } })]),
      event,
      registry,
      services,
      suspendable: false,
    });

    expect(run.status).toBe('FAILED');
    expect(created).toHaveLength(0);
    expect(sent).toHaveLength(0);
  });

  it('sem ninguém para decidir, falha dizendo por quê', async () => {
    const { created, registry } = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({})]),
      event,
      registry,
      services,
      suspendable: true,
    });

    expect(run.status).toBe('FAILED');
    expect(run.logs.some((log) => log.message === '@core.automation/step.approval.no-assignee')).toBe(true);
    expect(created).toHaveLength(0);
  });

  it('com convidados do portal, eles entram na tarefa à parte dos membros, e são avisados pelo portal no registro', async () => {
    const { created, sent, registry } = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({
        assigneeMembers: { kind: 'Literal', value: ['bia'] },
        portalGuests: { kind: 'Literal', value: true },
        quorum: { kind: 'Literal', value: 'all' },
      })]),
      event, registry, services, suspendable: true,
    });
    expect(run.status).toBe('WAITING');
    expect(created[0]).toMatchObject({ assigneeIds: ['bia'], guestIds: ['cliente', 'socio'], quorum: 3 });
    const toPortal = sent.find((one) => one.audience === 'portal');
    expect(toPortal).toMatchObject({ recipientIds: ['cliente', 'socio'], target: { collection: 'pedidos', recordId: 'p1' } });
    expect(sent.find((one) => one.audience !== 'portal')?.recipientIds).toEqual(['bia']);
  });

  it('só convidados também vale; registro fora do portal falha antes de criar a tarefa', async () => {
    const soConvidados = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({ portalGuests: { kind: 'Literal', value: true } })]),
      event, registry: soConvidados.registry, services, suspendable: true,
    });
    expect(run.status).toBe('WAITING');
    expect(soConvidados.created[0].assigneeIds).toEqual([]);
    expect(soConvidados.sent.every((one) => one.audience === 'portal')).toBe(true);

    const fora = harness({ inPortal: false, ids: [] });
    const failed = await runWorkflow({
      definition: definition([approvalStep({ portalGuests: { kind: 'Literal', value: true } })]),
      event, registry: fora.registry, services, suspendable: true,
    });
    expect(failed.status).toBe('FAILED');
    expect(fora.created).toHaveLength(0);
  });

  it('quórum maior que o número de quem decide falha dizendo os números', async () => {
    const { created, registry } = harness();
    const run = await runWorkflow({
      definition: definition([approvalStep({
        assigneeMembers: { kind: 'Literal', value: ['bia', 'ana'] },
        quorum: { kind: 'Literal', value: '3' },
      })]),
      event, registry, services, suspendable: true,
    });
    expect(run.status).toBe('FAILED');
    expect(run.logs.some((log) => log.message === '@core.automation/step.approval.quorum-invalid')).toBe(true);
    expect(created).toHaveLength(0);
  });

  it('com lembrete, a tarefa nasce com o intervalo e o primeiro lembrete um intervalo depois — nunca no prazo', async () => {
    const { created, registry } = harness();
    await runWorkflow({
      definition: definition([approvalStep({
        assigneeMembers: { kind: 'Literal', value: ['bia'] },
        dueInDays: { kind: 'Literal', value: 5 },
        remindEveryDays: { kind: 'Literal', value: 2 },
      })]),
      event, registry, services, suspendable: true,
    });
    expect(created[0]).toMatchObject({ remindEveryDays: 2, nextReminderAt: new Date('2026-11-13T12:00:00Z') });

    const tooLate = harness();
    await runWorkflow({
      definition: definition([approvalStep({
        assigneeMembers: { kind: 'Literal', value: ['bia'] },
        dueInDays: { kind: 'Literal', value: 1 },
        remindEveryDays: { kind: 'Literal', value: 2 },
      })]),
      event, registry: tooLate.registry, services, suspendable: true,
    });
    expect(tooLate.created[0].nextReminderAt).toBeUndefined();
  });
});

