import { describe, it, expect } from 'vitest';
import { runWorkflow } from './WorkflowExecutor';
import type { StepRegistry } from './StepRegistry';
import type { StepDefinition } from './StepDefinition';
import type { WorkflowServices } from '../entities/WorkflowContext';
import type { InputMapping, WorkflowDefinition, WorkflowEvent, WorkflowStep } from '../entities/Workflow';

/**
 * Os RAMOS PARALELOS e o laço CONCORRENTE — provados com passos que esperam portões controlados pelo teste.
 * É o que separa "rodou em paralelo" de "deu o mesmo resultado": um portão só abre quando o teste manda, e
 * a ordem de início e de fim de cada passo fica registrada.
 */

const deferred = () => {
  let resolve!: () => void;
  const promise = new Promise<void>((done) => { resolve = done; });
  return { promise, resolve };
};

interface Harness {
  events: string[];
  gates: Map<string, ReturnType<typeof deferred>>;
  inFlight: { now: number; max: number };
  registry: StepRegistry;
}

const step = (id: string, inputs: string[], execute: StepDefinition['createExecutor']): StepDefinition => ({
  id, version: 1, name: id, description: '', icon: 'x', category: 'Action', type: 'Action', configurable: true,
  inputs: inputs.map((input) => ({ id: input, label: input, required: false, type: 'String' })),
  outputDefinitions: [],
  createExecutor: execute,
});

const harness = (): Harness => {
  const events: string[] = [];
  const gates = new Map<string, ReturnType<typeof deferred>>();
  const inFlight = { now: 0, max: 0 };
  const gateOf = (tag: string) => {
    if (!gates.has(tag)) gates.set(tag, deferred());
    return gates.get(tag)!;
  };
  const definitions: StepDefinition[] = [
    // Espera o portão da própria tag; registra início e fim.
    step('gate', ['tag'], () => ({
      execute: async (inputs) => {
        const tag = String(inputs.tag);
        events.push(`start:${tag}`);
        inFlight.now += 1;
        inFlight.max = Math.max(inFlight.max, inFlight.now);
        await gateOf(tag).promise;
        inFlight.now -= 1;
        events.push(`end:${tag}`);
        return { success: true, outputs: { value: tag } };
      },
    })),
    // Lê a configuração e o id do passo DEPOIS de esperar — é onde um contexto compartilhado trocaria os dois.
    step('probe', ['tag'], () => ({
      execute: async (_inputs, context) => {
        const before = String((context.stepConfiguration?.tag as { value?: unknown } | undefined)?.value);
        await gateOf(`probe:${before}`).promise;
        const after = String((context.stepConfiguration?.tag as { value?: unknown } | undefined)?.value);
        context.logger.info(`log:${after}`);
        return { success: true, outputs: { before, after, stepId: context.stepId ?? '', sees: Object.keys(context.outputs).sort().join(',') } };
      },
    })),
    step('setvar', ['name', 'value'], () => ({
      execute: async (inputs, context) => {
        context.variables[String(inputs.name)] = inputs.value;
        return { success: true, outputs: {} };
      },
    })),
    step('fail', ['tag'], () => ({
      execute: async (inputs) => {
        events.push(`fail:${String(inputs.tag)}`);
        return { success: false, message: 'boom' };
      },
    })),
    step('exit', [], () => ({ execute: async () => ({ success: true, halt: true }) })),
    step('pause', [], () => ({ execute: async () => ({ success: true, suspend: { resumeAt: new Date('2027-01-01T00:00:00Z') } }) })),
    step('echo', ['value'], () => ({ execute: async (inputs) => ({ success: true, outputs: { value: inputs.value } }) })),
  ];
  const byId = new Map(definitions.map((one) => [one.id, one]));
  return {
    events, gates, inFlight,
    registry: { register: () => undefined, resolve: (id) => byId.get(id), list: () => definitions },
  };
};

