// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/aggregationSpec.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../entities/entitySchemas';
import { evaluateFieldBoolean } from './fieldExpression';
import type { AggregationOp, FieldAggregation, NumericAggregationOp } from './fieldRules';
import { resolveWritableTable } from './mutationSpec';
import type { SchemaContext } from './pathResolver';
import { compareValues } from './predicateMatch';
import type { QueryOrderBy } from './querySpec';
import { buildRecordFieldScope } from './recordRules';

export interface AggregationTarget {
  // Tabela do registro PAI, que recebe o valor agregado.
  parentTable: string;
  // Caminho onde gravar no pai — a própria chave do campo, na raiz do documento.
  parentPath: string;
  fieldKey: string;
  label: string;
  aggregation: FieldAggregation;
}

/** O agregado é gravado no próprio campo, como qualquer outro. */
const parentPathFor = (ctx: SchemaContext, table: string, fieldKey: string): string | null => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return null;
  return fieldKey;
};

/**
 * Todos os campos (de qualquer tela do tenant) que agregam sobre `childTable`. É o índice invertido
 * que o motor usa ao ver um filho mudar: dependência declarada, não inferida.
 */
export const collectAggregationsFor = (
  ctx: SchemaContext,
  childTable: string,
): AggregationTarget[] => {
  const targets: AggregationTarget[] = [];

  for (const screen of ctx.screens.values()) {
    for (const field of screen.fields) {
      const aggregation = field.aggregation;
      if (!aggregation || aggregation.from !== childTable || !aggregation.via) continue;

      const parentPath = parentPathFor(ctx, screen.id, field.key);
      if (!parentPath) continue;

      targets.push({
        parentTable: screen.id,
        parentPath,
        fieldKey: field.key,
        label: field.label,
        aggregation,
      });
    }
  }

  return targets;
};

/**
 * Detecta se declarar `from` no campo de `parentTable` fecha um ciclo entre telas — A agrega de B
 * que agrega de A. O motor pararia sozinho (o recompute é idempotente), mas o ciclo nunca convergiria
 * para um valor estável, então é recusado na autoria.
 */
export const aggregationCreatesCycle = (
  ctx: SchemaContext,
  parentTable: string,
  from: string,
): boolean => {
  const visited = new Set<string>();

  const reaches = (table: string): boolean => {
    if (table === parentTable) return true;
    if (visited.has(table)) return false;
    visited.add(table);

    const screen = ctx.screens.get(table);
    for (const field of screen?.fields ?? []) {
      const next = field.aggregation?.from;
      if (next && reaches(next)) return true;
    }
    return false;
  };

  return reaches(from);
};

/** Lê no filho um campo pela chave. */
export const readChildField = (
  ctx: SchemaContext,
  childTable: string,
  child: Record<string, unknown>,
  fieldKey: string,
): unknown => buildRecordFieldScope(ctx, childTable, child)[fieldKey];

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
};

/**
 * Aplica a operação sobre os valores já extraídos. `count` conta registros; as demais ignoram os
 * valores não numéricos. Sem nenhum valor válido: `sum`/`count` devolvem 0 (agregado vazio é zero),
 * `avg`/`min`/`max` devolvem null (não existe média de nada).
 *
 * Um valor que É uma lista entra pelos ITENS dele. O caminho que atravessa uma referência de vários
 * colhe um número por apontado, e `Number([10, 20])` não é 30: é `NaN`, que sairia na filtragem e
 * devolveria uma soma de zero com a mesma cara de um total legítimo.
 */
export const applyAggregationOp = (op: NumericAggregationOp, values: unknown[]): number | null => {
  if (op === 'count') return values.length;

  const numbers = values
    .flatMap((value) => (Array.isArray(value) ? value : [value]))
    .map(toNumber)
    .filter((value): value is number => value !== null);
  if (numbers.length === 0) return op === 'sum' ? 0 : null;

  switch (op) {
    case 'sum':
      return numbers.reduce((total, value) => total + value, 0);
    case 'avg':
      return numbers.reduce((total, value) => total + value, 0) / numbers.length;
    case 'min':
      return Math.min(...numbers);
    case 'max':
      return Math.max(...numbers);
    default:
      return null;
  }
};

/**
 * A partir de qual `KERNEL_VERSION` cada operação existe. Um kernel anterior não conhece a operação e
 * a trataria como nenhuma — o campo ficaria vazio sem ninguém dizer por quê. Por isso o pacote que a
 * usa tem de declarar um `kernel` que exclua os anteriores: aí o kernel antigo RECUSA a instalação
 * pelo intervalo, que é a recusa que ele já sabe fazer.
 */
export const AGGREGATION_OP_SINCE_KERNEL: Partial<Record<AggregationOp, string>> = {
  latest: '2.23.0',
};

/** Um filho como o motor o lê: o id do documento ao lado dos dados, para o desempate final. */
export interface AggregationChild {
  id: string;
  data: Record<string, unknown>;
}

