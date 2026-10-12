import { describe, it, expect } from 'vitest';
import { runWorkflow } from '../../../domain/engine/WorkflowExecutor';
import type { StepRegistry } from '../../../domain/engine/StepRegistry';
import type { StepDefinition } from '../../../domain/engine/StepDefinition';
import type { WorkflowServices } from '../../../domain/entities/WorkflowContext';
import type { InputMapping, WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../../../domain/entities/Workflow';
import { makeDelayStepDefinition } from './DelayStep';

const NOW = new Date('2026-10-12T12:00:00Z');

const makeRegistry = (order: string[]): StepRegistry => {
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
    outputDefinitions: [{ id: 'value', label: 'Value', type: 'String' }],
    createExecutor: () => ({
      execute: async (inputs) => {
        order.push(String(inputs.tag));
        return { success: true, outputs: { value: String(inputs.tag) } };
      },
    }),
  };
  const delay = makeDelayStepDefinition();
  return {
    register: () => undefined,
    resolve: (id) => (id === 'record' ? record : id === 'delay' ? delay : undefined),
    list: () => [record, delay],
  };
};

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => NOW,
};

const recordStep = (tag: string, order: number): WorkflowStep => ({
  id: `s-${tag}`,
  stepDefinitionId: 'record',
  type: 'Action',
  order,
  configuration: { tag: { kind: 'Literal', value: tag } },
  enabled: true,
});

const delayStep = (duration: string, order: number, id = 'wait'): WorkflowStep => ({
  id,
  stepDefinitionId: 'delay',
  type: 'Action',
  order,
  configuration: { duration: { kind: 'Literal', value: duration } },
  enabled: true,
});

const definition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  id: 'wf',
  tenantId: 't1',
  name: 'Espera',
  eventName: 'medico.saved',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps,
  createdAt: NOW,
  updatedAt: NOW,
});

const event: WorkflowEvent = { id: 'ev', tenantId: 't1', name: 'medico.saved', payload: { id: 'r1' }, timestamp: NOW };

describe('passo delay — pausar', () => {
  it('pausa no nível principal e devolve a continuação; os passos seguintes não rodam', async () => {
    const order: string[] = [];
    const run = await runWorkflow({
      definition: definition([recordStep('a', 0), delayStep('2d', 1), recordStep('b', 2)]),
      event,
      registry: makeRegistry(order),
      services,
      suspendable: true,
    });
    expect(order).toEqual(['a']);
    expect(run.status).toBe('WAITING');
    expect(run.finishedAt).toBeUndefined();
    expect(run.resumeAt?.toISOString()).toBe('2026-10-14T12:00:00.000Z');
    expect(run.suspension).toMatchObject({ afterStepId: 'wait', lastStepId: 'wait' });
    expect(run.suspension?.outputs['s-a']).toEqual({ value: 'a' });
  });

  it('recusa pausar onde ninguém pode esperar — o botão, o call-workflow aguardando', async () => {
    const order: string[] = [];
    const run = await runWorkflow({
      definition: definition([delayStep('1h', 0), recordStep('b', 1)]),
      event,
      registry: makeRegistry(order),
      services,
    });
    expect(run.status).toBe('FAILED');
    expect(run.logs.some((log) => log.message === '@core.automation/run.delay.not-suspendable')).toBe(true);
    expect(order).toEqual([]);
  });

  it('recusa pausar dentro de um ramo de condição', async () => {
    const branch: WorkflowStep = {
      id: 'cond',
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      configuration: {},
      enabled: true,
      condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: [delayStep('1h', 0)], whenFalse: [] },
    };
    const run = await runWorkflow({
      definition: definition([branch]),
      event,
      registry: makeRegistry([]),
      services,
      suspendable: true,
    });
    expect(run.status).toBe('FAILED');
    expect(run.logs.some((log) => log.message === '@core.automation/run.delay.nested')).toBe(true);
  });

  it('um `until` que já passou não pausa: o fluxo segue', async () => {
    const order: string[] = [];
    const past: WorkflowStep = {
      ...delayStep('', 1),
      configuration: { until: { kind: 'Literal', value: '2026-10-01T00:00:00Z' } },
    };
    const run = await runWorkflow({
      definition: definition([recordStep('a', 0), past, recordStep('b', 2)]),
      event,
      registry: makeRegistry(order),
      services,
      suspendable: true,
    });
    expect(run.status).toBe('SUCCESS');
    expect(order).toEqual(['a', 'b']);
  });

  it('recusa a duração malformada e a declaração ambígua', async () => {
    const configurations: Record<string, InputMapping>[] = [
      { duration: { kind: 'Literal', value: 'dois dias' } },
      { duration: { kind: 'Literal', value: '2d' }, until: { kind: 'Literal', value: '2026-10-20' } },
      {},
    ];
    for (const configuration of configurations) {
      const run = await runWorkflow({
        definition: definition([{ ...delayStep('', 0), configuration }]),
        event,
        registry: makeRegistry([]),
        services,
        suspendable: true,
      });
      expect(run.status).toBe('FAILED');
    }
  });
});

describe('passo delay — continuar', () => {
  it('continua depois do passo que esperou, na mesma execução, sem reavaliar a condição', async () => {
    const order: string[] = [];
    const steps = [recordStep('a', 0), delayStep('2d', 1), recordStep('b', 2), recordStep('c', 3)];
    const run = await runWorkflow({
      definition: { ...definition(steps), condition: { kind: 'Expression', expression: 'false' } },
      event,
      registry: makeRegistry(order),
      services,
      suspendable: true,
      resume: {
        executionId: 'exec-1',
        startedAt: new Date('2026-10-10T12:00:00Z'),
        logs: [{ level: 'INFO', message: 'antes', at: new Date('2026-10-10T12:00:00Z') }],
        afterStepId: 'wait',
        lastStepId: 'wait',
        outputs: { 's-a': { value: 'a' }, wait: {} },
        variables: {},
      },
    });
    expect(order).toEqual(['b', 'c']);
    expect(run.id).toBe('exec-1');
    expect(run.status).toBe('SUCCESS');
    expect(run.startedAt.toISOString()).toBe('2026-10-10T12:00:00.000Z');
    expect(run.logs[0].message).toBe('antes');
    expect(run.logs.some((log) => log.message === '@core.automation/run.delay.resumed')).toBe(true);
    expect(run.outputs).toEqual({ value: 'c' });
  });

  it('a automação que perdeu o passo em que parou termina cancelada', async () => {
    const run = await runWorkflow({
      definition: definition([recordStep('a', 0)]),
      event,
      registry: makeRegistry([]),
      services,
      suspendable: true,
      resume: { executionId: 'exec-1', startedAt: NOW, logs: [], afterStepId: 'wait', lastStepId: null, outputs: {}, variables: {} },
    });
    expect(run.status).toBe('CANCELLED');
  });
});