/** Abre os portões quando todos os passos esperados já começaram — e na ordem pedida. */
const openWhenStarted = async (h: Harness, expected: string[], order: string[]): Promise<void> => {
  for (let spins = 0; spins < 200; spins += 1) {
    if (expected.every((tag) => h.events.includes(`start:${tag}`) || h.gates.has(tag))) break;
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
  for (const tag of order) {
    if (!h.gates.has(tag)) h.gates.set(tag, deferred());
    h.gates.get(tag)!.resolve();
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
};

const lit = (value: unknown): InputMapping => ({ kind: 'Literal', value });

let seq = 0;
const action = (stepDefinitionId: string, configuration: Record<string, InputMapping> = {}, id?: string): WorkflowStep => ({
  id: id ?? `${stepDefinitionId}-${seq++}`, stepDefinitionId, type: 'Action', order: seq, configuration, enabled: true,
});
const gate = (tag: string, id?: string) => action('gate', { tag: lit(tag) }, id);
const parallel = (branches: { id: string; label?: string; steps: WorkflowStep[] }[], id = `par-${seq++}`): WorkflowStep => ({
  id, stepDefinitionId: '', type: 'Parallel', order: seq++, configuration: {}, enabled: true, parallel: { branches },
});
const ordered = (steps: WorkflowStep[]): WorkflowStep[] => steps.map((one, index) => ({ ...one, order: index }));

const definition = (steps: WorkflowStep[]): WorkflowDefinition => ({
  id: 'wf', tenantId: 't1', name: 'Paralelo', eventName: 'x.saved', enabled: true, version: 1,
  condition: { kind: 'AlwaysTrue' }, steps: ordered(steps), createdAt: new Date(), updatedAt: new Date(),
});
const event: WorkflowEvent = { id: 'ev', tenantId: 't1', name: 'x.saved', payload: { id: 'r1' }, timestamp: new Date() };
const services: WorkflowServices = {
  logger: { info: () => undefined, warn: () => undefined, error: () => undefined },
  now: () => new Date('2026-11-13T12:00:00Z'),
};

const run = (h: Harness, steps: WorkflowStep[], extra: Partial<Parameters<typeof runWorkflow>[0]> = {}) =>
  runWorkflow({ definition: definition(steps), event, registry: h.registry, services, ...extra });

describe('ramos paralelos — simultaneidade', () => {
  it('os ramos COMEÇAM juntos: os dois passos estão no meio antes de qualquer um terminar', async () => {
    const h = harness();
    const running = run(h, [parallel([{ id: 'a', steps: [gate('A')] }, { id: 'b', steps: [gate('B')] }])]);
    await openWhenStarted(h, ['A', 'B'], ['B', 'A']);
    const result = await running;
    expect(result.status).toBe('SUCCESS');
    expect(h.events.slice(0, 2).sort()).toEqual(['start:A', 'start:B']);
    expect(h.inFlight.max).toBe(2);
  });

  it('dentro de um ramo, os passos continuam em sequência', async () => {
    const h = harness();
    const running = run(h, [parallel([
      { id: 'a', steps: ordered([gate('A1'), gate('A2')]) },
      { id: 'b', steps: [gate('B')] },
    ])]);
    await openWhenStarted(h, ['A1', 'B'], ['A1', 'A2', 'B']);
    await running;
    expect(h.events.indexOf('end:A1')).toBeLessThan(h.events.indexOf('start:A2'));
  });

  it('o passo depois do nó só começa quando TODOS os ramos terminaram', async () => {
    const h = harness();
    const running = run(h, [
      parallel([{ id: 'a', steps: [gate('A')] }, { id: 'b', steps: [gate('B')] }]),
      gate('DEPOIS'),
    ]);
    await openWhenStarted(h, ['A', 'B'], ['A', 'B', 'DEPOIS']);
    await running;
    expect(h.events.indexOf('start:DEPOIS')).toBeGreaterThan(h.events.indexOf('end:A'));
    expect(h.events.indexOf('start:DEPOIS')).toBeGreaterThan(h.events.indexOf('end:B'));
  });
});

describe('ramos paralelos — isolamento e junção', () => {
  it('cada passo enxerga a PRÓPRIA configuração e o próprio id, mesmo intercalando com o ramo vizinho', async () => {
    const h = harness();
    const running = run(h, [parallel([
      { id: 'a', steps: [action('probe', { tag: lit('A') }, 'probeA')] },
      { id: 'b', steps: [action('probe', { tag: lit('B') }, 'probeB')] },
    ], 'par')]);
    await openWhenStarted(h, [], ['probe:B', 'probe:A']);
    const result = await running;
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toMatchObject({
      branches: {
        a: { before: 'A', after: 'A', stepId: 'probeA' },
        b: { before: 'B', after: 'B', stepId: 'probeB' },
      },
    });
  });

  it('o ramo não vê a saída do vizinho; o passo depois do nó vê as dos dois', async () => {
    const h = harness();
    const running = run(h, [
      parallel([
        { id: 'a', steps: ordered([gate('A', 'gA'), action('probe', { tag: lit('PA') }, 'probeA')]) },
        { id: 'b', steps: ordered([gate('B', 'gB'), action('probe', { tag: lit('PB') }, 'probeB')]) },
      ], 'par'),
      action('echo', { value: { kind: 'Output', stepId: 'gB', outputId: 'value' } as InputMapping }, 'depois'),
    ]);
    await openWhenStarted(h, ['A', 'B'], ['A', 'B', 'probe:PA', 'probe:PB']);
    const result = await running;
    const logOf = (stepId: string) => result.logs.find((entry) => entry.stepId === stepId && entry.level === 'SUCCESS');
    expect(String(logOf('probeA')?.outputs?.sees)).toContain('gA');
    expect(String(logOf('probeA')?.outputs?.sees)).not.toContain('gB');
    expect(String(logOf('probeB')?.outputs?.sees)).not.toContain('gA');
    expect(result.outputs).toEqual({ value: 'B' });
  });

  it('a saída do nó é a do último passo de cada ramo, pela chave do ramo', async () => {
    const h = harness();
    const running = run(h, [parallel([{ id: 'a', steps: [gate('A')] }, { id: 'b', steps: [gate('B')] }])]);
    await openWhenStarted(h, ['A', 'B'], ['A', 'B']);
    expect((await running).outputs).toEqual({ branches: { a: { value: 'A' }, b: { value: 'B' } } });
  });

  it('variáveis: as de ramos diferentes se somam; a mesma em dois ramos vale a do ramo DEPOIS na declaração, com aviso', async () => {
    const h = harness();
    const result = await run(h, [
      parallel([
        { id: 'a', label: 'Primeiro', steps: ordered([
          action('setvar', { name: lit('x'), value: lit('do A') }),
          action('setvar', { name: lit('so-a'), value: lit(1) }),
        ]) },
        { id: 'b', label: 'Segundo', steps: ordered([
          action('setvar', { name: lit('x'), value: lit('do B') }),
          action('setvar', { name: lit('so-b'), value: lit(2) }),
        ]) },
      ], 'par'),
      action('echo', { value: { kind: 'Variable', name: 'x' } as InputMapping }),
    ]);
    expect(result.outputs).toEqual({ value: 'do B' });
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.parallel.variable-conflict'
      && entry.messageParams?.variable === 'x' && entry.messageParams.first === 'Primeiro' && entry.messageParams.second === 'Segundo')).toBe(true);
  });

  it('a mensagem que o passo registra vai para o passo certo, mesmo com os dois ramos intercalados', async () => {
    const h = harness();
    const running = run(h, [parallel([
      { id: 'a', steps: [action('probe', { tag: lit('A') }, 'probeA')] },
      { id: 'b', steps: [action('probe', { tag: lit('B') }, 'probeB')] },
    ])]);
    await openWhenStarted(h, [], ['probe:A', 'probe:B']);
    const result = await running;
    expect(result.logs.find((entry) => entry.message === 'log:A')?.stepId).toBe('probeA');
    expect(result.logs.find((entry) => entry.message === 'log:B')?.stepId).toBe('probeB');
  });
});

