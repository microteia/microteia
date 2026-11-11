import type { WorkflowTask } from '../schema/workflowTask';

export interface WorkflowTaskDecision {
  userId: string;
  userName: string;
  outcome: string;
  comment: string;
  at: Date;
}

/** Por que a decisão não foi aceita — cada motivo vira uma mensagem própria para quem decidiu. */
export type WorkflowTaskRefusal = 'not-found' | 'not-open' | 'not-assignee' | 'invalid-outcome';

export type WorkflowTaskDecisionResult =
  | { ok: true; task: WorkflowTask }
  | { ok: false; reason: WorkflowTaskRefusal };

export interface IWorkflowTaskRepository {
  /**
   * Cria a tarefa se ela ainda não existe. O id é determinístico (`workflowTaskId`): a nova tentativa
   * de um passo encontra a mesma tarefa, e a caixa não mostra o mesmo pedido duas vezes.
   */
  createIfAbsent(task: WorkflowTask): Promise<void>;
  findById(tenantId: string, taskId: string): Promise<WorkflowTask | null>;
  /**
   * Grava a decisão NUMA transação, conferindo ali dentro que a tarefa está aberta, que quem decide está
   * entre os designados e que o desfecho é um dos dela. Duas pessoas que decidem juntas: uma vence, a
   * outra recebe `not-open`.
   */
  decide(tenantId: string, taskId: string, decision: WorkflowTaskDecision): Promise<WorkflowTaskDecisionResult>;
  /** Fecha como expirada — só a que ainda está aberta. */
  expire(tenantId: string, taskId: string, at: Date): Promise<void>;
}
