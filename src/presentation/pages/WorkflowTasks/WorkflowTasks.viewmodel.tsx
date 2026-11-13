import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../infrastructure/di/useDI';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useNotification } from '../../../stores/useNotification';
import { useLabel, useLocaleFormat, useT } from '../../shared/i18n/useT';
import { useOpenRecord } from '../../shared/useOpenRecord';
import { errorParamsOf } from '../../../domain/errors/LocalizedError';
import type { WorkflowTask } from '../../../domain/schema/workflowTask';

/** Uma tarefa como a caixa a mostra: o pedido, o prazo e os desfechos que a pessoa pode escolher. */
export interface WorkflowTaskCard {
  id: string;
  title: string;
  message: string;
  createdAt: string;
  /** "Vence em …" — `null` quando a tarefa não tem prazo próprio. */
  due: string | null;
  overdue: boolean;
  outcomes: { key: string; label: string }[];
  comment: string;
  /** A tarefa fala de um registro: o botão de abri-lo aparece. */
  hasRecord: boolean;
  /** "Precisa de 2 aprovações — 1 até agora"; `null` quando a primeira decisão fecha. */
  progress: string | null;
  /** "Repassada por Ana: estou de férias" — o último repasse que trouxe a tarefa até aqui. */
  delegatedNote: string | null;
  /** O formulário de repasse está aberto neste cartão. */
  delegating: boolean;
  deciding: boolean;
}

export interface WorkflowTasksViewModel {
  title: string;
  subtitle: string;
  tasks: WorkflowTaskCard[];
  isLoading: boolean;
  error: string | null;
  emptyMessage: string;
  commentPlaceholder: string;
  openRecordLabel: string;
  setComment: (taskId: string, comment: string) => void;
  decide: (taskId: string, outcome: string) => Promise<void>;
  delegateLabel: string;
  delegateToLabel: string;
  delegateReasonPlaceholder: string;
  delegateConfirmLabel: string;
  cancelLabel: string;
  /** Os membros a quem a tarefa aberta pode ser repassada — nunca quem já decide. */
  delegateOptions: { value: string; label: string }[];
  delegateTo: string;
  delegateReason: string;
  setDelegateTo: (userId: string) => void;
  setDelegateReason: (reason: string) => void;
  startDelegate: (taskId: string) => void;
  cancelDelegate: () => void;
  confirmDelegate: () => Promise<void>;
  openRecord: (taskId: string) => void;
}

/**
 * A CAIXA DE TAREFAS — o que as automações pediram a esta pessoa e ainda esperam.
 *
 * Mostra só as abertas em que ela é designada, e a decisão vai ao servidor, que retoma a execução: a
 * tela nunca grava a tarefa. Some da lista quando decidida (por ela ou por outro designado) ou quando
 * vence — a assinatura acompanha o `status`.
 */
