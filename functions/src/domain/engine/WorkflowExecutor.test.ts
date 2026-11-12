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

// Step de teste "exit": mesmo contrato do Step "Encerrar Workflow" — sinaliza halt sem outputs.
const makeExitStep = (order: string[]): StepDefinition => ({
  id: 'exit',
  version: 1,
  name: 'Exit',
  description: '',
  icon: 'x',
  category: 'Action',
  type: 'Action',
  configurable: false,
  inputs: [],
  outputDefinitions: [],
  createExecutor: () => ({
    execute: async () => {
      order.push('EXIT');
      return { success: true, halt: true };
    },
  }),
});

const makeRegistry = (order: string[]): StepRegistry => {
  const record = makeRecordStep(order);
  const exit = makeExitStep(order);
  return {
    register: () => undefined,
    resolve: (id) => (id === 'record' ? record : id === 'exit' ? exit : undefined),
    list: () => [record, exit],
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

describe('runWorkflow — parâmetros obrigatórios', () => {
  const withParams = (parameters: WorkflowDefinition['parameters']): WorkflowDefinition => ({
    ...makeDefinition([recordStep('a')]),
    parameters,
  });

  it('falha quando um parâmetro obrigatório está ausente no payload', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: withParams([{ key: 'nome', label: 'Nome', required: true, type: 'String' }]),
      event: makeEvent({ tag: 'a' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('FAILED');
    expect(order).toEqual([]);
    // O motivo viaja como REFERÊNCIA em `reason`, com o campo em `label`: é o que permite à tela
    // resolver a frase de dentro em vez de mostrar a chave crua colada num resumo.
    expect(result.logs.some(
      (entry) => entry.messageParams?.reason?.includes('parameter.required') ?? false,
    )).toBe(true);
    expect(result.logs.some((entry) => entry.messageParams?.label === 'Nome')).toBe(true);
  });

  it('falha quando um parâmetro obrigatório está vazio', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: withParams([{ key: 'nome', label: 'Nome', required: true, type: 'String' }]),
      event: makeEvent({ tag: 'a', nome: '   ' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('FAILED');
    expect(order).toEqual([]);
  });

  it('prossegue quando os parâmetros obrigatórios estão preenchidos', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: withParams([{ key: 'nome', label: 'Nome', required: true, type: 'String' }]),
      event: makeEvent({ tag: 'a', nome: 'Fulano' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['a']);
  });

  it('o passo recebe os parâmetros declarados — é por eles que ele resolve o tipo de um caminho', async () => {
    const seen: unknown[] = [];
    const probe: StepDefinition = {
      ...makeRecordStep([]),
      id: 'probe',
      createExecutor: () => ({
        execute: async (_inputs, context) => {
          seen.push(context.parameters);
          return { success: true };
        },
      }),
    };
    const registry: StepRegistry = { register: () => undefined, resolve: () => probe, list: () => [probe] };
    const parameters: WorkflowDefinition['parameters'] = [{ key: 'nome', label: 'Nome', type: 'String' }];
    const step = { ...recordStep('a'), stepDefinitionId: 'probe' };

    await runWorkflow({ definition: { ...withParams(parameters), steps: [step] }, event: makeEvent({}), registry, services });
    await runWorkflow({ definition: makeDefinition([step]), event: makeEvent({}), registry, services });

    expect(seen).toEqual([parameters, undefined]);
  });
});

const exitStep = (): WorkflowStep => ({
  id: `exit-${seq++}`,
  stepDefinitionId: 'exit',
  type: 'Action',
  order: 0,
  configuration: {},
  enabled: true,
});

describe('runWorkflow — Encerrar Workflow (halt)', () => {
  it('para no encerramento e devolve as saídas do step anterior', async () => {
    const order: string[] = [];
    const steps = withOrder([recordStep('A'), recordStep('B'), exitStep(), recordStep('C')]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'B', 'EXIT']);
    expect(result.outputs).toEqual({ value: 'B' });
  });

  it('encerra de dentro de um ramo de condição, sem rodar os steps após a condição', async () => {
    const order: string[] = [];
    const steps = withOrder([
      recordStep('A'),
      conditionStep(takeIf('yes'), withOrder([recordStep('T1'), exitStep()]), withOrder([recordStep('F1')])),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'yes' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'T1', 'EXIT']);
    expect(result.outputs).toEqual({ value: 'T1' });
  });

  it('encerramento no início de um ramo devolve as saídas do step anterior à condição', async () => {
    const order: string[] = [];
    const steps = withOrder([
      recordStep('A'),
      conditionStep(takeIf('yes'), withOrder([exitStep()]), withOrder([recordStep('F1')])),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'yes' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'EXIT']);
    expect(result.outputs).toEqual({ value: 'A' });
  });

  it('encerra de dentro de uma repetição, interrompendo as iterações seguintes', async () => {
    const order: string[] = [];
    const steps = withOrder([
      loopStep(
        'loop-1',
        { kind: 'Event', path: 'items' },
        withOrder([
          recordFromExpr('input.name'),
          conditionStep(
            { kind: 'FieldComparison', fieldPath: 'input.name', operator: '==', value: 'b', valueType: 'literal' },
            withOrder([exitStep()]),
            [],
          ),
        ]),
      ),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ items: [{ name: 'a' }, { name: 'b' }, { name: 'c' }] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['a', 'b', 'EXIT']);
    expect(result.outputs).toEqual({ value: 'b' });
  });

  it('encerramento no início do corpo de uma repetição devolve as saídas do step anterior ao loop', async () => {
    const order: string[] = [];
    const steps = withOrder([
      recordStep('A'),
      loopStep('loop-1', { kind: 'Event', path: 'items' }, withOrder([exitStep()])),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ items: [{ name: 'a' }, { name: 'b' }] }),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'EXIT']);
    expect(result.outputs).toEqual({ value: 'A' });
  });

  it('encerramento como primeiro step do fluxo devolve outputs vazios', async () => {
    const order: string[] = [];
    const steps = withOrder([exitStep(), recordStep('A')]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['EXIT']);
    expect(result.outputs).toEqual({});
  });

  it('sem encerramento, o retorno continua sendo o último step do fluxo', async () => {
    const order: string[] = [];
    const steps = withOrder([recordStep('A'), recordStep('B')]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ value: 'B' });
  });
});

describe('runWorkflow — passo incompatível com o gatilho', () => {
  const restrictedRegistry = (order: string[]): StepRegistry => {
    const base = makeRegistry(order);
    const record = base.resolve('record') as StepDefinition;
    const restricted: StepDefinition = { ...record, excludedTriggers: ['custom.event'] };
    return { ...base, resolve: (id) => (id === 'record' ? restricted : base.resolve(id)) };
  };

  it('recusa o passo que o catálogo declara proibido para o gatilho, sem executá-lo', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([recordStep('A')])),
      event: makeEvent({}),
      registry: restrictedRegistry(order),
      services,
    });
    expect(result.status).toBe('FAILED');
    expect(order).toEqual([]);
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.step.excluded-trigger')).toBe(true);
  });

  it('em outro gatilho o mesmo passo roda', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: { ...makeDefinition(withOrder([recordStep('A')])), eventName: 'other.event' },
      event: makeEvent({}),
      registry: restrictedRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A']);
  });
});

