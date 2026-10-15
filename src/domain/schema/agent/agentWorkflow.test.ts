import { describe, expect, it } from 'vitest';
import type { InputMapping, WorkflowParameter, WorkflowStep } from '../../entities/Workflow';
import { buildMessageCatalog } from '../i18n/messages';
import {
  describeParameters,
  describeWorkflowTrigger,
  indexStepCatalog,
  summarizeSteps,
  unknownParameterKeys,
  workflowDataAccess,
  workflowIdempotency,
  workflowOutputs,
  workflowPauses,
} from './agentWorkflow';

const catalog = buildMessageCatalog([], 'en');
const steps = indexStepCatalog();

const literal = (value: unknown): InputMapping => ({ kind: 'Literal', value });

const step = (id: string, stepDefinitionId: string, order: number, configuration: Record<string, InputMapping> = {}): WorkflowStep =>
  ({ id, stepDefinitionId, type: 'Action', order, configuration, enabled: true });

const PARAMETERS: WorkflowParameter[] = [
  { key: 'code', label: 'Code', type: 'String', required: true },
  { key: 'category', label: 'Category', type: 'lookup', lookupCollection: 'categories' },
  { key: 'contact', label: 'Contact', type: 'EntityReference', entityType: 'contacts' },
  { key: 'kind', label: 'Kind', type: 'select', options: [{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }] },
  { key: 'startsOn', label: 'Starts on', type: 'Date', defaultValue: '2026-01-02' },
  {
    key: 'lines',
    label: 'Lines',
    type: 'Object',
    list: true,
    fields: [{ key: 'name', label: 'Name', type: 'String', required: true }],
  },
];

describe('describeParameters — o parâmetro sai pela CHAVE', () => {
  // O defeito de origem: o recurso lia `name`, o parâmetro é gravado como `key`, e todo parâmetro
  // chegava ao agente como `"name": ""`.
  it('expõe a chave, o rótulo, o tipo e a obrigatoriedade', () => {
    const [code] = describeParameters(catalog, PARAMETERS);
    expect(code).toMatchObject({ key: 'code', label: 'Code', type: 'String', required: true });
    expect(code.example).toBe('text');
    expect(code.accepts.length).toBeGreaterThan(0);
  });

  it('diz de onde vem o valor de uma lista do escritório e de uma referência', () => {
    const described = describeParameters(catalog, PARAMETERS);
    expect(described[1]).toMatchObject({ optionsFrom: 'categories' });
    expect(described[2]).toMatchObject({ references: 'contacts' });
  });

  it('a lista fechada expõe o value que se grava, e o exemplo é um deles', () => {
    const kind = describeParameters(catalog, PARAMETERS)[3];
    expect(kind.options).toEqual([{ value: 'first', label: 'First' }, { value: 'second', label: 'Second' }]);
    expect(kind.example).toBe('first');
  });

  it('o padrão declarado vira o exemplo', () => {
    expect(describeParameters(catalog, PARAMETERS)[4]).toMatchObject({ default: '2026-01-02', example: '2026-01-02' });
  });

  it('o objeto em lista desce nos campos e o exemplo é uma lista', () => {
    const lines = describeParameters(catalog, PARAMETERS)[5];
    expect(lines.list).toBe(true);
    expect(lines.fields?.map((one) => one.key)).toEqual(['name']);
    expect(lines.example).toEqual([{ name: 'text' }]);
  });
});

describe('unknownParameterKeys — o nome errado não some', () => {
  it('nomeia a chave que nenhum parâmetro declara', () => {
    expect(unknownParameterKeys(PARAMETERS, { itemCode: 'x', category: 'a' })).toEqual(['itemCode']);
  });

  it('desce no objeto, item a item quando ele é lista', () => {
    expect(unknownParameterKeys(PARAMETERS, { lines: [{ name: 'a' }, { nome: 'b' }] })).toEqual(['lines[1].nome']);
  });

  it('as chaves certas passam', () => {
    expect(unknownParameterKeys(PARAMETERS, { code: '1', lines: [{ name: 'a' }] })).toEqual([]);
  });
});