describe('ramos paralelos — falha, encerramento e pausa', () => {
  it('um ramo que falha falha a automação, DEPOIS de o vizinho terminar; o histórico nomeia o ramo', async () => {
    const h = harness();
    const running = run(h, [
      parallel([
        { id: 'a', label: 'Cobrança', steps: [action('fail', { tag: lit('A') })] },
        { id: 'b', steps: [gate('B')] },
      ]),
      gate('NUNCA'),
    ]);
    await openWhenStarted(h, ['B'], ['B']);
    const result = await running;
    expect(result.status).toBe('FAILED');
    expect(h.events).toContain('end:B');
    expect(h.events).not.toContain('start:NUNCA');
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.parallel.branch-failed'
      && entry.messageParams?.branch === 'Cobrança')).toBe(true);
  });

  it('"Encerrar" num ramo encerra a automação depois da junção, com a saída do ramo que encerrou', async () => {
    const h = harness();
    const running = run(h, [
      parallel([
        { id: 'a', steps: ordered([action('echo', { value: lit('antes') }, 'ultimoA'), action('exit')]) },
        { id: 'b', steps: [gate('B')] },
      ]),
      gate('NUNCA'),
    ]);
    await openWhenStarted(h, ['B'], ['B']);
    const result = await running;
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ value: 'antes' });
    expect(h.events).toContain('end:B');
    expect(h.events).not.toContain('start:NUNCA');
  });

  it('o que pausa não pausa dentro de um ramo: a automação falha dizendo por quê', async () => {
    const h = harness();
    const result = await run(h, [parallel([{ id: 'a', steps: [action('pause')] }, { id: 'b', steps: [action('echo', { value: lit(1) })] }])], { suspendable: true });
    expect(result.status).toBe('FAILED');
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.delay.nested')).toBe(true);
  });

  it('menos de dois ramos não é paralelo: falha sem rodar nada', async () => {
    const h = harness();
    const result = await run(h, [parallel([{ id: 'a', steps: [gate('A')] }])]);
    expect(result.status).toBe('FAILED');
    expect(h.events).toEqual([]);
    expect(result.logs.some((entry) => entry.message === '@core.automation/run.parallel.missing-config')).toBe(true);
  });

  it('o orçamento de tempo vale dentro de cada ramo', async () => {
    const h = harness();
    const result = await run(h, [parallel([{ id: 'a', steps: [gate('A')] }, { id: 'b', steps: [gate('B')] }])], {
      services: { ...services, deadlineAt: new Date('2026-11-13T11:00:00Z').getTime() },
    });
    expect(result.status).toBe('FAILED');
    expect(h.events).toEqual([]);
  });

  it('paralelo dentro de condição, e condição dentro de ramo — a árvore desce nos dois sentidos', async () => {
    const h = harness();
    const result = await run(h, [{
      id: 'cond', stepDefinitionId: '', type: 'Condition', order: 0, configuration: {}, enabled: true,
      condition: { kind: 'AlwaysTrue' },
      branches: {
        whenTrue: [parallel([
          { id: 'a', steps: [{
            id: 'inner', stepDefinitionId: '', type: 'Condition', order: 0, configuration: {}, enabled: true,
            condition: { kind: 'AlwaysTrue' },
            branches: { whenTrue: [action('echo', { value: lit('dentro') }, 'fundo')], whenFalse: [] },
          }] },
          { id: 'b', steps: [action('echo', { value: lit('vizinho') })] },
        ], 'par')],
        whenFalse: [],
      },
    }]);
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ branches: { a: { value: 'dentro' }, b: { value: 'vizinho' } } });
  });

  it('ramo desligado não roda; ramo vazio termina na hora', async () => {
    const h = harness();
    const result = await run(h, [parallel([
      { id: 'a', steps: [{ ...gate('A'), enabled: false }] },
      { id: 'b', steps: [] },
    ])]);
    expect(result.status).toBe('SUCCESS');
    expect(h.events).toEqual([]);
    expect(result.outputs).toEqual({ branches: { a: {}, b: {} } });
  });
});

