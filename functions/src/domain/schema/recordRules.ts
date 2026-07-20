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
import {
  evaluateFieldExpression,
  evaluateFieldValidation,
  extractFieldExpressionDependencies,
} from './fieldExpression';
import type { FieldLogic, FieldRules, RuleIssue } from './fieldRules';
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

export type FieldLogicSlot = 'validate' | 'compute';

export interface FieldLogicTarget {
  key: string;
  path: string;
  label: string;
  expr: string;
  dependencies: string[];
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

const readLogicSlot = (
  logic: FieldLogic | null | undefined,
  slot: FieldLogicSlot,
): string | undefined => {
  const expr = slot === 'validate' ? logic?.validate : logic?.compute;
  return expr && expr.trim() ? expr : undefined;
};

export const collectFieldLogicTargets = (
  ctx: SchemaContext,
  table: string,
  slot: FieldLogicSlot,
): FieldLogicTarget[] => {
  const outcome = resolveWritableTable(table, ctx);
  if (!outcome.ok || outcome.value.kind === 'lookup') return [];

  const resolved = outcome.value;
  const targets: FieldLogicTarget[] = [];

  const push = (
    field: { key: string; label: string; logic?: FieldLogic | null },
    path: string,
  ): void => {
    const expr = readLogicSlot(field.logic, slot);
    if (!expr) return;
    targets.push({
      key: field.key,
      path,
      label: field.label,
      expr,
      dependencies: extractFieldExpressionDependencies(expr),
    });
  };

  const pushCustomFields = (fields: FieldDefinition[] | undefined, prefix: string): void => {
    for (const field of fields ?? []) push(field, `${prefix}.${field.key}`);
  };

  if (resolved.kind === 'custom') {
    pushCustomFields(ctx.screens.get(resolved.screenKey ?? '')?.fields, 'values');
    return targets;
  }

  const entity = resolved.entityKey ? ctx.registry[resolved.entityKey] : undefined;
  if (!entity) return targets;

  for (const field of entity.fields) push(field, field.key);
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
  const targets = collectFieldLogicTargets(ctx, table, 'validate');
  if (targets.length === 0) return [];

  const scope = buildRecordFieldScope(ctx, table, data);
  const issues: RuleIssue[] = [];
  for (const target of targets) {
    const error = evaluateFieldValidation(target.expr, { value: scope[target.key], data: scope });
    if (error) issues.push({ path: target.path, label: target.label, error });
  }
  return issues;
};

/**
 * Ordena os campos computados de forma que um computado que depende de outro seja avaliado depois
 * dele. Campos envolvidos em ciclo são descartados — a expressão não é avaliada e o valor anterior
 * do campo permanece intacto.
 */
export const orderComputeTargets = (targets: FieldLogicTarget[]): FieldLogicTarget[] => {
  const byKey = new Map(targets.map((target) => [target.key, target]));
  const ordered: FieldLogicTarget[] = [];
  const settled = new Set<string>();
  const visiting = new Set<string>();

  const visit = (target: FieldLogicTarget): boolean => {
    if (settled.has(target.key)) return true;
    if (visiting.has(target.key)) return false;

    visiting.add(target.key);
    for (const dependency of target.dependencies) {
      const upstream = byKey.get(dependency);
      if (upstream && upstream.key !== target.key && !visit(upstream)) {
        visiting.delete(target.key);
        return false;
      }
    }
    visiting.delete(target.key);

    settled.add(target.key);
    ordered.push(target);
    return true;
  };

  for (const target of targets) visit(target);
  return ordered;
};

/**
 * Avalia os alvos na ordem de dependência sobre um escopo plano por chave de campo. Cada resultado
 * entra no escopo antes do próximo alvo, para que um computado enxergue outro. Expressão que lança
 * é ignorada — campo computado nunca bloqueia a gravação.
 */
const evaluateComputeTargets = (
  targets: FieldLogicTarget[],
  scope: Record<string, unknown>,
): Map<string, unknown> => {
  const resolved = new Map<string, unknown>();
  const working = { ...scope };

  for (const target of orderComputeTargets(targets)) {
    try {
      const value = evaluateFieldExpression(target.expr, { value: working[target.key], data: working });
      if (value === undefined) continue;
      working[target.key] = value;
      resolved.set(target.key, value);
    } catch {
      continue;
    }
  }

  return resolved;
};

/**
 * Versão plana, para o formulário: recebe os campos de uma tela e os valores por chave, devolvendo
 * só os computados. É a MESMA avaliação do save, para o que o usuário vê enquanto digita não
 * divergir do que será persistido.
 */
export const computeFieldValues = (
  fields: { key: string; label?: string; logic?: FieldLogic | null }[],
  values: Record<string, unknown>,
): Record<string, unknown> => {
  const targets: FieldLogicTarget[] = [];
  for (const field of fields) {
    const expr = readLogicSlot(field.logic, 'compute');
    if (!expr) continue;
    targets.push({
      key: field.key,
      path: field.key,
      label: field.label ?? field.key,
      expr,
      dependencies: extractFieldExpressionDependencies(expr),
    });
  }
  if (targets.length === 0) return {};

  return Object.fromEntries(evaluateComputeTargets(targets, values));
};

/**
 * Avalia as expressões `logic.compute` e grava o resultado no próprio registro. O escopo parte do
 * `baseline` (registro já existente) sobreposto pelos valores recebidos, para que um payload parcial
 * — típico do Step "Gravar Registro" — não recompute com dependências ausentes.
 */
export const applyComputedFields = (
  ctx: SchemaContext,
  table: string,
  data: Record<string, unknown>,
  baseline?: Record<string, unknown>,
): Record<string, unknown> => {
  const targets = collectFieldLogicTargets(ctx, table, 'compute');
  if (targets.length === 0) return data;

  const scope: Record<string, unknown> = {
    ...(baseline ? buildRecordFieldScope(ctx, table, baseline) : {}),
    ...buildRecordFieldScope(ctx, table, data),
  };

  const resolved = evaluateComputeTargets(targets, scope);
  const next = { ...data };
  for (const target of targets) {
    if (resolved.has(target.key)) setValueAtPath(next, target.path, resolved.get(target.key));
  }

  return next;
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
  // Registro já existente, usado como base do escopo dos campos computados quando `data` é parcial.
  baseline?: Record<string, unknown>;
  // Desliga a avaliação de `logic.compute` — usado pelo Step "Validar Objeto", que checa um objeto
  // avulso e não um registro que será gravado.
  skipCompute?: boolean;
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

  const computed = options.skipCompute
    ? next
    : applyComputedFields(ctx, table, next, options.baseline);

  issues.push(...evaluateExpressionValidations(ctx, table, computed));

  return { data: computed, issues };
};
