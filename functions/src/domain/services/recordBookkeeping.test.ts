import { describe, expect, it } from 'vitest';
import { isBookkeepingWrite } from './recordBookkeeping';

describe('a gravação de contabilidade', () => {
  it('só `keyRefs` ou só `searchTerms` mudou: não é fato de negócio', () => {
    expect(isBookkeepingWrite({ a: 1 }, { a: 1, keyRefs: { k: 'x' } })).toBe(true);
    expect(isBookkeepingWrite({ a: 1, searchTerms: ['re'] }, { a: 1, searchTerms: ['re', 'rex'] })).toBe(true);
    expect(isBookkeepingWrite({ a: 1 }, { a: 1, keyRefs: {}, searchTerms: ['re'] })).toBe(true);
  });

  it('qualquer outro campo junto faz dela uma gravação de verdade', () => {
    expect(isBookkeepingWrite({ a: 1 }, { a: 2, searchTerms: ['re'] })).toBe(false);
    expect(isBookkeepingWrite({ a: 1 }, { a: 2, keyRefs: { k: 'x' } })).toBe(false);
  });

  it('nada mudou, criou ou apagou: não é contabilidade', () => {
    expect(isBookkeepingWrite({ a: 1 }, { a: 1 })).toBe(false);
    expect(isBookkeepingWrite(null, { searchTerms: [] })).toBe(false);
    expect(isBookkeepingWrite({ searchTerms: [] }, null)).toBe(false);
  });
});