describe('runWorkflow — linhas do histórico', () => {
  /** O que o Firestore recusa sem `ignoreUndefinedProperties`: a chave presente com valor `undefined`. */
  const undefinedKeys = (logs: Array<object>): string[] =>
    logs.flatMap((entry, index) =>
      Object.entries(entry).filter(([, value]) => value === undefined).map(([key]) => `${index}.${key}`));

  it('nenhuma linha leva campo undefined — condição, laço, passo e falha', async () => {
    const steps = withOrder([
      conditionStep(takeIf('yes'), withOrder([recordStep('T')]), withOrder([recordStep('F')])),
      loopStep('loop-1', { kind: 'Event', path: 'items' }, withOrder([recordFromExpr('input.item')])),
      failingStep(),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'no', items: ['a', 'b'] }),
      registry: makeRegistry([]),
      services,
    });

    expect(result.status).toBe('FAILED');
    const branchLine = result.logs.find((entry) => entry.message === '@core.automation/run.condition.false-branch');
    expect(branchLine).toBeDefined();
    expect('stepDefinitionId' in branchLine!).toBe(false);
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.loop.start')).toBe(true);
    expect(undefinedKeys(result.logs)).toEqual([]);
  });

  it('o campo que existe continua na linha', async () => {
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([recordStep('A')])),
      event: makeEvent({}),
      registry: makeRegistry([]),
      services,
    });

    const stepLine = result.logs.find((entry) => entry.level === 'SUCCESS');
    expect(stepLine).toMatchObject({ stepDefinitionId: 'record', inputs: { tag: 'A' }, outputs: { value: 'A' } });
  });
});

