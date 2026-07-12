// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/parameterRules.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowParameter } from '../entities/Workflow';
import type { RuleIssue } from './fieldRules';
import { formatAndValidate } from './fieldRules';

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

  for (const parameter of parameters) {
    if (!(parameter.key in next)) continue;
    const path = prefix ? `${prefix}.${parameter.key}` : parameter.key;
    const value = next[parameter.key];

    if (parameter.type === 'Object') {
      if (!isPlainObject(value)) continue;
      const nested = formatAndValidateParameters(parameter.fields, value, path);
      next[parameter.key] = nested.data;
      issues.push(...nested.issues);
      continue;
    }

    const outcome = formatAndValidate(value, parameter.rules, path, parameter.label || parameter.key);
    next[parameter.key] = outcome.value;
    if (outcome.issue) issues.push(outcome.issue);
  }

  return { data: next, issues };
};
