import type { WorkflowContext, WorkflowResult } from '../../entities/WorkflowContext';

/**
 * Contrato para um futuro Step programático (código Dart/TypeScript arbitrário, sem
 * configuração via InputDefinition). Nunca registrado no StepRegistry nesta versão.
 */
export interface ScriptStepShape {
  run(context: WorkflowContext): Promise<WorkflowResult>;
}
