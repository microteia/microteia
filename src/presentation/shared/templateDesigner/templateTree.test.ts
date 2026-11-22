import { describe, expect, it } from 'vitest';
import {
  containerHeight,
  countNodes,
  duplicateNode,
  fitsDepth,
  getIn,
  insertNode,
  issueTarget,
  moveNode,
  nodeAt,
  parsePathKey,
  pathKey,
  removeNode,
  setIn,
  unwrapNode,
  updateNode,
  wrapNode,
} from './templateTree';

const isContainer = (type: unknown) => type === 'row' || type === 'stack';

const body = (): unknown[] => [
  { type: 'actions' },
  { type: 'row', children: [{ type: 'avatar' }, { type: 'stack', children: [{ type: 'title' }, { type: 'subtitle' }] }] },
  { type: 'tags' },
];

describe('templateTree', () => {
  it('acha o nó pelo caminho e devolve undefined fora da árvore', () => {
    expect(nodeAt(body(), [1, 1, 0])).toEqual({ type: 'title' });
    expect(nodeAt(body(), [0, 0])).toBeUndefined();
    expect(nodeAt(body(), [7])).toBeUndefined();
  });

  it('converte o caminho em chave e de volta', () => {
    expect(pathKey([1, 0, 2])).toBe('1.0.2');
    expect(parsePathKey('1.0.2')).toEqual([1, 0, 2]);
    expect(parsePathKey('')).toEqual([]);
  });

  it('insere sem mutar a árvore original e devolve o caminho do inserido', () => {
    const original = body();
    const snapshot = JSON.stringify(original);
    const edit = insertNode(original, [1, 1], 1, { type: 'text', text: 'x' });
    expect(edit.path).toEqual([1, 1, 1]);
    expect(nodeAt(edit.body, [1, 1])).toEqual({ type: 'stack', children: [{ type: 'title' }, { type: 'text', text: 'x' }, { type: 'subtitle' }] });
    expect(JSON.stringify(original)).toBe(snapshot);
  });

  it('limita o índice de inserção ao tamanho da lista', () => {
    expect(insertNode(body(), [], 99, { type: 'divider' }).path).toEqual([3]);
  });

  it('remove o nó com tudo o que ele contém', () => {
    const next = removeNode(body(), [1]);
    expect(next).toEqual([{ type: 'actions' }, { type: 'tags' }]);
  });

  it('move para depois de um irmão, descontando a saída do próprio nó', () => {
    const edit = moveNode(body(), [0], [], 3);
    expect(edit?.path).toEqual([2]);
    expect((edit?.body ?? []).map((node) => (node as { type: string }).type)).toEqual(['row', 'tags', 'actions']);
  });

  it('move para dentro de um contêiner que vinha depois do nó', () => {
    const edit = moveNode(body(), [0], [1, 1], 0);
    expect(edit?.path).toEqual([0, 1, 0]);
    expect(nodeAt(edit?.body ?? [], [0, 1])).toEqual({
      type: 'stack',
      children: [{ type: 'actions' }, { type: 'title' }, { type: 'subtitle' }],
    });
  });

  it('move de dentro de um contêiner para o corpo', () => {
    const edit = moveNode(body(), [1, 1, 1], [], 0);
    expect(edit?.path).toEqual([0]);
    expect(nodeAt(edit?.body ?? [], [0])).toEqual({ type: 'subtitle' });
    expect(nodeAt(edit?.body ?? [], [2, 1])).toEqual({ type: 'stack', children: [{ type: 'title' }] });
  });

  it('recusa mover um contêiner para dentro dele mesmo', () => {
    expect(moveNode(body(), [1], [1, 1], 0)).toBeNull();
    expect(moveNode(body(), [1], [1], 0)).toBeNull();
  });

  it('grava e apaga propriedade, levando junto o objeto que ficou vazio', () => {
    expect(setIn({ type: 'x' }, 'accent.field', 'status')).toEqual({ type: 'x', accent: { field: 'status' } });
    expect(setIn({ type: 'x', accent: { field: 'status' } }, 'accent.field', undefined)).toEqual({ type: 'x' });
    expect(getIn({ accent: { field: 'status' } }, 'accent.field')).toBe('status');
  });

  it('atualiza a propriedade de um nó aninhado', () => {
    const next = updateNode(body(), [1, 1, 0], 'size', 'lg');
    expect(nodeAt(next, [1, 1, 0])).toEqual({ type: 'title', size: 'lg' });
    expect(nodeAt(updateNode(next, [1, 1, 0], 'size', undefined), [1, 1, 0])).toEqual({ type: 'title' });
  });

  it('duplica como cópia profunda, logo depois do original', () => {
    const edit = duplicateNode(body(), [1]);
    expect(edit?.path).toEqual([2]);
    const copy = nodeAt(edit?.body ?? [], [2]) as { children: unknown[] };
    const original = nodeAt(edit?.body ?? [], [1]) as { children: unknown[] };
    expect(copy).toEqual(original);
    expect(copy.children).not.toBe(original.children);
  });

  it('envolve num contêiner e desfaz o contêiner', () => {
    const wrapped = wrapNode(body(), [0], { type: 'row', gap: 'sm' });
    expect(nodeAt(wrapped?.body ?? [], [0])).toEqual({ type: 'row', gap: 'sm', children: [{ type: 'actions' }] });
    const unwrapped = unwrapNode(body(), [1]);
    expect((unwrapped?.body ?? []).map((node) => (node as { type: string }).type)).toEqual(['actions', 'avatar', 'stack', 'tags']);
  });

  it('conta todos os nós, contêineres incluídos', () => {
    expect(countNodes(body())).toBe(7);
  });

  it('mede os níveis de contêiner e confere a profundidade de destino', () => {
    const row = nodeAt(body(), [1]);
    expect(containerHeight(row, isContainer)).toBe(2);
    expect(containerHeight({ type: 'title' }, isContainer)).toBe(0);
    const limits = { isContainer, rootDepth: 2, maxDepth: 6 };
    expect(fitsDepth(row, [0, 0], limits)).toBe(true);
    expect(fitsDepth(row, [0, 0, 0, 0], limits)).toBe(false);
    expect(fitsDepth({ type: 'title' }, [0, 0, 0, 0, 0, 0, 0], limits)).toBe(true);
  });

  it('traduz o caminho do problema para o nó e a propriedade', () => {
    expect(issueTarget('cardTemplate.body[1].children[0].field', 'cardTemplate', 'body'))
      .toEqual({ scope: 'node', path: [1, 0], property: 'field' });
    expect(issueTarget('cardTemplate.body[2]', 'cardTemplate', 'body')).toEqual({ scope: 'node', path: [2], property: null });
    expect(issueTarget('cardTemplate.accent.field', 'cardTemplate', 'body')).toEqual({ scope: 'root', property: 'accent.field' });
    expect(issueTarget('cardTemplate', 'cardTemplate', 'body')).toEqual({ scope: 'global' });
    expect(issueTarget('cardTemplate.body', 'cardTemplate', 'body')).toEqual({ scope: 'global' });
  });
});
