// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/aggregationSpec.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { evaluateFieldBoolean } from './fieldExpression';
import type { AggregationOp, FieldAggregation } from './fieldRules';
import { resolveWritableTable } from './mutationSpec';
import type { SchemaContext } from './pathResolver';
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
export const applyAggregationOp = (op: AggregationOp, values: unknown[]): number | null => {
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
 * Agrega os filhos já carregados. O `filter` é avaliado sobre o escopo plano de cada filho —
 * expressão inválida reprova o filho (evaluateFieldBoolean devolve false em erro), o que mantém o
 * agregado conservador em vez de contar o que não deveria.
 */
export const aggregateChildren = (
  ctx: SchemaContext,
  aggregation: FieldAggregation,
  childTable: string,
  children: Record<string, unknown>[],
): number | null => {
  const filter = aggregation.filter?.trim();

  const selected = filter
    ? children.filter((child) => {
        const scope = buildRecordFieldScope(ctx, childTable, child);
        return evaluateFieldBoolean(filter, { value: null, data: scope });
      })
    : children;

  if (aggregation.op === 'count') return selected.length;

  const fieldKey = aggregation.field?.trim();
  if (!fieldKey) return null;

  return applyAggregationOp(
    aggregation.op,
    selected.map((child) => buildRecordFieldScope(ctx, childTable, child)[fieldKey]),
  );
};
