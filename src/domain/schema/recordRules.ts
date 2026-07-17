// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../entities/entitySchemas';
import type { NativeFieldSpec } from './entityRegistry';
import { evaluateFieldValidation } from './fieldExpression';
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

interface ExpressionValidationTarget {
  key: string;
  path: string;
  label: string;
  expr: string;
}

/**
 * Escopo plano por chave de campo (nativos e customizados na raiz), usado tanto na avaliação de
 * expressões no back quanto no renderizador do front — para que a mesma expressão funcione dos dois
 * lados referenciando os campos por `key`.
 */
export const buildRecordFieldScope = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return { ...data };

  if (outcome.value.kind === 'custom') {
    const values = data.values;
    return typeof values === 'object' && values !== null ? { ...(values as Record<string, unknown>) } : {};
  }

  const customValues = data[CUSTOM_VALUES_KEY];
  const flatCustom = typeof customValues === 'object' && customValues !== null
    ? (customValues as Record<string, unknown>)
    : {};
  return { ...data, ...flatCustom };
};

const collectExpressionValidationTargets = (
  ctx: SchemaContext,
  table: string,
): ExpressionValidationTarget[] => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return [];

  const resolved = outcome.value;
  const targets: ExpressionValidationTarget[] = [];

  const pushCustomFields = (fields: FieldDefinition[] | undefined, prefix: string): void => {
    for (const field of fields ?? []) {
      if (field.logic?.validate) {
        targets.push({
          key: field.key,
          path: `${prefix}.${field.key}`,
          label: field.label,
          expr: field.logic.validate,
        });
      }
    }
  };

  if (resolved.kind === 'custom') {
    pushCustomFields(ctx.screens.get(resolved.screenKey ?? '')?.fields, 'values');
    return targets;
  }

  const entity = resolved.entityKey ? ctx.registry[resolved.entityKey] : undefined;
  if (!entity) return targets;

  for (const field of entity.fields) {
    if (field.logic?.validate) {
      targets.push({ key: field.key, path: field.key, label: field.label, expr: field.logic.validate });
    }
  }
  if (entity.supportsCustomFields) {
    pushCustomFields(ctx.screens.get(entity.collection)?.fields, CUSTOM_VALUES_KEY);
  }

  return targets;
};

const evaluateExpressionValidations = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
): RuleIssue[] => {
  const targets = collectExpressionValidationTargets(ctx, table);
  if (targets.length === 0) return [];

  const scope = buildRecordFieldScope(ctx, table, data);
  const issues: RuleIssue[] = [];
  for (const target of targets) {
    const error = evaluateFieldValidation(target.expr, { value: scope[target.key], data: scope });
    if (error) issues.push({ path: target.path, label: target.label, error });
  }
  return issues;
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

  issues.push(...evaluateExpressionValidations(ctx, table, next));

  return { data: next, issues };
};