/**
 * A execução que a porta deixa de fora termina `SUCCESS` e sem saída, como a que rodou e não devolveu
 * nada. A marca é o que deixa o chamador separar as duas — o status não muda: para um gatilho, "não era
 * comigo" não é falha.
 */
describe('runWorkflow — a execução que a porta deixa de fora', () => {
  it('a condição falsa marca a execução como pulada, sem rodar passo nem mudar o status', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: { ...makeDefinition(withOrder([recordStep('A')])), condition: takeIf('yes') },
      event: makeEvent({ branch: 'no' }),
      registry: makeRegistry(order),
      services,
    });
    expect(result).toMatchObject({ status: 'SUCCESS', outputs: {}, skipped: 'condition' });
    expect(order).toEqual([]);
  });

  it('o filtro de tela marca a execução como pulada pela tela', async () => {
    const result = await runWorkflow({
      definition: { ...makeDefinition(withOrder([recordStep('A')])), screenKey: 'orders' },
      event: makeEvent({ screenKey: 'invoices' }),
      registry: makeRegistry([]),
      services,
    });
    expect(result).toMatchObject({ status: 'SUCCESS', skipped: 'screen' });
  });

  it('a execução que rodou não leva a marca — nem quando termina sem saída', async () => {
    const ran = await runWorkflow({
      definition: makeDefinition(withOrder([recordStep('A')])),
      event: makeEvent({}),
      registry: makeRegistry([]),
      services,
    });
    const empty = await runWorkflow({ definition: makeDefinition([]), event: makeEvent({}), registry: makeRegistry([]), services });
    expect('skipped' in ran).toBe(false);
    expect(empty.status).toBe('SUCCESS');
    expect('skipped' in empty).toBe(false);
  });
});

describe('runWorkflow — orçamento de tempo (deadlineAt)', () => {
  it('sem orçamento, nada muda: todos os passos rodam', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([recordStep('A'), recordStep('B')])),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services,
    });
    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['A', 'B']);
  });

  it('passado o orçamento, para ANTES do passo seguinte e grava a execução como falha, dizendo por quê', async () => {
    const order: string[] = [];
    let clock = new Date('2026-07-15T00:00:00Z').getTime();
    const ticking: WorkflowServices = {
      ...services,
      now: () => new Date(clock),
      deadlineAt: clock + 10_000,
    };
    const slow: StepRegistry = {
      ...makeRegistry(order),
      resolve: (id) => {
        const step = makeRegistry(order).resolve(id);
        if (!step) return undefined;
        return {
          ...step,
          createExecutor: () => ({
            execute: async (inputs, context) => {
              const result = await step.createExecutor().execute(inputs, context);
              clock += 11_000;
              return result;
            },
          }),
        };
      },
    };
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([recordStep('A'), recordStep('B')])),
      event: makeEvent({}),
      registry: slow,
      services: ticking,
    });
    expect(order).toEqual(['A']);
    expect(result.status).toBe('FAILED');
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.budget-exceeded')).toBe(true);
  });

  it('o orçamento vale também dentro de um ramo de condição', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([
        conditionStep(takeIf('yes'), withOrder([recordStep('T1')]), []),
      ])),
      event: makeEvent({ branch: 'yes' }),
      registry: makeRegistry(order),
      services: { ...services, deadlineAt: services.now().getTime() - 1 },
    });
    expect(order).toEqual([]);
    expect(result.status).toBe('FAILED');
  });
});