describe('laço concorrente', () => {
  const loop = (items: unknown[], body: WorkflowStep[], concurrency?: number): WorkflowStep => ({
    id: 'laco', stepDefinitionId: '', type: 'Loop', order: 0, configuration: {}, enabled: true,
    loop: { source: lit(items), itemName: 'item', outputName: 'resultados', body, ...(concurrency ? { concurrency } : {}) },
  });
  const itemGate = (): WorkflowStep => action('gate', { tag: { kind: 'Output', stepId: 'laco', outputId: 'item' } as InputMapping }, 'corpo');

  it('a saída mantém a ORDEM DOS ITENS, mesmo terminando fora de ordem', async () => {
    const h = harness();
    const running = run(h, [loop(['i1', 'i2', 'i3'], [itemGate()], 3)]);
    await openWhenStarted(h, ['i1', 'i2', 'i3'], ['i3', 'i1', 'i2']);
    const result = await running;
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ resultados: [{ value: 'i1' }, { value: 'i2' }, { value: 'i3' }] });
    expect(h.events.indexOf('end:i3')).toBeLessThan(h.events.indexOf('end:i1'));
  });

  it('nunca passa do teto declarado de itens ao mesmo tempo', async () => {
    const h = harness();
    const items = ['a', 'b', 'c', 'd', 'e'];
    const running = run(h, [loop(items, [itemGate()], 2)]);
    for (let spins = 0; spins < 50 && h.events.filter((one) => one.startsWith('start')).length < 2; spins += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0));
    }
    expect(h.events.filter((one) => one.startsWith('start'))).toHaveLength(2);
    await openWhenStarted(h, [], items);
    await running;
    expect(h.inFlight.max).toBe(2);
  });

  it('sem concorrência, segue em sequência como sempre', async () => {
    const h = harness();
    const running = run(h, [loop(['a', 'b'], [itemGate()])]);
    await openWhenStarted(h, ['a'], ['a', 'b']);
    await running;
    expect(h.inFlight.max).toBe(1);
    expect(h.events).toEqual(['start:a', 'end:a', 'start:b', 'end:b']);
  });

  it('um item que falha não deixa começar os que faltam, e o laço falha', async () => {
    const h = harness();
    const body = [action('fail', { tag: { kind: 'Output', stepId: 'laco', outputId: 'item' } as InputMapping })];
    const result = await run(h, [loop(['a', 'b', 'c', 'd'], body, 2)]);
    expect(result.status).toBe('FAILED');
    expect(h.events.filter((one) => one.startsWith('fail')).length).toBeLessThanOrEqual(2);
  });

  it('"Encerrar" no corpo encerra com o item de MENOR posição que encerrou', async () => {
    const h = harness();
    const body = ordered([
      action('echo', { value: { kind: 'Output', stepId: 'laco', outputId: 'item' } as InputMapping }, 'antes'),
      {
        id: 'se', stepDefinitionId: '', type: 'Condition', order: 1, configuration: {}, enabled: true,
        condition: { kind: 'FieldComparison', fieldPath: 'input.item', operator: '!=', value: 'a', valueType: 'literal' },
        branches: { whenTrue: [action('exit')], whenFalse: [] },
      },
    ]);
    const result = await run(h, [loop(['a', 'b', 'c'], body, 3)]);
    expect(result.status).toBe('SUCCESS');
    expect(result.outputs).toEqual({ value: 'b' });
  });

  it('variáveis do corpo voltam na ordem dos itens: vale a do último item, como em sequência', async () => {
    const h = harness();
    const body = [action('setvar', { name: lit('ultimo'), value: { kind: 'Output', stepId: 'laco', outputId: 'item' } as InputMapping })];
    const result = await run(h, [loop(['a', 'b', 'c'], body, 3), action('echo', { value: { kind: 'Variable', name: 'ultimo' } as InputMapping })]);
    expect(result.outputs).toEqual({ value: 'c' });
  });
});
