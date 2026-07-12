// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordRules.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../entities/entitySchemas';
import type { NativeFieldSpec } from './entityRegistry';
import type { FieldRules, RuleIssue } from './fieldRules';
import { formatAndValidate } from './fieldRules';
import { flattenDataLeaves, resolveWritableTable, setValueAtPath } from './mutationSpec';
import type { SchemaContext } from './pathResolver';
import { CUSTOM_VALUES_KEY } from './pathResolver';

export interface ResolvedFieldRules {
  rules: FieldRules;
  label: string;
}

const findNativeFieldRules = (
  fields: NativeFieldSpec[],
  parts: string[],
): ResolvedFieldRules | undefined => {
  const [head, ...rest] = parts;
  const field = fields.find((candidate) => candidate.key === head);
  if (!field) return undefined;

  if (rest.length > 0) {
    return field.objectFields ? findNativeFieldRules(field.objectFields, rest) : undefined;
  }

  return field.rules ? { rules: field.rules, label: field.label } : undefined;
};

const findCustomFieldRules = (
  fields: FieldDefinition[] | undefined,
  key: string,
): ResolvedFieldRules | undefined => {
  const field = fields?.find((candidate) => candidate.key === key);
  if (!field?.rules) return undefined;
  return { rules: field.rules, label: field.label };
};

export const resolveFieldRules = (
  ctx: SchemaContext,
  table: string,
  path: string,
): ResolvedFieldRules | undefined => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return undefined;

  const resolved = outcome.value;
  const parts = path.split('.').filter(Boolean);
  if (parts.length === 0) return undefined;

  if (resolved.kind === 'custom') {
    if (parts[0] !== 'values' || parts.length !== 2) return undefined;
    return findCustomFieldRules(ctx.screens.get(resolved.screenKey ?? '')?.fields, parts[1]);
  }

  const entity = resolved.entityKey ? ctx.registry[resolved.entityKey] : undefined;
  if (!entity) return undefined;

  if (parts[0] === CUSTOM_VALUES_KEY) {
    if (!entity.supportsCustomFields || parts.length !== 2) return undefined;
    return findCustomFieldRules(ctx.screens.get(entity.collection)?.fields, parts[1]);
  }

  return findNativeFieldRules(entity.fields, parts);
};

export interface RecordRulesOutcome {
  data: Record<string, unknown>;
  issues: RuleIssue[];
}

/**
 * Aplica `format` e `validate` a cada folha PRESENTE em `data` que tenha regra declarada
 * (campo nativo, campo de objeto aninhado, ou campo dinâmico sob customValues/values).
 * Folhas sem regra passam intactas; valores vazios nunca reprovam (obrigatoriedade é `required`).
 */
export interface RecordRulesOptions {
  // Caminhos cuja regra de schema deve ser ignorada — usado pelo Step "Validar Objeto", onde as
  // regras declaradas nos parâmetros SOBREPÕEM as da entidade.
  skipPaths?: ReadonlySet<string>;
}

export const formatAndValidateRecord = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
  options: RecordRulesOptions = {},
): RecordRulesOutcome => {
  const next: Record<string, unknown> = {};
  const issues: RuleIssue[] = [];

  for (const leaf of flattenDataLeaves(data)) {
    const skipped = options.skipPaths?.has(leaf.path.split('.')[0]);
    const resolved = skipped ? undefined : resolveFieldRules(ctx, table, leaf.path);
    if (!resolved) {
      setValueAtPath(next, leaf.path, leaf.value);
      continue;
    }

    const outcome = formatAndValidate(leaf.value, resolved.rules, leaf.path, resolved.label);
    setValueAtPath(next, leaf.path, outcome.value);
    if (outcome.issue) issues.push(outcome.issue);
  }

  return { data: next, issues };
};