describe('runWorkflow — Switch (caminhos)', () => {
  const switchStep = (cases: { id: string; when: Condition; steps: WorkflowStep[] }[], otherwise: WorkflowStep[]): WorkflowStep => ({
    id: `sw-${seq++}`,
    stepDefinitionId: '',
    type: 'Switch',
    order: 0,
    configuration: {},
    enabled: true,
    switch: {
      cases: cases.map((one) => ({ id: one.id, condition: one.when, steps: withOrder(one.steps) })),
      otherwise: withOrder(otherwise),
    },
  });

  const paths = (): WorkflowStep[] => withOrder([
    switchStep([
      { id: 'c1', when: takeIf('a'), steps: [recordStep('A')] },
      { id: 'c2', when: takeIf('b'), steps: [recordStep('B')] },
      { id: 'c3', when: { kind: 'AlwaysTrue' }, steps: [recordStep('ALWAYS')] },
    ], [recordStep('OTHER')]),
    recordStep('Z'),
  ]);

  it('segue o PRIMEIRO caminho que vale — e só ele — e converge depois do nó', async () => {
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(paths()),
      event: makeEvent({ branch: 'b' }),
      registry: makeRegistry(order),
      services,
    });

    expect(result.status).toBe('SUCCESS');
    expect(order).toEqual(['B', 'Z']);
  });

  it('nenhum caminho valendo, roda o "senão"', async () => {
    const order: string[] = [];
    const steps = withOrder([
      switchStep([{ id: 'c1', when: takeIf('a'), steps: [recordStep('A')] }], [recordStep('OTHER')]),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({ branch: 'x' }),
      registry: makeRegistry(order),
      services,
    });

    expect(order).toEqual(['OTHER']);
    expect(result.outputs).toEqual({ value: 'OTHER' });
  });

  it('o encerramento dentro de um caminho atravessa o nó', async () => {
    const order: string[] = [];
    const exit: WorkflowStep = { ...recordStep('x'), stepDefinitionId: 'exit', configuration: {} };
    const steps = withOrder([
      switchStep([{ id: 'c1', when: { kind: 'AlwaysTrue' }, steps: [recordStep('A'), exit] }], []),
      recordStep('Z'),
    ]);
    const result = await runWorkflow({
      definition: makeDefinition(steps),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services,
    });

    expect(order).toEqual(['A', 'EXIT']);
    expect(result.outputs).toEqual({ value: 'A' });
  });
});

describe('runWorkflow — filtro de mudança do gatilho', () => {
  const saved = (filter: Partial<WorkflowDefinition>): WorkflowDefinition => ({
    ...makeDefinition(withOrder([recordStep('RAN')])),
    eventName: 'invoices.saved',
    ...filter,
  });

  const run = (definition: WorkflowDefinition, payload: Record<string, unknown>) => runWorkflow({
    definition,
    event: { ...makeEvent(payload), name: 'invoices.saved' },
    registry: makeRegistry([]),
    services,
  });

  it('"só quando alterado" não roda na criação', async () => {
    const result = await run(saved({ changeType: 'updated' }), { changeType: 'created', status: 'open' });

    expect(result.skipped).toBe('change');
    expect(result.status).toBe('SUCCESS');
  });

  it('"só quando a situação mudar" ignora o salvamento que não a mudou', async () => {
    const result = await run(
      saved({ changedFields: ['status'] }),
      { changeType: 'updated', status: 'open', title: 'novo', old: { status: 'open', title: 'velho' } },
    );

    expect(result.skipped).toBe('change');
  });

  it('roda quando um dos campos pedidos mudou', async () => {
    const result = await run(
      saved({ changedFields: ['status', 'amount'] }),
      { changeType: 'updated', status: 'paid', old: { status: 'open' } },
    );

    expect(result.skipped).toBeUndefined();
    expect(result.outputs).toEqual({ value: 'RAN' });
  });

  it('na criação, o campo "mudou" quando nasce preenchido', async () => {
    expect((await run(saved({ changedFields: ['status'] }), { changeType: 'created', status: 'open' })).skipped)
      .toBeUndefined();
    expect((await run(saved({ changedFields: ['status'] }), { changeType: 'created', status: '' })).skipped)
      .toBe('change');
  });
});

