import { describe, it, expect } from 'vitest';
import {
  declaresFillFrom,
  fillFromIssues,
  parametersForAI,
  sourceFilledValues,
} from './invocationSource';
import { WORKFLOW_CALLED_EVENT } from './eventCatalog';

const text = { key: 'sourceText', type: 'String', fillFrom: 'sourceText' };
const name = { key: 'sourceName', type: 'String', fillFrom: 'sourceName' };
const amount = { key: 'amount', type: 'Number' };

describe('conteúdo da invocação (fillFrom)', () => {
  it('a IA só recebe os parâmetros sem papel', () => {
    expect(parametersForAI([text, name, amount]).map((p) => p.key)).toEqual(['amount']);
  });

  it('o texto chega intacto, e o nome vazio quando o texto foi colado', () => {
    const raw = '  TUSD 0,83544863 R$/kWh\n  ';
    expect(sourceFilledValues([text, name, amount], { text: raw })).toEqual({ sourceText: raw, sourceName: '' });
    expect(sourceFilledValues([name], { text: '', name: 'conta.pdf' })).toEqual({ sourceName: 'conta.pdf' });
  });

  it('dentro de um Object o papel não preenche nada', () => {
    const nested = { key: 'group', type: 'Object', fields: [text] };
    expect(sourceFilledValues([nested], { text: 'x' })).toEqual({});
  });

  it('declaração válida não tem problema', () => {
    expect(fillFromIssues([text, name, amount], WORKFLOW_CALLED_EVENT)).toEqual([]);
  });

  it('recusa gatilho que não é chamável', () => {
    expect(fillFromIssues([text], 'invoice.saved').map((i) => i.message))
      .toEqual(['@core.automation/parameter.fill-from.not-callable']);
  });

  it('recusa tipo que não é String, lista, aninhado, repetido e valor desconhecido', () => {
    const issues = fillFromIssues([
      { key: 'a', type: 'Number', fillFrom: 'sourceText' },
      { key: 'b', type: 'String', list: true, fillFrom: 'sourceText' },
      { key: 'c', type: 'Object', fields: [{ key: 'd', type: 'String', fillFrom: 'sourceName' }] },
      text,
      { key: 'e', type: 'String', fillFrom: 'sourceText' },
      { key: 'f', type: 'String', fillFrom: 'processorText' },
    ], WORKFLOW_CALLED_EVENT);
    expect(issues.map((i) => [i.parameter, i.message.split('.').pop()])).toEqual([
      ['a', 'not-string'],
      ['b', 'not-string'],
      ['d', 'nested'],
      ['e', 'duplicate'],
      ['f', 'unknown'],
    ]);
  });

  it('acha o papel em qualquer nível', () => {
    expect(declaresFillFrom([amount])).toBe(false);
    expect(declaresFillFrom([{ key: 'g', type: 'Object', fields: [name] }])).toBe(true);
  });
});
