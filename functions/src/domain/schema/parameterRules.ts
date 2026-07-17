// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/parameterRules.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/parameterRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowParameter } from '../entities/Workflow';
import type { RuleIssue } from './fieldRules';
import { formatAndValidate, isEmptyRuleValue } from './fieldRules';

export interface ParameterRulesOutcome {
  data: Record<string, unknown>;
  issues: RuleIssue[];
}

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * Aplica `format` e `validate` de cada parâmetro ao valor correspondente em `data`.
 * Só toca chaves PRESENTES em `data` — obrigatoriedade continua sendo `required`, avaliada
 * em outro lugar. Parâmetros do tipo Object descem recursivamente em `fields`.
 */
export const formatAndValidateParameters = (
  parameters: WorkflowParameter[] | undefined,
  data: Record<string, unknown>,
  prefix = '',
): ParameterRulesOutcome => {
  if (!parameters || parameters.length === 0) return { data, issues: [] };

  const next: Record<string, unknown> = { ...data };
  const issues: RuleIssue[] = [];

  const applyOne = (parameter: WorkflowParameter, value: unknown, path: string): unknown => {
    if (parameter.type === 'Object') {
      if (!isPlainObject(value)) return value;
      const nested = formatAndValidateParameters(parameter.fields, value, path);
      issues.push(...nested.issues);
      return nested.data;
    }
    const outcome = formatAndValidate(value, parameter.rules, path, parameter.label || parameter.key);
    if (outcome.issue) issues.push(outcome.issue);
    return outcome.value;
  };

  for (const parameter of parameters) {
    if (!(parameter.key in next)) continue;
    const path = prefix ? `${prefix}.${parameter.key}` : parameter.key;
    const value = next[parameter.key];

    if (parameter.list) {
      if (!Array.isArray(value)) continue;
      next[parameter.key] = value.map((item, i) => applyOne(parameter, item, `${path}[${i}]`));
      continue;
    }

    next[parameter.key] = applyOne(parameter, value, path);
  }

  return { data: next, issues };
};

/**
 * Verifica a obrigatoriedade (`required`) de cada parâmetro contra `data`. Complementa
 * `formatAndValidateParameters` (que só valida chaves presentes) e deve ser chamada sempre
 * que os parâmetros forem materializados numa execução. Desce recursivamente em `fields`.
 */
export const collectRequiredIssues = (
  parameters: WorkflowParameter[] | undefined,
  data: Record<string, unknown>,
  prefix = '',
): RuleIssue[] => {
  const issues: RuleIssue[] = [];
  for (const parameter of parameters ?? []) {
    const path = prefix ? `${prefix}.${parameter.key}` : parameter.key;
    const label = parameter.label || parameter.key;
    const value = data[parameter.key];

    if (parameter.required && isEmptyRuleValue(value)) {
      issues.push({ path, label, error: `O campo "${label}" é obrigatório` });
      continue;
    }
    if (parameter.type === 'Object' && isPlainObject(value)) {
      issues.push(...collectRequiredIssues(parameter.fields, value, path));
    }
  }
  return issues;
};