describe('runWorkflow — política de falha do passo (onError)', () => {
  /** Um passo que falha nas primeiras `failures` chamadas e depois funciona. */
  const flakyRegistry = (failures: number, calls: { count: number }, order: string[]): StepRegistry => {
    const record = makeRecordStep(order);
    const flaky: StepDefinition = {
      ...record,
      id: 'flaky',
      inputs: [],
      createExecutor: () => ({
        execute: async () => {
          calls.count += 1;
          if (calls.count <= failures) throw new Error('serviço fora do ar');
          order.push('FLAKY');
          return { success: true, outputs: { value: 'ok' } };
        },
      }),
    };
    return {
      register: () => undefined,
      resolve: (id) => (id === 'flaky' ? flaky : id === 'record' ? record : undefined),
      list: () => [record, flaky],
    };
  };

  const flakyStep = (onError?: WorkflowStep['onError']): WorkflowStep => ({
    id: 'chamada',
    stepDefinitionId: 'flaky',
    type: 'Action',
    order: 0,
    configuration: {},
    enabled: true,
    ...(onError ? { onError } : {}),
  });

  const sleeps: number[] = [];
  const quickServices: WorkflowServices = { ...services, sleep: async (ms) => { sleeps.push(ms); } };

  it('sem política, a falha encerra a execução — como sempre', async () => {
    const calls = { count: 0 };
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([flakyStep(), recordStep('Z')])),
      event: makeEvent({}),
      registry: flakyRegistry(1, calls, order),
      services: quickServices,
    });

    expect(result.status).toBe('FAILED');
    expect(calls.count).toBe(1);
    expect(order).toEqual([]);
  });

  it('tenta de novo, esperando um pouco mais a cada vez, até dar certo', async () => {
    sleeps.length = 0;
    const calls = { count: 0 };
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([flakyStep({ retries: 3 }), recordStep('Z')])),
      event: makeEvent({}),
      registry: flakyRegistry(2, calls, order),
      services: quickServices,
    });

    expect(result.status).toBe('SUCCESS');
    expect(calls.count).toBe(3);
    expect(sleeps).toEqual([1000, 2000]);
    expect(order).toEqual(['FLAKY', 'Z']);
  });

  it('"seguir em frente" publica a falha como saída e continua', async () => {
    const calls = { count: 0 };
    const order: string[] = [];
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([flakyStep({ action: 'continue' })])),
      event: makeEvent({}),
      registry: flakyRegistry(5, calls, order),
      services: quickServices,
    });

    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ failed: true, error: 'serviço fora do ar' });
    expect(result.logs.some((log) => log.message === '@core.automation/run.step.continued')).toBe(true);
  });

  it('não tenta de novo se a espera atravessaria o orçamento da execução', async () => {
    const calls = { count: 0 };
    const result = await runWorkflow({
      definition: makeDefinition(withOrder([flakyStep({ retries: 3 })])),
      event: makeEvent({}),
      registry: flakyRegistry(5, calls, []),
      services: { ...quickServices, deadlineAt: services.now().getTime() + 500 },
    });

    expect(result.status).toBe('FAILED');
    expect(calls.count).toBe(1);
  });
});

