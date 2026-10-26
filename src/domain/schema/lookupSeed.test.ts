import { describe, expect, it } from 'vitest';
import { planLookupSeed } from './lookupSeed';

const A = { key: 'a', label: 'A' };
const B = { key: 'b', label: 'B' };
const C = { key: 'c', label: 'C' };

describe('planLookupSeed', () => {
  it('lista vazia recebe todas as opções, nos dois modos', () => {
    expect(planLookupSeed([A, B], 'when-empty', [], [])).toEqual({ create: [A, B], delivered: ['a', 'b'] });
    expect(planLookupSeed([A, B], 'required', [], ['a'])).toEqual({ create: [A, B], delivered: ['a', 'b'] });
  });

  it('when-empty não toca numa lista que já tem opções', () => {
    expect(planLookupSeed([A, B], 'when-empty', [{ key: 'x', label: 'X' }], [])).toEqual({ create: [], delivered: [] });
  });

  it('required acrescenta só o que falta, e o que o escritório já tem pela chave ou pelo rótulo conta como entregue', () => {
    const plan = planLookupSeed([A, B, C], 'required', [{ key: 'a', label: 'A' }, { key: 'outra', label: 'B' }], []);
    expect(plan).toEqual({ create: [C], delivered: ['a', 'b', 'c'] });
  });

  it('required entrega cada chave uma vez só: a que o escritório apagou não volta', () => {
    const plan = planLookupSeed([A, B, C], 'required', [{ key: 'x', label: 'X' }], ['a', 'b']);
    expect(plan).toEqual({ create: [C], delivered: ['a', 'b', 'c'] });
  });

  it('sem opções, nada muda', () => {
    expect(planLookupSeed([], 'required', [], ['a'])).toEqual({ create: [], delivered: ['a'] });
  });
});
