import { describe, expect, it } from 'vitest';
import {
  categoryLabelOf,
  commentCountsOf,
  indexById,
  matchesReadStatus,
  tagsOf,
  toggled,
  unreadCountOf,
} from './NewsList.rules';

/**
 * O que este teste exercita morava dentro do componente, e é a regra que menos se prova olhando: o
 * mural é DIFERENTE para cada pessoa. Um erro em "quem já leu" mostra a tela certa para quem
 * desenvolve e a errada para todo o resto do escritório — e ninguém reclama de um aviso que nunca viu.
 */
const item = (fields) => ({ id: 'n', ...fields });

describe('o filtro de leitura', () => {
  const mine = 'u1';

  it('sem filtro nenhum, tudo passa', () => {
    expect(matchesReadStatus(item({}), [], mine)).toBe(true);
  });

  it('separa lido de não lido pela pessoa que está olhando', () => {
    const read = item({ readBy: ['u1'] });
    expect(matchesReadStatus(read, ['READ'], mine)).toBe(true);
    expect(matchesReadStatus(read, ['UNREAD'], mine)).toBe(false);
    expect(matchesReadStatus(read, ['UNREAD'], 'u2')).toBe(true);
  });

  it('e reconhece o guardado', () => {
    expect(matchesReadStatus(item({ savedBy: ['u1'] }), ['SAVED'], mine)).toBe(true);
    expect(matchesReadStatus(item({ savedBy: ['u2'] }), ['SAVED'], mine)).toBe(false);
  });

  it('um status que ninguém declarou não deixa nada passar', () => {
    expect(matchesReadStatus(item({}), ['INVENTADO'], mine)).toBe(false);
  });
});

describe('a contagem do menu', () => {
  /** O próprio aviso nunca está "não lido" para quem o escreveu. */
  it('não conta o que a própria pessoa publicou', () => {
    const records = [item({ id: 'a', createdBy: 'u1' }), item({ id: 'b', createdBy: 'u2' })];
    expect(unreadCountOf(records, 'u1')).toBe(1);
  });

  it('e não conta o que ela já leu', () => {
    const records = [item({ id: 'a', createdBy: 'u2', readBy: ['u1'] })];
    expect(unreadCountOf(records, 'u1')).toBe(0);
  });
});

describe('o gesto de entrar e sair de uma lista', () => {
  it('quem está fora entra, quem está dentro sai', () => {
    expect(toggled(['u2'], 'u1')).toEqual(['u2', 'u1']);
    expect(toggled(['u2', 'u1'], 'u1')).toEqual(['u2']);
  });

  /** O campo pode nunca ter sido escrito — e aí ele chega como `undefined`, não como lista vazia. */
  it('e o campo que ainda não existe conta como lista vazia', () => {
    expect(toggled(undefined, 'u1')).toEqual(['u1']);
  });
});

describe('o resto do cartão', () => {
  it('conta os comentários por aviso, ignorando o comentário sem dono', () => {
    const comments = [{ newsId: 'a' }, { newsId: 'a' }, { newsId: 'b' }, {}];
    expect(commentCountsOf(comments)).toEqual({ a: 2, b: 1 });
  });

  it('resolve as etiquetas e descarta a que não existe mais', () => {
    const index = indexById([{ id: 't1', name: 'Urgent' }]);
    expect(tagsOf(item({ tagIds: ['t1', 'apagada'] }), index)).toEqual([{ id: 't1', name: 'Urgent' }]);
  });

  /**
   * A categoria é vocabulário do ESCRITÓRIO: se ele apagou a opção, o que ficou gravado no registro
   * continua sendo o rótulo — inventar um genérico apagaria o que a pessoa escolheu.
   */
  it('mostra a opção quando ela existe, o valor gravado quando não, e o padrão quando não há nada', () => {
    const categories = [{ key: 'hr', label: 'People' }];
    expect(categoryLabelOf(categories, item({ category: 'hr' }), 'General')).toBe('People');
    expect(categoryLabelOf(categories, item({ category: 'apagada' }), 'General')).toBe('apagada');
    expect(categoryLabelOf(categories, item({}), 'General')).toBe('General');
  });
});
