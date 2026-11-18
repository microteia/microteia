// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/ui/listOrder.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { QueryOrderBy } from '../querySpec';
import { deterministicRecordOrder } from '../recordOrder';

/**
 * A ordem DECLARADA da listagem de uma tela (`ScreenDefinition.listOrder`): a mesma lista de chaves do
 * `latest` da agregação, aplicada à lista da tela e à aba que ela vira dentro do pai.
 *
 * A ordem é feita EM MEMÓRIA, sobre os registros já trazidos, e nunca vai ao Firestore. A aba do pai
 * consulta os filhos por igualdade no vínculo, e igualdade com ordenação por outro campo pede um índice
 * composto por tela — que uma tela criada em tempo de execução não tem como declarar. E uma ordenação
 * no servidor EXCLUI o documento sem o campo, quando aqui ele só vai para o fim.
 */

/** O primeiro kernel que ordena pela declaração. Um anterior ignora a chave e mostra os mais recentes. */
export const LIST_ORDER_SINCE_KERNEL = '2.137.0';

/** Três chaves bastam para decidir e desempatar duas vezes; mais que isso é uma ordem que ninguém lê. */
export const LIST_ORDER_MAX_KEYS = 3;

/**
 * Os tipos de campo que ordenam pelo que a pessoa vê. `select` e `reference` ficam de fora: gravam a
 * chave da opção e o id do registro, e ordenar por eles poria a lista numa ordem que nenhum rótulo
 * explica. `checkbox` também, porque um booleano não se compara (`compareValues`) e empataria sempre.
 */
export const LIST_ORDER_FIELD_TYPES: readonly string[] = ['text', 'masked', 'number', 'currency', 'date', 'time'];

/** Os carimbos do registro que toda tela tem, sem campo declarado. */
export const LIST_ORDER_RECORD_PATHS: readonly string[] = ['createdAt', 'updatedAt'];

export const LIST_ORDER_DIRECTIONS: readonly QueryOrderBy['dir'][] = ['asc', 'desc'];

export interface ListOrderFieldInfo {
  key: string;
  type: string;
  multi?: boolean | null;
}

/** Um problema da declaração, já como frase do catálogo. */
export interface ListOrderIssue {
  message: string;
  messageParams: Record<string, string>;
}

/** As frases de cada problema — literais, para que `verify-messages` confira que existem. */
const ISSUE_KEYS = {
  'not-list': '@core.records/list-order.issue.not-list',
  'too-many': '@core.records/list-order.issue.too-many',
  'key-shape': '@core.records/list-order.issue.key-shape',
  'direction': '@core.records/list-order.issue.direction',
  'field-unknown': '@core.records/list-order.issue.field-unknown',
  'field-type': '@core.records/list-order.issue.field-type',
  'duplicate': '@core.records/list-order.issue.duplicate',
} as const;

type IssueCode = keyof typeof ISSUE_KEYS;

const issue = (code: IssueCode, where: string, params: Record<string, string> = {}): ListOrderIssue => ({
  message: ISSUE_KEYS[code],
  messageParams: { where, ...params },
});

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** O campo ordena a lista: tipo de valor único que se compara pelo que se vê. */
export const isListOrderField = (field: ListOrderFieldInfo): boolean =>
  LIST_ORDER_FIELD_TYPES.includes(field.type) && field.multi !== true;

const pathIssue = (path: string, fields: ReadonlyMap<string, ListOrderFieldInfo>, where: string): ListOrderIssue | null => {
  if (LIST_ORDER_RECORD_PATHS.includes(path)) return null;
  const field = fields.get(path);
  if (!field) return issue('field-unknown', where, { field: path });
  return isListOrderField(field)
    ? null
    : issue('field-type', where, { field: path, allowed: LIST_ORDER_FIELD_TYPES.join(', ') });
};

/**
 * O que está ERRADO na declaração, para quem ainda pode corrigir: o Form Design antes de gravar e o
 * `check` do pacote. A leitura (`readListOrder`) é tolerante e nunca recusa — ela serve a lista que já
 * está no ar, onde um campo apagado depois não pode derrubar a tela.
 */
