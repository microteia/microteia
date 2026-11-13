import type { WorkflowTask } from '../schema/workflowTask';

export interface IWorkflowTaskRepository {
  /**
   * As tarefas ABERTAS em que a pessoa é designada, as mais recentes primeiro. A leitura passa pela
   * regra do Firestore — quem não está na tarefa não a lê —, e a consulta é a que a regra exige.
   */
  subscribeToMyOpenTasks(
    tenantId: string,
    userId: string,
    onUpdate: (tasks: WorkflowTask[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /** Decide a tarefa no SERVIDOR — é lá que a execução que a esperava é retomada. */
  /** `voted`: o voto contou, e a tarefa segue aberta até o quórum. */
  completeTask(tenantId: string, taskId: string, outcome: string, comment: string): Promise<'decided' | 'voted'>;
}
