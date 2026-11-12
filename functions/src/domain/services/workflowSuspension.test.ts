import { describe, it, expect } from 'vitest';
import { recordWorkflowRun, resumeWorkflowExecution } from './workflowSuspension';
import type { ResumeWorkflowDeps } from './workflowSuspension';
import type { WorkflowRun } from '../engine/WorkflowExecutor';
import type { StepRegistry } from '../engine/StepRegistry';
import type { StepDefinition } from '../engine/StepDefinition';
import type { WorkflowDefinition, WorkflowEvent, WorkflowExecution, WorkflowStep } from '../entities/Workflow';
import type { IWorkflowClockRepository, ResumeClockEntry, WorkflowClockEntry } from '../repositories/IWorkflowClockRepository';
import { WorkflowContextHydrator } from '../engine/WorkflowContextHydrator';
import { fakeScreenProvider } from '../repositories/fakeScreenProvider';

const NOW = new Date('2026-10-14T12:00:00Z');

const recordStep = (tag: string, order: number): WorkflowStep => ({
  id: `s-${tag}`,
  stepDefinitionId: 'record',
  type: 'Action',
  order,
  configuration: { tag: { kind: 'Literal', value: tag } },
  enabled: true,
});

const definition = (overrides: Partial<WorkflowDefinition> = {}): WorkflowDefinition => ({
  id: 'wf',
  tenantId: 't1',
  name: 'Espera',
  eventName: 'medico.saved',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps: [recordStep('a', 0), { ...recordStep('wait', 1), id: 'wait' }, recordStep('b', 2)],
  createdAt: NOW,
  updatedAt: NOW,
  ...overrides,
});

const event: WorkflowEvent = { id: 'ev', tenantId: 't1', name: 'medico.saved', payload: { id: 'r1', clinicaId: 'c1' }, timestamp: NOW };

const hydrator = new WorkflowContextHydrator(
  { fetchByIds: async (_tenantId, collection, ids) => new Map(ids.map((id) => [id, collection === 'clinicas' && id === 'c1' ? { nome: 'Clínica Sul' } : null])) },
  fakeScreenProvider([
    {
      id: 'medicos',
      eventPrefix: 'medico',
      titleSingular: 'Médico',
      titleFieldKey: 'nome',
      fields: [{ key: 'clinicaId', label: 'Clínica', type: 'reference', refEntity: 'clinicas', required: false, order: 0, origin: 'design' }],
    },
    {
      id: 'clinicas',
      titleSingular: 'Clínica',
      titleFieldKey: 'nome',
      fields: [{ key: 'nome', label: 'Nome', type: 'text', required: false, order: 0, origin: 'design' }],
    },
  ]),
);

const setup = (stored: WorkflowDefinition | null, deactivated: string[] = []) => {
  const order: string[] = [];
  const executions = new Map<string, WorkflowExecution>();
  const entries = new Map<string, WorkflowClockEntry>();
  const record: StepDefinition = {
    id: 'record',
    version: 1,
    name: 'Record',
    description: '',
    icon: 'x',
    category: 'Action',
    type: 'Action',
    configurable: true,
    inputs: [{ id: 'tag', label: 'Tag', required: true, type: 'String' }],
    outputDefinitions: [],
    createExecutor: () => ({
      execute: async (inputs) => {
        order.push(String(inputs.tag));
        return { success: true, outputs: { value: String(inputs.tag) } };
      },
    }),
  };
  const registry: StepRegistry = { register: () => undefined, resolve: (id) => (id === 'record' ? record : undefined), list: () => [record] };
  const clockRepository = {
    save: async (entry: WorkflowClockEntry) => {
      entries.set(entry.kind === 'resume' ? entry.executionId : entry.definitionId, entry);
    },
    claim: async (entry: ResumeClockEntry) => (entries.delete(entry.executionId) ? 'fired' : 'stale'),
  } as unknown as IWorkflowClockRepository;
  const deps: ResumeWorkflowDeps = {
    executionRepository: {
      create: async (execution) => {
        executions.set(execution.id, execution);
      },
      findById: async (_tenantId, id) => executions.get(id) ?? null,
      findByEventId: async () => [],
    },
    clockRepository,
    definitionRepository: {
      findEnabledByEvent: async () => [],
      findEnabledByEvents: async () => [],
      findById: async () => stored,
      findByRef: async () => stored,
    },
    registry,
    hydrator,
    services: { logger: { info: () => undefined, warn: () => undefined, error: () => undefined }, now: () => NOW, timeZone: 'UTC' },
    deactivatedPluginIds: async () => new Set(deactivated),
    now: () => NOW,
  };
  return { deps, order, executions, entries };
};

