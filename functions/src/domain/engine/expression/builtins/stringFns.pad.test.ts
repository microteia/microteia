import { describe, expect, it } from 'vitest';
import type { WorkflowContext } from '../../../entities/WorkflowContext';
import { evaluateFieldExpression } from '../../../schema/fieldExpression';
import { padLeftFn, padRightFn } from './stringFns';

/**
 * #47: `padLeft`/`padRight` nasceram nas expressões de campo para o arquivo de leiaute fixo; o Workflow
 * tem de dar a MESMA resposta, ou a coluna montada numa automação sai com outra largura.
 */
const ctx = {} as WorkflowContext;
const CASES: Array<[string, unknown[]]> = [
  ['padLeft', [42, 6, '0']],
  ['padLeft', ['Microteia', 4]],
  ['padRight', ['ab', 5]],
  ['padRight', [null, 3, '*']],
];

describe('padLeft/padRight no Workflow (#47)', () => {
  it('dão a mesma resposta das expressões de campo', () => {
    for (const [name, args] of CASES) {
      const fn = name === 'padLeft' ? padLeftFn : padRightFn;
      const expression = `${name}(${args.map((arg) => JSON.stringify(arg)).join(', ')})`;
      expect(fn.call(args, ctx)).toBe(evaluateFieldExpression(expression, { value: null, data: {} }));
    }
  });

  it('completam e cortam na largura', () => {
    expect(padLeftFn.call([42, 6, '0'], ctx)).toBe('000042');
    expect(padRightFn.call(['Microteia', 4], ctx)).toBe('Micr');
  });

  it('recusam largura que não é número', () => {
    expect(() => padLeftFn.call(['a', '3'], ctx)).toThrow();
  });
});