export const listOrderIssues = (
  raw: unknown,
  fields: readonly ListOrderFieldInfo[],
  where = 'listOrder',
): ListOrderIssue[] => {
  if (raw === undefined || raw === null) return [];
  if (!Array.isArray(raw)) return [issue('not-list', where)];

  const byKey = new Map(fields.map((field) => [field.key, field]));
  const issues: ListOrderIssue[] = [];
  if (raw.length > LIST_ORDER_MAX_KEYS) issues.push(issue('too-many', where, { max: String(LIST_ORDER_MAX_KEYS) }));

  const seen = new Set<string>();
  raw.forEach((entry, index) => {
    const at = `${where}[${index}]`;
    if (!isPlainObject(entry) || typeof entry.path !== 'string' || entry.path.trim() === '') {
      issues.push(issue('key-shape', at));
      return;
    }
    const path = entry.path.trim();
    if (!LIST_ORDER_DIRECTIONS.includes(entry.dir as QueryOrderBy['dir'])) {
      issues.push(issue('direction', `${at}.dir`, { value: String(entry.dir), allowed: LIST_ORDER_DIRECTIONS.join(', ') }));
    }
    const problem = pathIssue(path, byKey, `${at}.path`);
    if (problem) issues.push(problem);
    if (seen.has(path)) issues.push(issue('duplicate', `${at}.path`, { field: path }));
    seen.add(path);
  });
  return issues;
};

/**
 * A ordem que a lista aplica: as chaves que a tela ainda consegue responder, sem repetição e até o
 * teto. Um campo apagado, de tipo trocado ou uma direção desconhecida saem da ordem em vez de quebrar
 * a lista — o mesmo destino de um nó desconhecido no cartão declarado.
 */
export const readListOrder = (raw: unknown, fields: readonly ListOrderFieldInfo[]): QueryOrderBy[] => {
  if (!Array.isArray(raw)) return [];
  const byKey = new Map(fields.map((field) => [field.key, field]));
  const order: QueryOrderBy[] = [];
  for (const entry of raw) {
    if (order.length >= LIST_ORDER_MAX_KEYS) break;
    if (!isPlainObject(entry) || typeof entry.path !== 'string') continue;
    const path = entry.path.trim();
    const dir = entry.dir as QueryOrderBy['dir'];
    if (!path || !LIST_ORDER_DIRECTIONS.includes(dir)) continue;
    if (pathIssue(path, byKey, '') || order.some((key) => key.path === path)) continue;
    order.push({ path, dir });
  }
  return order;
};

/**
 * A ordem como pode sair para o convidado do portal: só chaves de campo EXPOSTO, e sem `createdAt`,
 * que a projeção não guarda. A chave de campo retido sai da ordem inteira, e não só do valor — o nome
 * do campo é interno, e ordenar por um valor que o convidado não vê é revelar algo dele pela posição.
 */
export const guestListOrder = (
  raw: unknown,
  fields: readonly ListOrderFieldInfo[],
  exposed: ReadonlySet<string>,
): QueryOrderBy[] => {
  const visible = fields.filter((field) => exposed.has(field.key));
  return readListOrder(raw, visible).filter((key) => key.path !== 'createdAt');
};

const fieldAtRoot = (item: object, path: string): unknown => (item as Record<string, unknown>)[path];

/**
 * O comparador da ordem declarada, ou `undefined` sem chave nenhuma — e então a lista fica como
 * sempre esteve, inclusive paginando. É o MESMO comparador do `latest`: vazio no fim nas duas direções,
 * e o desempate pelo cadastro e pelo id, para que a lista não troque de ordem a cada leitura.
 *
 * `valueOf` lê o campo no registro, que o tem na raiz; a projeção do portal o guarda em `data`.
 */
export const listOrderComparator = <T extends { id: string }>(
  order: readonly QueryOrderBy[],
  valueOf: (item: T, path: string) => unknown = fieldAtRoot,
): ((left: T, right: T) => number) | undefined =>
  order.length === 0 ? undefined : deterministicRecordOrder<T>(order, valueOf, (item) => item.id);