const waitingRun = (): WorkflowRun => ({
  id: 'exec-1',
  tenantId: 't1',
  workflowDefinitionId: 'wf',
  eventId: 'ev',
  status: 'WAITING',
  startedAt: new Date('2026-10-12T12:00:00Z'),
  resumeAt: NOW,
  logs: [{ level: 'INFO', message: 'antes', at: new Date('2026-10-12T12:00:00Z') }],
  outputs: {},
  suspension: { resumeAt: NOW, afterStepId: 'wait', lastStepId: 'wait', outputs: { 's-a': { value: 'a' } }, variables: { x: 1 } },
});

describe('recordWorkflowRun', () => {
  it('a execução que pausou guarda a continuação no relógio e fica WAITING', async () => {
    const { deps, entries, executions } = setup(definition());
    await recordWorkflowRun(waitingRun(), { definition: definition(), event }, deps);
    expect(executions.get('exec-1')?.status).toBe('WAITING');
    expect(executions.get('exec-1')).not.toHaveProperty('suspension');
    expect(entries.get('exec-1')).toMatchObject({ kind: 'resume', afterStepId: 'wait', nextRunAt: NOW, variables: { x: 1 } });
  });

  it('o estado grande demais para esperar vira falha dita, e não continuação perdida', async () => {
    const { deps, entries, executions } = setup(definition());
    const run = waitingRun();
    run.suspension = { ...(run.suspension as NonNullable<WorkflowRun['suspension']>), variables: { blob: 'x'.repeat(900_000) } };
    await recordWorkflowRun(run, { definition: definition(), event }, deps);
    expect(entries.size).toBe(0);
    expect(executions.get('exec-1')?.status).toBe('FAILED');
    expect(executions.get('exec-1')?.logs.at(-1)?.message).toBe('@core.automation/run.delay.too-large');
  });
});

