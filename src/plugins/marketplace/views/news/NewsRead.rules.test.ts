import { describe, expect, it } from 'vitest';
import { formatLikes, isTruncatable, newsIdOf, threadOf, withExpanded } from './NewsRead.rules';

/**
 * A ordem da discussão é o caso mais claro do que a divisão paga: "mais curtido primeiro, mais novo
 * entre iguais" é uma função de dois argumentos, e antes só era alcançável abrindo uma discussão e
 * lendo. Numa thread curta ela parece sempre certa.
 */
describe('a ordem da discussão', () => {
  const comment = (id, likes, createdAt) => ({
    id,
    newsId: 'n1',
    likedBy: new Array(likes).fill('u'),
    createdAt,
  });

  it('põe o mais curtido no topo', () => {
    const thread = threadOf([comment('a', 1, '2026-01-01'), comment('b', 5, '2026-01-01')], 'n1');
    expect(thread.map((one) => one.id)).toEqual(['b', 'a']);
  });

  it('e o mais novo primeiro entre os empatados', () => {
    const thread = threadOf([comment('velho', 0, '2026-01-01'), comment('novo', 0, '2026-02-01')], 'n1');
    expect(thread.map((one) => one.id)).toEqual(['novo', 'velho']);
  });

  it('só traz a discussão daquele aviso', () => {
    const outro = { id: 'x', newsId: 'n2', likedBy: [], createdAt: '2026-01-01' };
    expect(threadOf([comment('a', 0, '2026-01-01'), outro], 'n1').map((one) => one.id)).toEqual(['a']);
  });

  /** Um comentário sem data não pode derrubar a ordenação — ele vai para o fim, e nada estoura. */
  it('e aguenta um comentário sem data', () => {
    const thread = threadOf([comment('sem', 0, null), comment('com', 0, '2026-01-01')], 'n1');
    expect(thread.map((one) => one.id)).toEqual(['com', 'sem']);
  });
});

describe('o aviso que a aba está lendo', () => {
  it('sai da chave da aba, e de nenhum outro lugar', () => {
    expect(newsIdOf('news-read:abc123')).toBe('abc123');
  });

  it('e uma aba sem chave não lê nada', () => {
    expect(newsIdOf(undefined)).toBe('');
  });
});

describe('o comentário longo', () => {
  it('só dobra depois do limite', () => {
    expect(isTruncatable('a'.repeat(500))).toBe(false);
    expect(isTruncatable('a'.repeat(501))).toBe(true);
  });

  it('e abrir um não fecha os outros', () => {
    expect(withExpanded({ a: true }, 'b')).toEqual({ a: true, b: true });
    expect(withExpanded({ a: true }, 'a')).toEqual({ a: false });
  });
});

describe('a contagem de curtidas', () => {
  it('abrevia o milhar e guarda uma casa quando ela diz algo', () => {
    expect(formatLikes(999)).toBe('999');
    expect(formatLikes(1000)).toBe('1k');
    expect(formatLikes(1500)).toBe('1.5k');
    expect(formatLikes(2000)).toBe('2k');
  });
});