/**
 * Campos de sistema que todo registro tem e por isso podem ordenar um `latest` sem serem declarados
 * na tela do filho — "o último contato" é, muitas vezes, só o último registrado.
 */
export const AGGREGATION_ORDER_SYSTEM_KEYS: readonly string[] = ['createdAt', 'updatedAt'];

const isEmptyOrderValue = (value: unknown): boolean =>
  value === null
  || value === undefined
  || (typeof value === 'string' && value.trim() === '')
  || (Array.isArray(value) && value.length === 0);

/** O carimbo do Firestore chega como `Timestamp`; ordená-lo é ordenar o instante dele. */
const asComparable = (value: unknown): unknown => {
  if (value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate();
  }
  return value;
};

/**
 * Ordem entre dois valores de uma chave do `orderBy`, já na direção pedida. Vazio vai para o FIM nas
 * duas direções — um filho sem data não é nem o mais antigo nem o mais recente, e deixá-lo vencer um
 * `asc` faria o "primeiro" ser justamente o registro incompleto. Valores incomparáveis empatam e
 * passam para a chave seguinte.
 */
const compareOrderValue = (left: unknown, right: unknown, dir: QueryOrderBy['dir']): number => {
  const leftEmpty = isEmptyOrderValue(left);
  const rightEmpty = isEmptyOrderValue(right);
  if (leftEmpty || rightEmpty) return leftEmpty === rightEmpty ? 0 : leftEmpty ? 1 : -1;
  const order = compareValues(asComparable(left), asComparable(right)) ?? 0;
  return dir === 'desc' ? -order : order;
};

const compareIds = (left: string, right: string): number => (left < right ? -1 : left > right ? 1 : 0);

/**
 * Ordena os filhos para o `latest`. O desempate é FIXO, para que o valor não mude de uma recomputação
 * para a outra só porque o banco devolveu os irmãos em outra ordem: depois das chaves declaradas vem
 * o `createdAt`, na direção da ÚLTIMA chave (o mais recente registrado vence um `desc`, o mais antigo
 * vence um `asc`), e por fim o id do documento, crescente — que é único.
 */
export const sortChildrenForLatest = (
  ctx: SchemaContext,
  childTable: string,
  orderBy: readonly QueryOrderBy[],
  children: readonly AggregationChild[],
): AggregationChild[] => {
  const tieDir = orderBy[orderBy.length - 1]?.dir ?? 'desc';
  const keyed = children.map((child) => ({
    child,
    scope: buildRecordFieldScope(ctx, childTable, child.data),
  }));
  keyed.sort((left, right) => {
    for (const order of orderBy) {
      const result = compareOrderValue(left.scope[order.path], right.scope[order.path], order.dir);
      if (result !== 0) return result;
    }
    const created = compareOrderValue(left.scope.createdAt, right.scope.createdAt, tieDir);
    if (created !== 0) return created;
    return compareIds(left.child.id, right.child.id);
  });
  return keyed.map((entry) => entry.child);
};

const passesFilter = (
  ctx: SchemaContext,
  childTable: string,
  filter: string | undefined,
  data: Record<string, unknown>,
): boolean => {
  if (!filter) return true;
  return evaluateFieldBoolean(filter, { value: null, data: buildRecordFieldScope(ctx, childTable, data) });
};

/**
 * O `field` do primeiro filho que passa no `filter`, depois de ordenado por `orderBy`, copiado como
 * está: chave de opção continua chave, data continua `YYYY-MM-DD`, id continua id. Nenhum filho
 * passa: `null` — o pai volta a vazio, nunca fica com o último valor que teve.
 */
export const latestChildValue = (
  ctx: SchemaContext,
  aggregation: FieldAggregation,
  childTable: string,
  children: readonly AggregationChild[],
): unknown => {
  const fieldKey = aggregation.field?.trim();
  const orderBy = aggregation.orderBy ?? [];
  if (!fieldKey || orderBy.length === 0) return null;

  const filter = aggregation.filter?.trim();
  const selected = children.filter((child) => passesFilter(ctx, childTable, filter, child.data));
  const [first] = sortChildrenForLatest(ctx, childTable, orderBy, selected);
  if (!first) return null;

  const value = buildRecordFieldScope(ctx, childTable, first.data)[fieldKey];
  return value === undefined ? null : value;
};

/**
 * Agrega os filhos já carregados. O `filter` é avaliado sobre o escopo plano de cada filho —
 * expressão inválida reprova o filho (evaluateFieldBoolean devolve false em erro), o que mantém o
 * agregado conservador em vez de contar o que não deveria.

 */
export const aggregateChildren = (
  ctx: SchemaContext,
  aggregation: FieldAggregation,
  childTable: string,
  children: readonly AggregationChild[],
): unknown => {
  if (aggregation.op === 'latest') return latestChildValue(ctx, aggregation, childTable, children);

  const filter = aggregation.filter?.trim();
  const selected = children.filter((child) => passesFilter(ctx, childTable, filter, child.data));

  if (aggregation.op === 'count') return selected.length;

  const fieldKey = aggregation.field?.trim();
  if (!fieldKey) return null;

  return applyAggregationOp(
    aggregation.op,
    selected.map((child) => buildRecordFieldScope(ctx, childTable, child.data)[fieldKey]),
  );
};