describe('resumeWorkflowExecution', () => {
  const prepare = async (stored: WorkflowDefinition | null, deactivated: string[] = []) => {
    const context = setup(stored, deactivated);
    await recordWorkflowRun(waitingRun(), { definition: definition(), event }, context.deps);
    return { ...context, entry: context.entries.get('exec-1') as ResumeClockEntry };
  };

  it('continua os passos seguintes na mesma execução, com o histórico de antes', async () => {
    const { deps, order, executions, entry } = await prepare(definition());
    expect(await resumeWorkflowExecution(entry, deps)).toBe('fired');
    expect(order).toEqual(['b']);
    const execution = executions.get('exec-1');
    expect(execution?.status).toBe('SUCCESS');
    expect(execution?.logs[0].message).toBe('antes');
    expect(execution?.startedAt.toISOString()).toBe('2026-10-12T12:00:00.000Z');
  });

  it('depois da espera, a referência navegada é lida de novo, e a lida sozinha continua sendo o id', async () => {
    const expression = (text: string) => ({ kind: 'Expression' as const, expression: text });
    const stored = definition({
      steps: [
        recordStep('a', 0),
        { ...recordStep('wait', 1), id: 'wait' },
        { ...recordStep('b', 2), configuration: { tag: expression('concat(event.clinicaId, "=", event.clinicaId.nome)') } },
      ],
    });
    const { deps, order, entry } = await prepare(stored);
    expect(entry.event.payload).toStrictEqual({ id: 'r1', clinicaId: 'c1' });
    await resumeWorkflowExecution(entry, deps);
    expect(order).toEqual(['c1=Clínica Sul']);
  });

  it('continua uma vez só', async () => {
    const { deps, order, entry } = await prepare(definition());
    await resumeWorkflowExecution(entry, deps);
    expect(await resumeWorkflowExecution(entry, deps)).toBe('stale');
    expect(order).toEqual(['b']);
  });

  it('termina cancelada, dizendo por quê, quando a automação mudou durante a espera', async () => {
    for (const [stored, deactivated, message] of [
      [null, [], '@core.automation/run.delay.cancelled.deleted'],
      [definition({ enabled: false }), [], '@core.automation/run.delay.cancelled.disabled'],
      [definition({ ownerPluginIds: ['com.x.off'] }), ['com.x.off'], '@core.automation/run.delay.cancelled.extension-off'],
    ] as const) {
      const { deps, order, executions, entry } = await prepare(stored, [...deactivated]);
      await resumeWorkflowExecution(entry, deps);
      expect(order).toEqual([]);
      expect(executions.get('exec-1')?.status).toBe('CANCELLED');
      expect(executions.get('exec-1')?.logs.at(-1)?.message).toBe(message);
    }
  });
});

describe('recordWorkflowRun — a espera por evento', () => {
  it('a continuação guarda o evento que a pausa espera', async () => {
    const { deps, entries } = setup(definition());
    const run = waitingRun();
    run.suspension = {
      ...(run.suspension as NonNullable<WorkflowRun['suspension']>),
      wait: { eventName: 'medico.saved', recordId: 'r1', until: 'event.ativo == true' },
    };
    await recordWorkflowRun(run, { definition: definition(), event }, deps);
    expect((entries.get('exec-1') as ResumeClockEntry).wait).toEqual({ eventName: 'medico.saved', recordId: 'r1', until: 'event.ativo == true' });
  });
});

describe('resumeWorkflowExecution — a espera de uma aprovação', () => {
  const prepareApproval = async (decided: boolean) => {
    const context = setup(definition());
    const expired: string[] = [];
    context.deps.expireTask = async (_tenantId, taskId) => { expired.push(taskId); };
    const run = waitingRun();
    run.suspension = { ...(run.suspension as NonNullable<WorkflowRun['suspension']>), taskId: 'exec-1_wait' };
    await recordWorkflowRun(run, { definition: definition(), event }, context.deps);
    const entry = context.entries.get('exec-1') as ResumeClockEntry;
    return { ...context, expired, entry: decided ? { ...entry, decided: true } : entry };
  };

  it('a continuação guarda a tarefa que a pausa espera', async () => {
    const { entry } = await prepareApproval(false);
    expect(entry.taskId).toBe('exec-1_wait');
  });

  it('retomada pelo PRAZO, sem decisão, fecha a tarefa como expirada', async () => {
    const { deps, entry, expired } = await prepareApproval(false);
    expect(await resumeWorkflowExecution(entry, deps)).toBe('fired');
    expect(expired).toEqual(['exec-1_wait']);
  });

  it('retomada pela DECISÃO não expira nada', async () => {
    const { deps, entry, expired } = await prepareApproval(true);
    expect(await resumeWorkflowExecution(entry, deps)).toBe('fired');
    expect(expired).toEqual([]);
  });

  it('retomada pela DECISÃO põe no histórico o resultado do passo — e não o de quando ele pausou', async () => {
    const { deps, entry, executions } = await prepareApproval(true);
    const decided = { ...entry, outputs: { ...entry.outputs, wait: { outcome: 'approved', decidedBy: 'ana' } } };
    await resumeWorkflowExecution(decided, deps);
    const line = executions.get('exec-1')?.logs.find((log) => log.message === '@core.automation/run.resume.step-outputs');
    expect(line).toMatchObject({ stepId: 'wait', outputs: { outcome: 'approved', decidedBy: 'ana' } });
  });

  it('retomada pelo PRAZO não acrescenta resultado: o que o passo deixou já é o do prazo', async () => {
    const { deps, entry, executions } = await prepareApproval(false);
    await resumeWorkflowExecution(entry, deps);
    expect(executions.get('exec-1')?.logs.some((log) => log.message === '@core.automation/run.resume.step-outputs')).toBe(false);
  });
});

