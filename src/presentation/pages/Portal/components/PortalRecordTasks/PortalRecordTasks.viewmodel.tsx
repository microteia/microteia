import { useCallback, useMemo, useState } from 'react';
import { usePortal } from '../../../../../stores/usePortal';
import { useNotification } from '../../../../../stores/useNotification';
import { useLabel, useLocaleFormat, useT } from '../../../../shared/i18n/useT';
import { errorParamsOf } from '../../../../../domain/errors/LocalizedError';

export interface PortalRecordTasksProps {
  collection: string;
  /** O id do REGISTRO, não o da projeção. */
  recordId: string;
}

export interface PortalTaskCard {
  id: string;
  title: string;
  message: string;
  /** "Vence em …" — `null` sem prazo próprio. */
  due: string | null;
  /** "Precisa de 2 aprovações — 1 até agora"; `null` quando a primeira decisão fecha. */
  progress: string | null;
  outcomes: { key: string; label: string; primary: boolean }[];
  comment: string;
  deciding: boolean;
}

export interface PortalRecordTasksViewModel {
  heading: string;
  commentPlaceholder: string;
  tasks: PortalTaskCard[];
  setComment: (taskId: string, comment: string) => void;
  decide: (taskId: string, outcome: string) => void;
}

/**
 * As APROVAÇÕES pendentes do convidado neste registro — o que o escritório pediu a ele. A decisão vai ao
 * servidor (`decidePortalTask`), que confere tudo de novo e retoma a automação; a tela nunca grava a tarefa.
 * Some quando decidida, quando ele já votou (com quórum, a tarefa espera os outros) ou quando vence.
 */
export const usePortalRecordTasksViewModel = ({ collection, recordId }: PortalRecordTasksProps): PortalRecordTasksViewModel => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { formatDateTime } = useLocaleFormat();
  const { tasks, decideTask } = usePortal();
  const { notify } = useNotification();
  const [comments, setComments] = useState<Record<string, string>>({});
  const [decidingId, setDecidingId] = useState<string | null>(null);

  const decide = useCallback((taskId: string, outcome: string) => {
    if (decidingId) return;
    setDecidingId(taskId);
    decideTask(taskId, outcome, comments[taskId] ?? '')
      .then((status) => notify(t(status === 'voted' ? 'portal.task.voted' : 'portal.task.decided'), 'success'))
      .catch((caught: unknown) => {
        const message = caught instanceof Error ? caught.message : String(caught);
        notify(label(message, errorParamsOf(caught)), 'error');
      })
      .finally(() => setDecidingId(null));
  }, [decidingId, decideTask, comments, notify, t, label]);

  const cards = useMemo<PortalTaskCard[]>(() => tasks
    .filter((task) => !task.voted && task.target.collection === collection && task.target.recordId === recordId)
    .map((task) => ({
      id: task.id,
      title: label(task.title),
      message: task.message ? label(task.message) : '',
      due: task.dueAt ? t('portal.task.due', { when: formatDateTime(task.dueAt) }) : null,
      progress: task.quorum > 1
        ? t('portal.task.progress', { quorum: String(task.quorum), votes: String(task.votes) })
        : null,
      outcomes: task.outcomes.map((outcome, index) => ({ key: outcome.key, label: label(outcome.label), primary: index === 0 })),
      comment: comments[task.id] ?? '',
      deciding: decidingId === task.id,
    })), [tasks, collection, recordId, label, t, formatDateTime, comments, decidingId]);

  return {
    heading: t('portal.task.heading'),
    commentPlaceholder: t('portal.task.comment'),
    tasks: cards,
    setComment: (taskId, comment) => setComments((current) => ({ ...current, [taskId]: comment })),
    decide,
  };
};
