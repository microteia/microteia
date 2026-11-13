import type { DelegationRefusal, WorkflowTask, WorkflowTaskDelegation, WorkflowTaskVoteVia } from '../schema/workflowTask';

export interface WorkflowTaskDecision {
  userId: string;
  userName: string;
  outcome: string;
  comment: string;
  at: Date;
  via: WorkflowTaskVoteVia;
}

/** Por que a decisão não foi aceita — cada motivo vira uma mensagem própria para quem decidiu. */
export type WorkflowTaskRefusal = 'not-found' | 'not-open' | 'not-assignee' | 'invalid-outcome' | 'already-voted';

export type WorkflowTaskDecisionResult =
  /** `closed`: o voto fechou a tarefa (o quórum foi atingido, ou ficou impossível). Sem isso, ela segue aberta. */
  | { ok: true; task: WorkflowTask; closed: boolean }
  | { ok: false; reason: WorkflowTaskRefusal };

export interface IWorkflowTaskRepository {
  /**
   * Cria a tarefa se ela ainda não existe. O id é determinístico (`workflowTaskId`): a nova tentativa
   * de um passo encontra a mesma tarefa, e a caixa não mostra o mesmo pedido duas vezes.
   */
  createIfAbsent(task: WorkflowTask): Promise<void>;
  findById(tenantId: string, taskId: string): Promise<WorkflowTask | null>;
  /** As tarefas ABERTAS em que a pessoa está designada, as mais novas primeiro — a caixa dela. */
  listOpenForAssignee(tenantId: string, userId: string, limit: number): Promise<WorkflowTask[]>;
  /**
   * Grava o VOTO numa transação, conferindo ali dentro que a tarefa está aberta, que quem vota está entre
   * os designados (membro ou convidado), que ainda não votou e que o desfecho é um dos dela — e apura
   * (`tallyApprovalVotes`). Sem quórum, o primeiro voto decide; duas pessoas que decidem juntas: uma
   * vence, a outra recebe `not-open`.
   */
  decide(tenantId: string, taskId: string, decision: WorkflowTaskDecision): Promise<WorkflowTaskDecisionResult>;
  /**
   * As tarefas ABERTAS de todos os escritórios com lembrete vencido, as mais atrasadas primeiro — a varredura
   * que pega carona no relógio.
   */
  dueReminders(now: Date, limit: number): Promise<WorkflowTask[]>;
  /**
   * Reserva o lembrete VISTO: move `nextReminderAt` para `next` (ou o encerra) e conta mais um, numa
   * transação que só vale se a tarefa ainda está aberta com o mesmo `nextReminderAt`. `false` quando outra
   * volta já o reservou, ou a tarefa fechou — é o que faz cada lembrete sair uma vez só.
   */
  claimReminder(task: WorkflowTask, next: Date | null): Promise<boolean>;
  /**
   * REPASSA a tarefa numa transação (`delegateTaskAssignees` lá dentro): quem repassa sai, quem recebe entra
   * no mesmo lugar, e o repasse fica registrado.
   */
  delegate(tenantId: string, taskId: string, delegation: WorkflowTaskDelegation): Promise<
    { ok: true; task: WorkflowTask } | { ok: false; reason: DelegationRefusal | 'not-found' }
  >;
  /** As tarefas ABERTAS de todos os escritórios cujo escalonamento venceu, as mais atrasadas primeiro. */
  dueEscalations(now: Date, limit: number): Promise<WorkflowTask[]>;
  /**
   * SOBE a tarefa vista: acrescenta `add` aos designados e encerra o escalonamento, numa transação que só vale
   * se ela ainda está aberta com o mesmo `escalateAt`. Devolve quem de fato entrou (`null` quando outra volta
   * já a escalonou, ou ela fechou).
   */
  escalate(task: WorkflowTask, add: string[], at: Date): Promise<string[] | null>;
  /** Fecha como expirada — só a que ainda está aberta. */
  expire(tenantId: string, taskId: string, at: Date): Promise<void>;
}
