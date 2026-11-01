import { describe, expect, it } from 'vitest';
import type { WorkflowStep } from '../entities/Workflow';
import { actionReturnGaps } from './actionReturn';
import { returningStepsOf } from './workflowReturn';

let order = 0;

const step = (id: string, stepDefinitionId: string, configuration: WorkflowStep['configuration'] = {}): WorkflowStep => ({
  id, stepDefinitionId, type: 'Action', order: order++, enabled: true, configuration,
});

const map = (id: string, fields: string[], name?: string): WorkflowStep => step(id, 'map', {
  map: {
    kind: 'Literal',
    value: {
      ...(name === undefined ? {} : { name }),
      fields: fields.map((field) => ({ name: field, value: { kind: 'Literal', value: 'x' } })),
    },
  },
});

const exit = (id: string): WorkflowStep => step(id, 'exit');

const branch = (id: string, whenTrue: WorkflowStep[], whenFalse: WorkflowStep[]): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Condition',
  order: order++,
  enabled: true,
  configuration: {},
  condition: { kind: 'AlwaysTrue' },
  branches: { whenTrue, whenFalse },
});

const loop = (id: string, outputName: string, body: WorkflowStep[]): WorkflowStep => ({
  id,
  stepDefinitionId: '',
  type: 'Loop',
  order: order++,
  enabled: true,
  configuration: {},
  loop: { source: { kind: 'Literal', value: [] }, itemName: 'item', outputName, body },
});

const write = (id: string): WorkflowStep => step(id, 'upsert', { upsert: { kind: 'Literal', value: { table: 't', source: 'input' } } });

/**
 * O caminho, como o motor o percorre: o retorno é a saída do último passo executado, e o botão procura
 * `result`, `status` ou `actions` nela.
 */
describe('o fluxo de um botão responde em todos os caminhos', () => {
  it('o passo de gravação no fim não responde', () => {
    expect(actionReturnGaps([write('save')])).toEqual([{ stepId: 'save', stepDefinitionId: 'upsert' }]);
  });

  it('o map sem nome com status responde', () => {
    expect(actionReturnGaps([write('save'), map('answer', ['status', 'actions'])])).toEqual([]);
  });

  it('o map COM nome publica só o nome — responde apenas quando o nome é uma das três chaves', () => {
    expect(actionReturnGaps([map('build', ['status'], 'review')])).toEqual([{ stepId: 'build', stepDefinitionId: 'map' }]);
    expect(actionReturnGaps([map('build', ['total'], 'result')])).toEqual([]);
  });

  it('a variável chamada status responde', () => {
    expect(actionReturnGaps([step('flag', 'set-variable', {
      name: { kind: 'Literal', value: 'status' },
      value: { kind: 'Expression', expression: '"SUCCESS"' },
    })])).toEqual([]);
  });

  it('a recusa que devolve ERROR antes do exit e o caminho normal que termina no map respondem os dois', () => {
    const steps = [
      branch('allowed', [], [map('refused', ['status']), exit('stop')]),
      write('save'),
      map('answer', ['status', 'actions']),
    ];
    expect(actionReturnGaps(steps)).toEqual([]);
  });

  /** É o caso que `returningStepsOf` não vê: com um `exit` num ramo, ela deixa de olhar o fim normal. */
  it('acusa o fim normal sem retorno mesmo quando o ramo de recusa responde', () => {
    const steps = [
      branch('allowed', [], [map('refused', ['status']), exit('stop')]),
      write('save'),
    ];
    expect(returningStepsOf(steps).map((one) => one.id)).toEqual(['refused']);
    expect(actionReturnGaps(steps)).toEqual([{ stepId: 'save', stepDefinitionId: 'upsert' }]);
  });

  it('o exit que mantém como retorno o passo de antes, quando esse passo não responde', () => {
    const steps = [branch('allowed', [], [write('mark'), exit('stop')]), map('answer', ['status'])];
    expect(actionReturnGaps(steps)).toEqual([{ stepId: 'mark', stepDefinitionId: 'upsert' }]);
  });

  it('o exit antes de qualquer passo é um caminho em que nada rodou', () => {
    const steps = [branch('allowed', [], [exit('stop')]), map('answer', ['status'])];
    expect(actionReturnGaps(steps)).toEqual([{ stepId: null }]);
  });

  it('o ramo vazio converge, e quem responde é o passo depois dele', () => {
    expect(actionReturnGaps([branch('maybe', [write('save')], []), map('answer', ['actions'])])).toEqual([]);
    expect(actionReturnGaps([branch('maybe', [map('answer', ['actions'])], [])])).toEqual([{ stepId: null }]);
  });

  it('o laço publica só o vetor de saída, e o exit dentro dele devolve o passo de antes', () => {
    expect(actionReturnGaps([loop('each', 'items', [write('save')])])).toEqual([{ stepId: 'each', stepDefinitionId: 'Loop' }]);
    expect(actionReturnGaps([map('answer', ['status']), loop('each', 'result', [exit('stop')])])).toEqual([]);
  });

  it('o passo desligado não conta: quem responde é o último que roda', () => {
    const off = { ...map('answer', ['status']), enabled: false };
    expect(actionReturnGaps([write('save'), off])).toEqual([{ stepId: 'save', stepDefinitionId: 'upsert' }]);
  });

  it('o que só a execução sabe não vira aviso — script, fluxo chamado e passo de extensão', () => {
    expect(actionReturnGaps([step('run', 'script', { scriptId: { kind: 'Literal', value: 's' } })])).toEqual([]);
    expect(actionReturnGaps([step('call', 'call-workflow')])).toEqual([]);
    expect(actionReturnGaps([step('custom', 'com.acme/step')])).toEqual([]);
  });

  it('o fluxo sem passo nenhum não responde', () => {
    expect(actionReturnGaps([])).toEqual([{ stepId: null }]);
  });
});
