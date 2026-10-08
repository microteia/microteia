import type { WorkflowExecution } from '../../domain/entities/Workflow';

export type WorkflowExecutionFollowEvent =
  | { kind: 'finished'; execution: WorkflowExecution }
  | { kind: 'still-running' }
  | { kind: 'untracked'; error: Error };

export type SubscribeToExecutions = (
  onUpdate: (executions: WorkflowExecution[]) => void,
  onError: (error: Error) => void,
) => () => void;

/**
 * Acompanha UMA execução (pelo `eventId`) até ela terminar. O tempo de espera decide só quando avisar
 * que ela continua rodando — não quando parar de ouvir: parar ali era dar como falha uma execução que
 * terminou depois, com tudo gravado. Devolve a função que encerra o acompanhamento.
 */
export const followWorkflowExecution = (
  subscribe: SubscribeToExecutions,
  eventId: string,
  waitMs: number,
  onEvent: (event: WorkflowExecutionFollowEvent) => void,
): (() => void) => {
  let stopped = false;
  let unsubscribe: (() => void) | null = null;
  let timer: ReturnType<typeof setTimeout> | null = null;

  const stop = (): void => {
    stopped = true;
    if (timer) clearTimeout(timer);
    timer = null;
    if (unsubscribe) unsubscribe();
    unsubscribe = null;
  };

  const handle = subscribe(
    (executions) => {
      if (stopped) return;
      const execution = executions.find((candidate) => candidate.eventId === eventId);
      if (!execution || execution.status === 'RUNNING') return;
      stop();
      onEvent({ kind: 'finished', execution });
    },
    (error) => {
      if (stopped) return;
      stop();
      onEvent({ kind: 'untracked', error });
    },
  );

  if (stopped) {
    handle();
    return stop;
  }
  unsubscribe = handle;
  timer = setTimeout(() => {
    timer = null;
    if (!stopped) onEvent({ kind: 'still-running' });
  }, waitMs);
  return stop;
};
