import { describe, it, expect } from 'vitest';
import { runWorkflow } from './WorkflowExecutor';
import type { StepRegistry } from './StepRegistry';
import type { StepDefinition } from './StepDefinition';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { Condition, WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../entities/Workflow';

// Step de teste "record": registra sua tag na ordem de execução e devolve { value: tag }.
const makeRecordStep = (order: string[]): StepDefinition => ({
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
      const tag = String(inputs.tag);
      order.push(tag);
      return { success: true, outputs: { value: tag } };
    },
  }),
});

const makeRegistry = (order: string[]): StepRegistry => {
  const record = makeRecordStep(order);
  return {
    register: () => undefined,
    resolve: (id) => (id === 'record' ? record : undefined),
    list: () => [record],
  };
};

const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-07-15T00:00:00Z'),
};

let seq = 0;
const recordStep = (tag: string): WorkflowStep => ({
  id: `s-${tag}-${seq++}`,
  stepDefinitionId: 'record',
  type: 'Action',
  order: 0,
  configuration: { tag: { kind: 'Literal', value: tag } },
  enabled: true,
});

const conditionStep = (condition: Condition, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[]): WorkflowStep => ({
  id: `cond-${seq++}`,
  stepDefinitionId: '',
  type: 'Condition',
  order: 0,
  configuration: {},
  enabled: true,
  condition,
  branches: { whenTrue, whenFalse },
});

const takeIf = (value: string): Condition => ({
  kind: 'FieldComparison',
  fieldPath: 'event.payload.branch',
  operator: '==',
  value,
  valueType: 'literal',
});

const withOrder = (steps: WorkflowStep[]): WorkflowStep[] => steps.map((s, i) => ({ ...s, order: i }));

const makeDefinition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  id: 'wf1',
  tenantId: 't1',
  name: 'WF',
  eventName: 'custom.event',
  enabled: true,
  version: 1,
  condition: { kind: 'AlwaysTrue' },
  steps,
  createdAt: new Date(),
  updatedAt: new Date(),
});

const makeEvent = (payload: Record<string, unknown>): WorkflowEvent => ({
  id: 'e1',
  tenantId: 't1',
  name: 'custom.event',
  payload,
  timestamp: new Date(),
});

describe('runWorkflow — StepCondition (ramificação)', () => {
  it('executa o ramo verdadeiro e converge para os steps seguintes', async () => {
    const order: string[] = [];
    const steps = withOrder([
      recordStep('A'),
      conditionStep(takeIf('yes'), withOrder([recordStep('T1'), recordStep('T2')]), withOrder([recordStep('F1')])),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'yes' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'T1', 'T2', 'Z']);
    // finalOutputs = último step executado (Z, após a convergência)
    expect(result.outputs).toEqual({ value: 'Z' });
  });

  it('executa o ramo falso quando a condição é falsa', async () => {
    const order: string[] = [];
    const steps = withOrder([
      recordStep('A'),
      conditionStep(takeIf('yes'), withOrder([recordStep('T1')]), withOrder([recordStep('F1'), recordStep('F2')])),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'no' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'F1', 'F2', 'Z']);
  });

  it('ramo vazio não roda nada e o fluxo continua', async () => {
    const order: string[] = [];
    const steps = withOrder([
      conditionStep(takeIf('yes'), [], withOrder([recordStep('F1')])),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'yes' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['Z']);
  });

  it('suporta condições aninhadas', async () => {
    const order: string[] = [];
    const inner = conditionStep(takeIf('deep'), withOrder([recordStep('D1')]), withOrder([recordStep('D2')]));
    const steps = withOrder([
      conditionStep(takeIf('outer'), withOrder([recordStep('O1'), inner]), withOrder([recordStep('X')])),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'outer' }),
      registry: makeRegistry(order),
      services,
    });
    // branch !== 'deep', então o aninhado toma o ramo falso (D2)
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['O1', 'D2']);
  });

  it('falha quando o StepCondition não tem condição configurada', async () => {
    const order: string[] = [];
    const broken: WorkflowStep = {
      id: 'cond-broken',
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      configuration: {},
      enabled: true,
      branches: { whenTrue: [], whenFalse: [] },
    };
    const result = await runWorkflow({
      definition: makeDefinition([broken]),
      event: makeEvent({ branch: 'yes' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('FAILED');
  });
});
