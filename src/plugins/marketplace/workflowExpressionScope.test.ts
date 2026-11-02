import { describe, expect, it } from 'vitest';
import { MARKETPLACE_CATALOG } from './catalog';
import { TRAVELLING_EXAMPLES } from './travellingExamples';
import { extractFieldExpressionDependencies } from '../../domain/schema/fieldExpression';
import type { MarketplacePlugin } from '../../domain/entities/MarketplacePlugin';
import type { Condition, WorkflowStep } from '../../domain/entities/Workflow';

/**
 * As automações que viajam nas NOSSAS extensões são lidas como molde. O escopo de uma expressão de
 * fluxo é `event`, `input`, `output`, `actor` e as variáveis do fluxo; um nome fora disso não existe
 * ali, e o motor o trata como erro: na condição do fluxo, a condição conta como falsa e o fluxo é
 * pulado; num passo, o passo falha. Os dois rodam sem aviso no lugar onde se erra.
 *
 * Foi assim com `steps.normalize.code` no `consumer-example` (a saída de um passo é
 * `output.<id do passo>`) e com `recordId.status` no plano de um botão (o parâmetro é `event.recordId`).
 */
const PLUGINS: MarketplacePlugin[] = [...MARKETPLACE_CATALOG, ...TRAVELLING_EXAMPLES];

const CONDITION_ROOTS = new Set(['event', 'actor']);

const allSteps = (steps: WorkflowStep[]): WorkflowStep[] =>
  steps.flatMap((step) => [
    step,
    ...allSteps(step.branches?.whenTrue ?? []),
    ...allSteps(step.branches?.whenFalse ?? []),
    ...allSteps(step.loop?.body ?? []),
  ]);

const conditionExpressions = (condition: Condition | undefined): string[] => {
  if (!condition) return [];
  if (condition.kind === 'Expression') return [condition.expression];
  if (condition.kind === 'LogicalAnd' || condition.kind === 'LogicalOr') {
    return condition.conditions.flatMap(conditionExpressions);
  }
  if (condition.kind === 'Not') return conditionExpressions(condition.condition);
  return [];
};

const nestedExpressions = (value: unknown): string[] => {
  if (Array.isArray(value)) return value.flatMap(nestedExpressions);
  if (!value || typeof value !== 'object') return [];
  const candidate = value as Record<string, unknown>;
  if (candidate.kind === 'Expression' && typeof candidate.expression === 'string') return [candidate.expression];
  return Object.values(candidate).flatMap(nestedExpressions);
};

const workflowsOf = (plugin: MarketplacePlugin) =>
  (plugin.workflows ?? []).map((workflow) => ({ plugin: plugin.manifest.id, workflow }));

describe('expressões das automações que viajam', () => {
  it.each(PLUGINS.flatMap(workflowsOf).map((one) => [`${one.plugin} / ${one.workflow.templateId}`, one.workflow] as const))(
    '%s: a condição do fluxo só lê `event` e `actor`',
    (_name, workflow) => {
      for (const expression of conditionExpressions(workflow.condition)) {
        const foreign = extractFieldExpressionDependencies(expression).filter((root) => !CONDITION_ROOTS.has(root));
        expect(foreign, expression).toStrictEqual([]);
      }
    },
  );

  it.each(PLUGINS.flatMap(workflowsOf).map((one) => [`${one.plugin} / ${one.workflow.templateId}`, one.workflow] as const))(
    '%s: nenhum passo lê a raiz `steps`, que não existe',
    (_name, workflow) => {
      const expressions = allSteps(workflow.steps ?? []).flatMap((step) => [
        ...nestedExpressions(step.configuration),
        ...conditionExpressions(step.condition),
      ]);
      for (const expression of expressions) {
        expect(extractFieldExpressionDependencies(expression), expression).not.toContain('steps');
      }
    },
  );
});