describe('resumeWorkflowExecution — a versão em que a execução começou', () => {
  const prepare = async (stored: WorkflowDefinition, startedOn: WorkflowDefinition) => {
    const context = setup(stored);
    await recordWorkflowRun(waitingRun(), { definition: startedOn, event }, context.deps);
    return { ...context, entry: context.entries.get('exec-1') as ResumeClockEntry };
  };

  it('retoma a versão guardada, e não a editada durante a espera', async () => {
    const v1 = definition({ version: 1 });
    // Na v2, o passo depois da espera mudou de "b" para "c".
    const v2 = definition({ version: 2, steps: [recordStep('a', 0), { ...recordStep('wait', 1), id: 'wait' }, recordStep('c', 2)] });
    const { deps, order, entry, executions } = await prepare(v2, v1);
    expect(entry.definitionVersion).toBe(1);
    deps.findVersion = async (_tenantId, _definitionId, version) => (version === 1 ? { steps: v1.steps } : null);

    await resumeWorkflowExecution(entry, deps);

    expect(order).toEqual(['b']);
    expect(executions.get('exec-1')?.logs.map((log) => log.message))
      .toContain('@core.automation/run.resume.pinned');
  });

  it('sem a versão guardada, segue a de agora — o comportamento de antes', async () => {
    const v2 = definition({ version: 2, steps: [recordStep('a', 0), { ...recordStep('wait', 1), id: 'wait' }, recordStep('c', 2)] });
    const { deps, order, entry } = await prepare(v2, definition({ version: 1 }));
    deps.findVersion = async () => null;

    await resumeWorkflowExecution(entry, deps);
    expect(order).toEqual(['c']);
  });

  it('script ou automação chamada alterados durante a espera: AVISO no histórico, e a execução segue', async () => {
    const withScript = definition({
      steps: [
        recordStep('a', 0),
        { ...recordStep('wait', 1), id: 'wait' },
        recordStep('b', 2),
        // Desligado: não roda, e por isso não avisa.
        { id: 'x', stepDefinitionId: 'script', type: 'Script', order: 3, enabled: false, configuration: { scriptId: { kind: 'Literal', value: 'velho' } } },
        { id: 's', stepDefinitionId: 'script', type: 'Script', order: 4, enabled: true, configuration: { scriptId: { kind: 'Literal', value: 'calc' } } },
        { id: 'w', stepDefinitionId: 'call-workflow', type: 'SubWorkflow', order: 5, enabled: true, configuration: { targetWorkflowId: { kind: 'Literal', value: 'filho' } } },
      ],
    });
    const { deps, order, entry, executions } = await prepare(withScript, withScript);
    deps.dependencyChangedAt = async (_tenantId, kind) => (kind === 'script' ? new Date('2026-10-13T00:00:00Z') : new Date('2026-01-01T00:00:00Z'));

    await resumeWorkflowExecution(entry, deps);

    // O aviso vem ANTES dos passos: a execução segue — e aqui o script falha porque o registro do teste
    // não o conhece, o que prova que nada foi abortado por causa da mudança.
    expect(order).toEqual(['b']);
    const warnings = (executions.get('exec-1')?.logs ?? []).filter((log) => log.level === 'WARN');
    expect(warnings.map((log) => [log.message, log.messageParams])).toEqual([
      ['@core.automation/run.resume.script-changed', { ref: 'calc' }],
    ]);
  });
});

