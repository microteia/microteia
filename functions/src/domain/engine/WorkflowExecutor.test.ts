import { describe, it, expect } from 'vitest';
import { runWorkflow } from './WorkflowExecutor';
import type { StepRegistry } from './StepRegistry';
import type { StepDefinition } from './StepDefinition';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { Condition, InputMapping, WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../entities/Workflow';

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

const recordFromExpr = (expr: string): WorkflowStep => ({
  id: `s-${seq++}`,
  stepDefinitionId: 'record',
  type: 'Action',
  order: 0,
  configuration: { tag: { kind: 'Expression', expression: expr } },
  enabled: true,
});

// Step que sempre falha: input obrigatório "tag" fica sem mapeamento, então resolveInputsSafe
// rejeita antes mesmo de executar.
const failingStep = (): WorkflowStep => ({
  id: `fail-${seq++}`,
  stepDefinitionId: 'record',
  type: 'Action',
  order: 0,
  configuration: {},
  enabled: true,
});

const loopStep = (
  id: string,
  source: InputMapping,
  body: WorkflowStep[],
  opts?: { itemName?: string; outputName?: string },
): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Loop',
  order: 0,
  configuration: {},
  enabled: true,
  loop: {
    source,
    itemName: opts?.itemName ?? 'item',
    outputName: opts?.outputName ?? 'itens',
    body,
  },
});

describe('runWorkflow — StepLoop (repetição / ForEach)', () => {
  it('itera uma lista de objetos e publica um vetor com o output do último substep', async () => {
    const order: string[] = [];
    const steps = withOrder([
      loopStep('loop-1', { kind: 'Event', path: 'items' }, withOrder([recordFromExpr('input.name')])),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['a', 'b', 'c']);
    expect(result.outputs).toEqual({ itens: [{ value: 'a' }, { value: 'b' }, { value: 'c' }] });
  });

  it('trata um item escalar único como lista de 1, sob o itemName', async () => {
    const order: string[] = [];
    const steps = withOrder([
      loopStep('loop-1', { kind: 'Event', path: 'name' }, withOrder([recordFromExpr('input.item')])),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ name: 'solo' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['solo']);
    expect(result.outputs).toEqual({ itens: [{ value: 'solo' }] });
  });

  it('lista vazia não roda nada e publica um vetor vazio', async () => {
    const order: string[] = [];
    const steps = withOrder([
      loopStep('loop-1', { kind: 'Event', path: 'items' }, withOrder([recordFromExpr('input.item')])),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ items: [] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual([]);
    expect(result.outputs).toEqual({ itens: [] });
  });

  it('isola os outputs entre iterações — a iteração 2 não enxerga o output da iteração 1', async () => {
    // A lê o próprio campo "value" via input; se o output da iteração anterior vazasse, o
    // coalesce pegaria o valor antigo em vez do "n" do item corrente.
    const order: string[] = [];
    const steps = withOrder([
      loopStep('loop-1', { kind: 'Event', path: 'items' }, withOrder([recordFromExpr('coalesce(input.value, input.n)')])),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ items: [{ n: 1 }, { n: 2 }] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ itens: [{ value: '1' }, { value: '2' }] });
  });

  it('fail-fast: erro numa iteração marca FAILED e interrompe as iterações seguintes', async () => {
    const order: string[] = [];
    const steps = withOrder([
      loopStep('loop-1', { kind: 'Event', path: 'items' }, withOrder([recordFromExpr('input.name'), failingStep()])),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ items: [{ name: 'a' }, { name: 'b' }] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('FAILED');
    expect(order).toEqual(['a']);
  });

  it('suporta loops aninhados', async () => {
    const order: string[] = [];
    const inner = loopStep('loop-inner', { kind: 'Expression', expression: 'input.items' }, withOrder([recordFromExpr('input.name')]), { outputName: 'inner' });
    const steps = withOrder([
      loopStep('loop-outer', { kind: 'Event', path: 'groups' }, withOrder([inner]), { outputName: 'outer' }),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ groups: [{ items: [{ name: 'a' }, { name: 'b' }] }, { items: [{ name: 'c' }] }] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['a', 'b', 'c']);
    expect(result.outputs).toEqual({
      outer: [
        { inner: [{ value: 'a' }, { value: 'b' }] },
        { inner: [{ value: 'c' }] },
      ],
    });
  });

  it('falha quando o StepLoop não tem configuração', async () => {
    const order: string[] = [];
    const broken: WorkflowStep = {
      id: 'loop-broken',
      stepDefinitionId: '',
      type: 'Loop',
      order: 0,
      configuration: {},
      enabled: true,
    };
    const result = await runWorkflow({
      definition: makeDefinition([broken]),
      event: makeEvent({ items: [] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('FAILED');
  });
});