// ─── Validação da declaração ──────────────────────────────────────────────────

/** O que a validação precisa saber de um campo — do pai ou do filho. */
export type AggregationFieldShape = Pick<FieldDefinition, 'key' | 'type'>
  & Partial<Pick<FieldDefinition, 'multi' | 'lookupCollection' | 'refEntity'>>;

export type AggregationIssueCode =
  | 'latest-field'
  | 'latest-order'
  | 'order-not-latest'
  | 'order-dir'
  | 'unknown-order'
  | 'unknown-field'
  | 'type-mismatch';

/**
 * Uma recusa da declaração. `message` é REFERÊNCIA de mensagem: a validação roda sem idioma. `code`
 * é para quem fala outra língua que não o catálogo — o modelo de domínio do SDK, que escreve a
 * própria frase para o agente. O campo do filho vai em `childField`, nunca em `field`: o portão do
 * pacote embute esta frase numa que já usa `{field}` para o campo do PAI, com os mesmos parâmetros.
 */
export interface AggregationIssue {
  code: AggregationIssueCode;
  message: string;
  messageParams?: Record<string, string>;
}

const AGGREGATION_ISSUE_MESSAGES: Record<AggregationIssueCode, string> = {
  'latest-field': '@core.records/aggregation.issue.latest-field',
  'latest-order': '@core.records/aggregation.issue.latest-order',
  'order-not-latest': '@core.records/aggregation.issue.order-not-latest',
  'order-dir': '@core.records/aggregation.issue.order-dir',
  'unknown-order': '@core.records/aggregation.issue.unknown-order',
  'unknown-field': '@core.records/aggregation.issue.unknown-field',
  'type-mismatch': '@core.records/aggregation.issue.type-mismatch',
};

const issue = (code: AggregationIssueCode, messageParams?: Record<string, string>): AggregationIssue => ({
  code,
  message: AGGREGATION_ISSUE_MESSAGES[code],
  ...(messageParams ? { messageParams } : {}),
});

/**
 * O valor do filho cabe no campo do pai? `latest` COPIA, então os dois têm de gravar a mesma forma:
 * o mesmo tipo, a mesma lista de opções, a mesma entidade apontada, a mesma cardinalidade. Uma
 * chave de opção de uma lista gravada num campo de outra lista é um valor que nenhuma opção explica.
 */
export const aggregationTypesCompatible = (
  parent: AggregationFieldShape,
  child: AggregationFieldShape,
): boolean =>
  parent.type === child.type
  && (parent.multi === true) === (child.multi === true)
  && (parent.lookupCollection ?? '') === (child.lookupCollection ?? '')
  && (parent.type !== 'reference' || (parent.refEntity ?? '') === (child.refEntity ?? ''));

/**
 * A forma da declaração, conferida onde ela é escrita — o Form Design, o portão do pacote e o
 * modelo de domínio do SDK perguntam aqui, para que as três recusas digam a mesma coisa.
 *
 * `childFields` ausente é "não sei quais são os campos do filho" (a tela dele mora em outra
 * extensão): confere-se só o que não depende deles. Uma lista, mesmo vazia, é a tela conhecida.
 */
export const fieldAggregationIssues = (
  aggregation: FieldAggregation,
  parent: AggregationFieldShape,
  childFields?: readonly AggregationFieldShape[] | null,
): AggregationIssue[] => {
  const issues: AggregationIssue[] = [];
  const orderBy = aggregation.orderBy ?? [];
  const fieldKey = aggregation.field?.trim() ?? '';

  if (aggregation.op !== 'latest') {
    if (orderBy.length > 0) issues.push(issue('order-not-latest', { op: aggregation.op }));
    return issues;
  }

  if (!fieldKey) issues.push(issue('latest-field'));
  if (orderBy.length === 0) issues.push(issue('latest-order'));
  for (const order of orderBy) {
    if (order.dir !== 'asc' && order.dir !== 'desc') {
      issues.push(issue('order-dir', { path: String(order.path ?? ''), dir: String(order.dir ?? '') }));
    }
  }

  if (!childFields) return issues;
  const byKey = new Map(childFields.map((field) => [field.key, field]));

  for (const order of orderBy) {
    const path = String(order.path ?? '').trim();
    if (!byKey.has(path) && !AGGREGATION_ORDER_SYSTEM_KEYS.includes(path)) {
      issues.push(issue('unknown-order', { path }));
    }
  }

  if (!fieldKey) return issues;
  const child = byKey.get(fieldKey);
  if (!child) {
    issues.push(issue('unknown-field', { childField: fieldKey }));
  } else if (!aggregationTypesCompatible(parent, child)) {
    issues.push(issue('type-mismatch', {
      childField: fieldKey,
      parentType: parent.type,
      childType: child.type,
    }));
  }
  return issues;
};
