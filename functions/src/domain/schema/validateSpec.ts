// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/validateSpec.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/validateSpec.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { WorkflowParameter } from '../entities/Workflow';
import type { RuleIssue } from './fieldRules';
import { collectRequiredIssues, formatAndValidateParameters } from './parameterRules';
import type { SchemaContext } from './pathResolver';
import { formatAndValidateRecord } from './recordRules';

export interface ValidateStepConfig {
  source: 'input' | 'event';
  property?: string;
  entityType?: string;
  outputName: string;
  parameters?: WorkflowParameter[];
}

export interface ValidateObjectOutcome {
  value: Record<string, unknown>;
  issues: RuleIssue[];
}

const pickParameterKeys = (
  parameters: WorkflowParameter[],
  data: Record<string, unknown>,
): Record<string, unknown> => {
  const picked: Record<string, unknown> = {};
  for (const parameter of parameters) {
    if (parameter.key in data) picked[parameter.key] = data[parameter.key];
  }
  return picked;
};

/**
 * Semântica do Step "Validar Objeto":
 * - só `entityType`  → valida contra o schema da entidade; a saída é o objeto inteiro.
 * - `entityType` + `parameters` → a saída continua sendo a entidade, mas as regras declaradas
 *   nos parâmetros SOBREPÕEM as do schema para as chaves que elas cobrem.
 * - só `parameters`  → a saída é um objeto anônimo formado apenas pelas chaves declaradas.
 */
export const validateObject = (
  ctx: SchemaContext,
  config: ValidateStepConfig,
  raw: Record<string, unknown>,
): ValidateObjectOutcome => {
  const parameters = config.parameters ?? [];
  const hasParameters = parameters.length > 0;
  const overriddenKeys = new Set(parameters.map((parameter) => parameter.key));

  let value: Record<string, unknown> = raw;
  const issues: RuleIssue[] = [];

  if (config.entityType) {
    const record = formatAndValidateRecord(ctx, config.entityType, value, {
      skipPaths: hasParameters ? overriddenKeys : undefined,
      skipCompute: true,
    });
    value = record.data;
    issues.push(...record.issues);
  } else if (hasParameters) {
    value = pickParameterKeys(parameters, value);
  }

  if (hasParameters) {
    issues.push(...collectRequiredIssues(parameters, value));
    const applied = formatAndValidateParameters(parameters, value, '', ctx.fieldRulePresets);
    value = applied.data;
    issues.push(...applied.issues);
  }

  return { value, issues };
};
