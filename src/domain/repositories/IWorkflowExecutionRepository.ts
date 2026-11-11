import type { WorkflowExecution } from '../entities/Workflow';

export interface IWorkflowExecutionRepository {
  subscribeToWorkflowExecutions(
    tenantId: string,
    workflowDefinitionId: string,
    onUpdate: (executions: WorkflowExecution[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /**
   * Refaz uma execução encerrada: o servidor republica o evento dela com a automação como único alvo.
   * A execução nova aparece na assinatura acima como qualquer outra.
   */
  rerunExecution(tenantId: string, executionId: string): Promise<void>;
}
