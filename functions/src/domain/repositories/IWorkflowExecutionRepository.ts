import type { WorkflowExecution } from '../entities/Workflow';

export interface IWorkflowExecutionRepository {
  create(execution: WorkflowExecution): Promise<void>;
  /**
   * As execuções que um evento disparou.
   *
   * Devolve LISTA, e não uma: o barramento de eventos abre em leque, e um mesmo evento pode acordar
   * mais de um fluxo. O caso do "Executar" — um evento com o fluxo-alvo no payload — tem uma só, e
   * fingir que é sempre assim esconderia as outras de quem pergunta pelo desfecho.
   *
   * Vazio significa que o motor ainda não começou, e não que nada vai acontecer: a publicação e a
   * execução são invocações diferentes.
   */
  findByEventId(tenantId: string, eventId: string): Promise<WorkflowExecution[]>;
}