describe('a automação lida pelos passos', () => {
  const workflow: WorkflowStep[] = [
    step('q', 'query', 0, { query: literal({ table: 'categories', where: [], limit: 10, projections: [] }) }),
    step('u', 'upsert', 1, { upsert: literal({ table: 'items', source: 'event' }) }),
  ];

  it('diz o que lê e o que grava pelo TIPO de input, não pelo nome do passo', () => {
    const summary = summarizeSteps(catalog, steps, workflow);
    expect(summary.map((one) => [one.id, one.reads, one.writes])).toEqual([
      ['q', 'categories', undefined],
      ['u', undefined, 'items'],
    ]);
    expect(summary[1].inputs).toEqual({ upsert: { value: { table: 'items', source: 'event' } } });
  });

  it('gravar onde há chave única é seguro repetir; onde não há, pode duplicar', () => {
    const summary = summarizeSteps(catalog, steps, workflow);
    const keyed = workflowDataAccess(summary, () => ['code']);
    expect(keyed.writes).toEqual([{ collection: 'items', uniqueKeys: ['code'] }]);
    expect(workflowIdempotency(summary, keyed, steps)).toEqual({ idempotent: 'yes', because: 'keyed-writes' });

    const loose = workflowDataAccess(summary, () => []);
    expect(workflowIdempotency(summary, loose, steps)).toEqual({ idempotent: 'no', because: 'may-duplicate' });
  });

  it('só leitura é seguro repetir', () => {
    const summary = summarizeSteps(catalog, steps, [workflow[0]]);
    expect(workflowIdempotency(summary, workflowDataAccess(summary, () => []), steps))
      .toEqual({ idempotent: 'yes', because: 'reads-only' });
  });

  it('um Script ou um passo desconhecido torna o veredito desconhecido', () => {
    const summary = summarizeSteps(catalog, steps, [step('s', 'script', 0, { scriptId: literal('importer') })]);
    expect(summary[0].runsScript).toBe('importer');
    expect(workflowIdempotency(summary, workflowDataAccess(summary, () => []), steps))
      .toEqual({ idempotent: 'unknown', because: 'opaque-steps' });

    const unknown = summarizeSteps(catalog, steps, [step('x', 'vendor-step', 0)]);
    expect(workflowIdempotency(unknown, workflowDataAccess(unknown, () => []), steps).idempotent).toBe('unknown');
  });

  it('o passo desligado não conta como efeito', () => {
    const summary = summarizeSteps(catalog, steps, [{ ...workflow[1], enabled: false }]);
    expect(summary[0].enabled).toBe(false);
    expect(workflowDataAccess(summary, () => []).writes).toEqual([]);
  });

  it('a condição desce nos dois ramos', () => {
    const condition: WorkflowStep = {
      id: 'c',
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      configuration: {},
      enabled: true,
      condition: { kind: 'Expression', expression: 'event.kind == "first"' },
      branches: { whenTrue: [workflow[1]], whenFalse: [] },
    };
    const summary = summarizeSteps(catalog, steps, [condition]);
    expect(summary[0]).toMatchObject({ kind: 'condition', condition: { kind: 'Expression' } });
    expect(workflowDataAccess(summary, () => []).writes.map((one) => one.collection)).toEqual(['items']);
  });

  it('o resultado são as saídas do último passo', () => {
    const output = workflowOutputs(catalog, steps, workflow);
    expect(output).toHaveLength(1);
    expect(output[0].step).toBe('u');
    expect(output[0].fields.map((one) => one.key)).toEqual(['id', 'created', 'record']);
  });
});

describe('passos recentes do motor, como o agente os lê', () => {
  it('gerar documento anexa um arquivo novo a cada execução: não é seguro repetir', () => {
    const summary = summarizeSteps(catalog, steps, [
      step('d', 'render-document', 0, { templateKey: literal('quote'), recordId: literal('r1') }),
    ]);
    expect(workflowIdempotency(summary, workflowDataAccess(summary, () => []), steps))
      .toEqual({ idempotent: 'no', because: 'appends' });
  });

  it('a espera no nível principal é dita como ponto de pausa', () => {
    const summary = summarizeSteps(catalog, steps, [
      step('q', 'query', 0, { query: literal({ table: 'categories', where: [], limit: 10, projections: [] }) }),
      step('w', 'delay', 1, { duration: literal('2d') }),
    ]);
    expect(workflowPauses(summary)).toEqual(['w']);
  });

  it('a espera desligada não pausa', () => {
    const summary = summarizeSteps(catalog, steps, [{ ...step('w', 'delay', 0), enabled: false }]);
    expect(workflowPauses(summary)).toEqual([]);
  });
});

describe('describeWorkflowTrigger — como a automação nasce', () => {
  it('a chamável é a única que o agente inicia', () => {
    expect(describeWorkflowTrigger({ eventName: 'workflow.called' })).toEqual({ kind: 'called' });
  });

  it('a de horário diz o cron, e o fuso só quando sobrescreve o do escritório', () => {
    expect(describeWorkflowTrigger({ eventName: 'schedule', schedule: { cron: '0 8 * * MON-FRI' } }))
      .toEqual({ kind: 'schedule', cron: '0 8 * * MON-FRI' });
    expect(describeWorkflowTrigger({ eventName: 'schedule', schedule: { cron: '@daily', timeZone: 'UTC' } }))
      .toEqual({ kind: 'schedule', cron: '@daily', timeZone: 'UTC' });
  });

  it('a de data diz o campo, o deslocamento e a hora, com a hora padrão quando ausente', () => {
    expect(describeWorkflowTrigger({ eventName: 'invoices.dateReached', dateReached: { field: 'dueDate', offset: '-3d' } }))
      .toEqual({ kind: 'date-reached', on: 'invoices', field: 'dueDate', offset: '-3d', at: '08:00' });
  });

  it('a de gravação diz a coleção e o gesto', () => {
    expect(describeWorkflowTrigger({ eventName: 'invoices.saved' })).toEqual({ kind: 'record', on: 'invoices', when: 'saved' });
    expect(describeWorkflowTrigger({ eventName: 'invoices.deleted' })).toEqual({ kind: 'record', on: 'invoices', when: 'deleted' });
  });

  it('o que não tem vocabulário próprio sai com o nome do evento', () => {
    expect(describeWorkflowTrigger({ eventName: 'lookup.saved' })).toEqual({ kind: 'other', eventName: 'lookup.saved' });
  });
});