export const useWorkflowTasksViewModel = (): WorkflowTasksViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();
  const { workflowTaskRepository } = useDI();
  const { user } = useAuth();
  const { currentTenant, members } = useTenant();
  const { notify } = useNotification();
  const openRecordOf = useOpenRecord();

  const [tasks, setTasks] = useState<WorkflowTask[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [comments, setComments] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [now, setNow] = useState<number>(0);
  const [delegatingId, setDelegatingId] = useState<string | null>(null);
  const [delegateTo, setDelegateTo] = useState('');
  const [delegateReason, setDelegateReason] = useState('');

  useEffect(() => {
    if (!currentTenant || !user) return undefined;
    return workflowTaskRepository.subscribeToMyOpenTasks(
      currentTenant.id,
      user.id,
      (next) => {
        setTasks(next);
        setIsLoading(false);
        setError(null);
        setNow(Date.now());
      },
      (caught) => {
        setIsLoading(false);
        setError(caught.message);
      },
    );
  }, [currentTenant, user, workflowTaskRepository]);

  const decide = useCallback(async (taskId: string, outcome: string) => {
    if (!currentTenant) return;
    setDecidingId(taskId);
    try {
      const status = await workflowTaskRepository.completeTask(currentTenant.id, taskId, outcome, comments[taskId] ?? '');
      notify(t(status === 'voted' ? 'task.voted' : 'task.decided'), 'success');
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      notify(label(message, errorParamsOf(caught)), 'error');
    } finally {
      setDecidingId(null);
    }
  }, [currentTenant, workflowTaskRepository, comments, notify, t, label]);

  const startDelegate = useCallback((taskId: string) => {
    setDelegatingId(taskId);
    setDelegateTo('');
    setDelegateReason('');
  }, []);
  const cancelDelegate = useCallback(() => setDelegatingId(null), []);

  const delegateOptions = useMemo(() => {
    const task = tasks.find((one) => one.id === delegatingId);
    const taken = new Set([...(task?.assigneeIds ?? []), ...(task?.guestIds ?? [])]);
    return members
      .filter((member) => !taken.has(member.userId))
      .map((member) => ({ value: member.userId, label: member.displayName || member.email || member.userId }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [tasks, delegatingId, members]);

  const confirmDelegate = useCallback(async () => {
    if (!currentTenant || !delegatingId || !delegateTo) return;
    setDecidingId(delegatingId);
    try {
      await workflowTaskRepository.delegateTask(currentTenant.id, delegatingId, delegateTo, delegateReason);
      notify(t('task.delegate.done'), 'success');
      setDelegatingId(null);
    } catch (caught) {
      const message = caught instanceof Error ? caught.message : String(caught);
      notify(label(message, errorParamsOf(caught)), 'error');
    } finally {
      setDecidingId(null);
    }
  }, [currentTenant, delegatingId, delegateTo, delegateReason, workflowTaskRepository, notify, t, label]);

  const openRecord = useCallback((taskId: string) => {
    const target = tasks.find((task) => task.id === taskId)?.target;
    if (target) openRecordOf(target.collection, target.recordId);
  }, [tasks, openRecordOf]);

  // Quem já votou não vê de novo: com quórum, a tarefa segue aberta à espera dos outros.
  const cards = useMemo<WorkflowTaskCard[]>(() => tasks.filter((task) => !(user && task.votes?.[user.id])).map((task) => ({
    id: task.id,
    title: label(task.title),
    message: task.message ? label(task.message) : '',
    createdAt: formatDateTime(task.createdAt),
    due: task.dueAt ? t('task.due', { when: formatDateTime(task.dueAt) }) : null,
    overdue: task.dueAt !== null && now > 0 && task.dueAt.getTime() < now,
    outcomes: task.outcomes.map((outcome) => ({ key: outcome.key, label: label(outcome.label) })),
    comment: comments[task.id] ?? '',
    hasRecord: task.target !== null,
    progress: task.quorum && task.quorum > 1
      ? t('task.progress', { quorum: String(task.quorum), votes: String(Object.keys(task.votes ?? {}).length) })
      : null,
    delegatedNote: (() => {
      const last = [...(task.delegations ?? [])].reverse().find((one) => one.to === user?.id);
      if (!last) return null;
      return last.reason
        ? t('task.delegated.note-reason', { from: last.fromName || last.from, reason: last.reason })
        : t('task.delegated.note', { from: last.fromName || last.from });
    })(),
    delegating: delegatingId === task.id,
    deciding: decidingId === task.id,
  })), [tasks, user, label, formatDateTime, t, now, comments, decidingId, delegatingId]);

  return {
    title: t('page.workflow-tasks'),
    subtitle: t('task.subtitle'),
    tasks: cards,
    isLoading,
    error: error ? t('task.load-failed', { detail: error }) : null,
    emptyMessage: t('task.empty'),
    commentPlaceholder: t('task.comment.placeholder'),
    openRecordLabel: t('task.open-record'),
    setComment: (taskId, comment) => setComments((current) => ({ ...current, [taskId]: comment })),
    decide,
    delegateLabel: t('task.delegate'),
    delegateToLabel: t('task.delegate.to'),
    delegateReasonPlaceholder: t('task.delegate.reason'),
    delegateConfirmLabel: t('task.delegate.confirm'),
    cancelLabel: t('core.ui/action.cancel'),
    delegateOptions,
    delegateTo,
    delegateReason,
    setDelegateTo,
    setDelegateReason,
    startDelegate,
    cancelDelegate,
    confirmDelegate,
    openRecord,
  };
};
