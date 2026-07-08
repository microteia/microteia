import type { WorkflowStep } from '../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../domain/entities/WorkflowStepCatalog';

/**
 * Retorna o nome de exibição de um step, com prioridade:
 * 1. signature (nome customizado fornecido pelo usuário)
 * 2. name (nome padrão do step definition)
 * 3. fallback (ex: stepDefinitionId)
 */
export const getStepDisplayName = (
  step: WorkflowStep,
  definition?: StepDefinitionSummary,
  fallback?: string,
): string => {
  if (step.signature) return step.signature;
  if (step.name) return step.name;
  if (definition?.name) return definition.name;
  return fallback ?? step.stepDefinitionId;
};
