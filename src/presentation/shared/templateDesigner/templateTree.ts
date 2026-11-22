/**
 * Operações sobre a árvore de um template declarativo (cartão da listagem, e depois os desenhos do
 * portal) — puras, imutáveis e sem React, para o designer visual e para os testes.
 *
 * Trabalham sobre o valor CRU (`unknown`), e não sobre `CardNode`: o designer edita o que está no
 * JSON, inclusive o nó que este kernel não conhece ou que ainda tem defeito. Ler pelo `readCardTemplate`
 * descartaria esse nó — e alternar entre o visual e o JSON apagaria o que a pessoa escreveu.
 *
 * Um nó é endereçado pelo CAMINHO de índices (`[1, 0]` = o primeiro filho do segundo nó do corpo).
 * Todo contêiner guarda os filhos em `children`, nas duas DSLs.
 */

export type TreePath = readonly number[];
export type TemplateNode = Record<string, unknown>;

export const isTemplateObject = (value: unknown): value is TemplateNode =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const pathKey = (path: TreePath): string => path.join('.');

export const parsePathKey = (key: string): TreePath =>
  key === '' ? [] : key.split('.').map((part) => Number(part));

export const samePath = (a: TreePath, b: TreePath): boolean =>
  a.length === b.length && a.every((value, index) => value === b[index]);

/** `path` é `ancestor` ou está dentro dele. */
export const isWithin = (path: TreePath, ancestor: TreePath): boolean =>
  path.length >= ancestor.length && ancestor.every((value, index) => value === path[index]);

export const parentOf = (path: TreePath): TreePath => path.slice(0, -1);

export const childrenOf = (node: unknown): readonly unknown[] | undefined =>
  isTemplateObject(node) && Array.isArray(node.children) ? node.children : undefined;

export const nodeAt = (body: readonly unknown[], path: TreePath): unknown => {
  let list: readonly unknown[] | undefined = body;
  let node: unknown;
  for (const index of path) {
    if (!list || index < 0 || index >= list.length) return undefined;
    node = list[index];
    list = childrenOf(node);
  }
  return node;
};

/** A lista de filhos de `parentPath` — o próprio corpo quando o caminho é vazio. */
export const childListAt = (body: readonly unknown[], parentPath: TreePath): readonly unknown[] | undefined =>
  parentPath.length === 0 ? body : childrenOf(nodeAt(body, parentPath));

/** Reescreve a lista de filhos de `parentPath`, copiando só o caminho até ela. */
const withChildList = (
  body: readonly unknown[],
  parentPath: TreePath,
  change: (list: unknown[]) => unknown[],
): unknown[] => {
  if (parentPath.length === 0) return change([...body]);
  const [head, ...rest] = parentPath;
  return body.map((node, index) => {
    if (index !== head || !isTemplateObject(node)) return node;
    return { ...node, children: withChildList(childrenOf(node) ?? [], rest, change) };
  });
};

const clampIndex = (index: number, length: number): number => Math.max(0, Math.min(index, length));

export interface TreeEdit {
  body: unknown[];
  /** Onde está, depois da edição, o nó que ela tocou. */
  path: TreePath;
}

export const insertNode = (body: readonly unknown[], parentPath: TreePath, index: number, node: unknown): TreeEdit => {
  const length = childListAt(body, parentPath)?.length ?? 0;
  const at = clampIndex(index, length);
  return {
    body: withChildList(body, parentPath, (list) => [...list.slice(0, at), node, ...list.slice(at)]),
    path: [...parentPath, at],
  };
};

export const removeNode = (body: readonly unknown[], path: TreePath): unknown[] => {
  if (path.length === 0) return [...body];
  const index = path[path.length - 1];
  return withChildList(body, parentOf(path), (list) => list.filter((_, position) => position !== index));
};

/**
 * Leva o nó de `from` para a posição `index` dentro de `parentPath` — os dois medidos na árvore ANTES
 * da mudança, que é o que a tela tem na mão quando a pessoa solta. Mover um nó para dentro dele mesmo
 * não existe: devolve `null`.
 */
export const moveNode = (
  body: readonly unknown[],
  from: TreePath,
  parentPath: TreePath,
  index: number,
): TreeEdit | null => {
  if (from.length === 0 || isWithin(parentPath, from)) return null;
  const node = nodeAt(body, from);
  if (node === undefined) return null;
  const fromParent = parentOf(from);
  const fromIndex = from[from.length - 1];

  // Tirar o nó desloca, para trás, os irmãos que vinham depois dele — e o destino pode ser um deles.
  const target = [...parentPath];
  if (isWithin(target, fromParent) && target.length > fromParent.length && target[fromParent.length] > fromIndex) {
    target[fromParent.length] -= 1;
  }
  const targetIndex = samePath(target, fromParent) && index > fromIndex ? index - 1 : index;
  return insertNode(removeNode(body, from), target, targetIndex, node);
};

/**
 * Grava `value` em `key` (com ponto para aninhar: `accent.field`). `undefined` apaga a chave, e o
 * objeto que fica vazio por isso sai junto — o que se grava é só o que foi declarado.
 */
