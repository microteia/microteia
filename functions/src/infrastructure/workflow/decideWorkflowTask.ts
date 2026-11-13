import { getDI } from '../di/container';
import { RESUME_CLOCK_ID_PREFIX } from '../../domain/schema/workflowClock';
import type { WorkflowTaskVoteVia } from '../../domain/schema/workflowTask';

/** O comentário vai para o histórico e para a saída do passo; um texto sem fim não cabe em nenhum dos dois. */
const MAX_COMMENT_LENGTH = 2000;

export interface WorkflowTaskDecisionInput {
  tenantId: string;
  taskId: string;
  outcome: string;
  comment?: string;
  /** Quem decide — a decisão é DESTA pessoa, nunca de uma permissão: a tarefa confere se ela está designada. */
  userId: string;
  userName: string;
  /** Por onde o voto chegou — o membro pela caixa (ou o MCP), o convidado pelo portal. */
  via?: WorkflowTaskVoteVia;
}

export type WorkflowTaskDecisionOutcome =
  /** `pending`: o voto foi contado, e a tarefa segue aberta à espera do quórum. */
  | { ok: true; pending?: boolean }
  /** `error` é REFERÊNCIA de mensagem; `code` é o que a porta HTTP responde. */
  | { ok: false; error: string; code: 'not-found' | 'failed-precondition' };

/**
 * DECIDE uma tarefa de aprovação e retoma a execução que a esperava — na hora, e não na próxima volta do
 * relógio. Uma função para as duas portas: a callable da caixa e o `complete_task` do MCP.
 *
 * A ordem é a garantia:
 *
 * 1. a continuação tem de EXISTIR — se o prazo já venceu, o relógio a tomou e a execução seguiu pelo
 *    desfecho de expiração; decidir agora seria escrever uma resposta que ninguém vai ler;
 * 2. a decisão é gravada na tarefa NUMA transação (aberta, designado, desfecho válido) — duas pessoas que
 *    decidem juntas: uma vence;
 * 3. o desfecho entra nas saídas da continuação por outra transação, que só atualiza a continuação que
 *    ainda está lá — gravar por cima de uma que o relógio acabou de tomar a recriaria, e a execução
 *    seguiria duas vezes;
 * 4. a retomada passa pela MESMA porta do relógio (`claim` incluso).
 */
export const decideWorkflowTask = async (input: WorkflowTaskDecisionInput): Promise<WorkflowTaskDecisionOutcome> => {
  const { tenantId, taskId, outcome } = input;
  const di = getDI();
  const tasks = di.getWorkflowTaskRepository();
  const clock = di.getWorkflowClockDeps();
  const now = new Date();

  const task = await tasks.findById(tenantId, taskId);
  if (!task) return { ok: false, error: '@core.automation/task.refused.not-found', code: 'not-found' };

  const entry = await clock.repository.find(tenantId, `${RESUME_CLOCK_ID_PREFIX}${task.executionId}`);
  if (!entry || entry.kind !== 'resume' || entry.taskId !== taskId) {
    await tasks.expire(tenantId, taskId, now);
    return { ok: false, error: '@core.automation/task.refused.expired', code: 'failed-precondition' };
  }

  const decision = await tasks.decide(tenantId, taskId, {
    userId: input.userId,
    userName: input.userName,
    outcome,
    comment: (input.comment ?? '').trim().slice(0, MAX_COMMENT_LENGTH),
    at: now,
    via: input.via ?? 'member',
  });
  if (!decision.ok) {
    return { ok: false, error: `@core.automation/task.refused.${decision.reason}`, code: 'failed-precondition' };
  }
  // O voto contou e o quórum ainda não fechou: a execução continua esperando — quem retoma é o voto que fecha.
  if (!decision.closed) return { ok: true, pending: true };

  const outputs = {
    ...entry.outputs,
    [task.stepId]: {
      ...(entry.outputs[task.stepId] ?? {}),
      outcome: decision.task.outcome ?? outcome,
      decidedBy: decision.task.decidedBy ?? input.userId,
      decidedByName: decision.task.decidedByName ?? '',
      decidedAt: now,
      comment: decision.task.comment ?? '',
      taskId,
      // Com quórum, cada voto: quem, o quê, quando e por onde. Sem quórum, a lista é a própria decisão.
      votes: Object.entries(decision.task.votes ?? {
        [input.userId]: { outcome, name: input.userName, at: now, comment: decision.task.comment ?? '', via: input.via ?? 'member' },
      }).map(([userId, vote]) => ({
        outcome: vote.outcome, decidedBy: userId, decidedByName: vote.name, decidedAt: vote.at, comment: vote.comment, via: vote.via,
      })),
    },
  };
  if ((await clock.repository.annotateResume(entry, outputs)) === 'stale') {
    return { ok: false, error: '@core.automation/task.refused.expired', code: 'failed-precondition' };
  }

  await clock.resume?.({ ...entry, outputs, decided: true });
  return { ok: true };
};