describe('runWorkflow — Loop sobre consulta paginada', () => {
  const records = Array.from({ length: 5 }, (_, index) => ({ id: `r${index + 1}`, name: `n${index + 1}` }));
  const pagedServices = (calls: (string | null)[]): WorkflowServices => ({
    ...services,
    queryPage: async (_spec, cursor, pageSize) => {
      calls.push(cursor);
      const start = cursor ? records.findIndex((record) => record.id === cursor) + 1 : 0;
      const items = records.slice(start, start + pageSize);
      const hasMore = start + pageSize < records.length;
      return { ok: true, items, cursor: hasMore ? items.at(-1)?.id ?? null : null, hasMore };
    },
  });
  const pagedLoop = (pageSize: number): WorkflowStep => ({
    ...loopStep('lote', { kind: 'Literal', value: [] }, []),
    loop: {
      source: { kind: 'Literal', value: [] },
      itemName: 'item',
      outputName: 'itens',
      body: withOrder([recordFromExpr('input.name')]),
      query: { spec: { table: 't', where: [], projections: [], limit: 100 }, pageSize },
    },
  });

  it('processa UMA página e pausa com o cursor para a próxima volta do relógio', async () => {
    const order: string[] = [];
    const calls: (string | null)[] = [];
    const run = await runWorkflow({
      definition: makeDefinition(withOrder([pagedLoop(2), recordStep('depois')])),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services: pagedServices(calls),
      suspendable: true,
    });

    expect(run.status).toBe('WAITING');
    expect(order).toEqual(['n1', 'n2']);
    expect(run.suspension?.loop).toEqual({ stepId: 'lote', cursor: 'r2', page: 1, processed: 2 });
    expect(run.suspension?.afterStepId).toBe('lote');
    expect(calls).toEqual([null]);
  });

  it('a retomada volta AO laço pelo cursor, e na última página segue para o passo seguinte', async () => {
    const order: string[] = [];
    const calls: (string | null)[] = [];
    const definition = makeDefinition(withOrder([pagedLoop(2), recordStep('depois')]));
    const params = { definition, event: makeEvent({}), registry: makeRegistry(order), services: pagedServices(calls), suspendable: true };
    const first = await runWorkflow(params);
    const second = await runWorkflow({
      ...params,
      resume: { ...first.suspension!, executionId: first.id, startedAt: first.startedAt, logs: first.logs },
    });
    const third = await runWorkflow({
      ...params,
      resume: { ...second.suspension!, executionId: second.id, startedAt: second.startedAt, logs: second.logs },
    });

    expect(calls).toEqual([null, 'r2', 'r4']);
    expect(order).toEqual(['n1', 'n2', 'n3', 'n4', 'n5', 'depois']);
    expect(third.status).toBe('SUCCESS');
    expect(third.logs.some((log) => log.message === '@core.automation/run.loop.paged-done')).toBe(true);
  });

  it('fora de uma execução que pode esperar, reprova em vez de processar só a primeira página', async () => {
    const order: string[] = [];
    const run = await runWorkflow({
      definition: makeDefinition(withOrder([pagedLoop(2)])),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services: pagedServices([]),
    });
    expect(run.status).toBe('FAILED');
    expect(order).toEqual([]);
    expect(run.logs.map((log) => log.message)).toContain('@core.automation/run.loop.paged-cannot-wait');
  });

  it('uma página só termina na hora, com o que foi feito como saída', async () => {
    const order: string[] = [];
    const run = await runWorkflow({
      definition: makeDefinition(withOrder([pagedLoop(10)])),
      event: makeEvent({}),
      registry: makeRegistry(order),
      services: pagedServices([]),
      suspendable: true,
    });
    expect(run.status).toBe('SUCCESS');
    expect(run.outputs).toEqual({ processed: 5, pages: 1 });
  });
});
