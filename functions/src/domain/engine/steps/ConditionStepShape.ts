import type { Condition } from '../../entities/Workflow';

/**
 * Contrato de dados para um futuro ConditionStep (branching condicional dentro do workflow,
 * distinto da Condition de nível de WorkflowDefinition). Nunca registrado no StepRegistry
 * nesta versão — apenas o shape existe, para provar a extensibilidade do motor.
 */
export interface ConditionStepShape {
  condition: Condition;
  onTrueStepId?: string;
  onFalseStepId?: string;
}
