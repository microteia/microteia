import type { WorkflowExecution } from '../entities/Workflow';

export interface IWorkflowExecutionRepository {
  /**
   * `detail` traz o que cada passo recebeu e devolveu — só para quem tem `automation.manage`, que é quem
   * a regra deixa ler (ver `domain/schema/executionHistory.ts`). Sem ele, vêm só os resumos, com
   * `logs` e `outputs` vazios e `detailAvailable` falso.
   */
  subscribeToWorkflowExecutions(
    tenantId: string,
    workflowDefinitionId: string,
    detail: boolean,
    onUpdate: (executions: WorkflowExecution[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /**
   * Refaz uma execução encerrada: o servidor republica o evento dela com a automação como único alvo.
   * A execução nova aparece na assinatura acima como qualquer outra.
   */
  rerunExecution(tenantId: string, executionId: string): Promise<void>;
}