export const setIn = (target: TemplateNode, key: string, value: unknown): TemplateNode => {
  const [head, ...rest] = key.split('.');
  if (rest.length === 0) {
    if (value === undefined) {
      return Object.fromEntries(Object.entries(target).filter(([entry]) => entry !== head));
    }
    return { ...target, [head]: value };
  }
  const inner = setIn(isTemplateObject(target[head]) ? target[head] : {}, rest.join('.'), value);
  return Object.keys(inner).length === 0 ? setIn(target, head, undefined) : { ...target, [head]: inner };
};

export const getIn = (target: unknown, key: string): unknown =>
  key.split('.').reduce<unknown>((current, part) => (isTemplateObject(current) ? current[part] : undefined), target);

export const updateNode = (body: readonly unknown[], path: TreePath, key: string, value: unknown): unknown[] => {
  if (path.length === 0) return [...body];
  const index = path[path.length - 1];
  return withChildList(body, parentOf(path), (list) =>
    list.map((node, position) => (position === index && isTemplateObject(node) ? setIn(node, key, value) : node)));
};

/** Cópia profunda — o duplicado não pode dividir `children` com o original. */
const cloneValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(cloneValue);
  if (isTemplateObject(value)) return Object.fromEntries(Object.entries(value).map(([key, entry]) => [key, cloneValue(entry)]));
  return value;
};

export const duplicateNode = (body: readonly unknown[], path: TreePath): TreeEdit | null => {
  const node = nodeAt(body, path);
  if (node === undefined || path.length === 0) return null;
  return insertNode(body, parentOf(path), path[path.length - 1] + 1, cloneValue(node));
};

/** Põe o nó dentro de um contêiner novo, no mesmo lugar. O caminho devolvido é o do contêiner. */
export const wrapNode = (body: readonly unknown[], path: TreePath, wrapper: TemplateNode): TreeEdit | null => {
  const node = nodeAt(body, path);
  if (node === undefined || path.length === 0) return null;
  const index = path[path.length - 1];
  return {
    body: withChildList(body, parentOf(path), (list) =>
      list.map((entry, position) => (position === index ? { ...wrapper, children: [node] } : entry))),
    path,
  };
};

/** Desfaz o contêiner: os filhos tomam o lugar dele. O caminho devolvido é o do primeiro filho. */
export const unwrapNode = (body: readonly unknown[], path: TreePath): TreeEdit | null => {
  const children = childrenOf(nodeAt(body, path));
  if (!children || path.length === 0) return null;
  const index = path[path.length - 1];
  return {
    body: withChildList(body, parentOf(path), (list) => [...list.slice(0, index), ...children, ...list.slice(index + 1)]),
    path,
  };
};

/** Nós na árvore inteira — contêineres incluídos, como o teto de `CARD_TEMPLATE_MAX_NODES` conta. */
export const countNodes = (list: readonly unknown[]): number =>
  list.reduce<number>((total, node) => total + 1 + countNodes(childrenOf(node) ?? []), 0);

/**
 * Quantos níveis de contêiner há do nó para baixo: 0 numa folha, 1 num contêiner só com folhas.
 * É o que pesa contra a profundidade máxima — a leitura corta o CONTÊINER fundo demais, não a folha.
 */
export const containerHeight = (node: unknown, isContainer: (type: unknown) => boolean): number => {
  if (!isTemplateObject(node) || !isContainer(node.type)) return 0;
  return 1 + Math.max(0, ...(childrenOf(node) ?? []).map((child) => containerHeight(child, isContainer)));
};

export interface PlacementLimits {
  isContainer: (type: unknown) => boolean;
  /** A profundidade de um nó do corpo — 2 no cartão, em que o próprio cartão conta como nível 1. */
  rootDepth: number;
  maxDepth: number;
}

/** O nó cabe sob `parentPath` sem passar da profundidade máxima? */
export const fitsDepth = (node: unknown, parentPath: TreePath, limits: PlacementLimits): boolean => {
  const height = containerHeight(node, limits.isContainer);
  return height === 0 || limits.rootDepth + parentPath.length + height - 1 <= limits.maxDepth;
};

/** O endereço, no designer, de um problema apontado pelo portão de autoria (`where`). */
export type IssueTarget =
  | { scope: 'node'; path: TreePath; property: string | null }
  | { scope: 'root'; property: string }
  | { scope: 'global' };

/**
 * Traduz o `where` do portão (`cardTemplate.body[1].children[0].field`) para o nó e a propriedade
 * que o designer destaca. O que não aponta para um nó nem para uma propriedade do cartão é global.
 */
export const issueTarget = (where: string, root: string, bodyKey: string): IssueTarget => {
  if (!where.startsWith(root)) return { scope: 'global' };
  const rest = where.slice(root.length);
  if (rest === '') return { scope: 'global' };
  const bodyMatch = new RegExp(`^\\.${bodyKey}\\[(\\d+)\\]`).exec(rest);
  if (!bodyMatch) {
    const property = rest.startsWith('.') ? rest.slice(1) : '';
    return property && !property.startsWith(`${bodyKey}`) ? { scope: 'root', property } : { scope: 'global' };
  }
  const path = [Number(bodyMatch[1])];
  let tail = rest.slice(bodyMatch[0].length);
  for (let child = /^\.children\[(\d+)\]/.exec(tail); child; child = /^\.children\[(\d+)\]/.exec(tail)) {
    path.push(Number(child[1]));
    tail = tail.slice(child[0].length);
  }
  return { scope: 'node', path, property: tail.startsWith('.') ? tail.slice(1) : null };
};
