import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useCaseStore } from '../../../stores/useCaseStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import type { Deadline, DeadlinePriority, DeadlineStatus } from '../../../domain/entities';

export interface DayDeadlineItem {
  deadline: Deadline;
  color: string;
  isOverdue: boolean;
  isCompleted: boolean;
  caseId: string;
  statusColor: string;
  caseExists: boolean;
  caseNumber: string | null;
  lawyerName: string | null;
}

export interface CalendarDayColumn {
  date: Date;
  dateKey: string;
  dayNumber: number;
  weekdayAbbr: string;
  isToday: boolean;
  items: DayDeadlineItem[];
}

export interface CalendarStats {
  total: number;
  pending: number;
  completed: number;
  overdue: number;
}

export type PriorityFilter = DeadlinePriority | 'all';

export interface CalendarViewModel {
  currentMonth: Date;
  monthLabel: string;
  daysInMonth: CalendarDayColumn[];
  stats: CalendarStats;
  filterPriority: PriorityFilter;
  priorityOptions: { key: DeadlinePriority; label: string; color: string }[];
  setFilterPriority: (v: PriorityFilter) => void;
  goToPrevMonth: () => void;
  goToNextMonth: () => void;
  goToToday: () => void;
  openDeadlines: () => void;
  handleCompleteDeadline: (deadlineId: string) => Promise<void>;
  handleOpenDeadline: (deadlineId: string) => void;
  handleOpenCase: (caseId: string) => void;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;

  draggingDeadlineId: string | null;
  dragOverDayKey: string | null;
  handleDragStart: (deadlineId: string) => void;
  handleDragEnd: () => void;
  handleDayDragOver: (dateKey: string) => void;
  handleDayDragLeave: (dateKey: string) => void;
  handleDayDrop: (date: Date, deadlineId: string) => Promise<void>;
}

const PRIORITIES: DeadlinePriority[] = ['Baixa', 'Média', 'Alta', 'Crítica'];

const getDisplayDate = (d: Deadline): Date =>
  d.status === 'Concluído' && d.completedAt ? d.completedAt : d.dueDate;

const atDayTime = (date: Date, hours: number, minutes: number): Date =>
  new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours, minutes, 0);

export const useCalendarViewModel = (): CalendarViewModel => {
  const { deadlines, completeDeadline, updateDeadline } = useDeadlineStore();
  const { cases } = useCaseStore();
  const { persons } = usePersonStore();
  const { openTab } = useWorkspace();
  const { user } = useAuth();
  const { notify } = useNotification();
  const theme = useTheme();

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all');
  const [draggingDeadlineId, setDraggingDeadlineId] = useState<string | null>(null);
  const [dragOverDayKey, setDragOverDayKey] = useState<string | null>(null);

  const monthLabel = useMemo(
    () => format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
    [currentMonth],
  );

  const getStatusColor = useCallback((status: string): string => {
    const map: Record<DeadlineStatus, string> = {
      'Pendente':  theme.colors.deadlineStatusPending,
      'Concluído': theme.colors.deadlineStatusCompleted,
      'Vencido':   theme.colors.deadlineStatusOverdue,
      'Cancelado': theme.colors.deadlineStatusCanceled,
    };
    return map[status as DeadlineStatus] ?? theme.colors.deadlineStatusPending;
  }, [theme]);

  const getPriorityColor = useCallback((priority: string): string => {
    const map: Record<DeadlinePriority, string> = {
      'Baixa':   theme.colors.success,
      'Média':   theme.colors.warning,
      'Alta':    theme.colors.secondary,
      'Crítica': theme.colors.danger,
    };
    return map[priority as DeadlinePriority] ?? theme.colors.textSecondary;
  }, [theme]);

  const priorityColorMap = useMemo(() => ({
    'Baixa':   theme.colors.success,
    'Média':   theme.colors.warning,
    'Alta':    theme.colors.secondary,
    'Crítica': theme.colors.danger,
  }), [theme]);

  const priorityOptions = useMemo(() =>
    PRIORITIES.map((p) => ({ key: p, label: p, color: priorityColorMap[p] })),
    [priorityColorMap],
  );

  const filteredDeadlines = useMemo(() =>
    filterPriority === 'all'
      ? deadlines
      : deadlines.filter((d) => d.priority === filterPriority),
    [deadlines, filterPriority],
  );

  const daysInMonth = useMemo<CalendarDayColumn[]>(() => {
    const days = eachDayOfInterval({
      start: startOfMonth(currentMonth),
      end: endOfMonth(currentMonth),
    });
    const now = new Date();

    return days.map((date) => {
      const dateKey = format(date, 'yyyy-MM-dd');
      const items: DayDeadlineItem[] = filteredDeadlines
        .filter((d) => format(getDisplayDate(d), 'yyyy-MM-dd') === dateKey)
        .sort((a, b) => {
          const pri: DeadlinePriority[] = ['Crítica', 'Alta', 'Média', 'Baixa'];
          return pri.indexOf(a.priority) - pri.indexOf(b.priority);
        })
        .map((d) => {
          const matchedCase = cases.find((c) => c.id === d.caseId);
          const matchedLawyer = d.responsibleLawyerId ? persons.find((p) => p.id === d.responsibleLawyerId) : undefined;
          return {
            deadline: d,
            color: getPriorityColor(d.priority),
            isOverdue: d.status === 'Pendente' && d.dueDate.getTime() < now.getTime() && !isToday(d.dueDate),
            isCompleted: d.status === 'Concluído',
            caseId: d.caseId,
            statusColor: getStatusColor(d.status),
            caseExists: !!matchedCase,
            caseNumber: matchedCase?.caseNumber ?? null,
            lawyerName: matchedLawyer?.name ?? null,
          };
        });

      return {
        date,
        dateKey,
        dayNumber: date.getDate(),
        weekdayAbbr: format(date, 'EEE', { locale: ptBR }),
        isToday: isToday(date),
        items,
      };
    });
  }, [currentMonth, filteredDeadlines, getPriorityColor, getStatusColor, cases, persons]);

  const stats = useMemo<CalendarStats>(() => {
    const monthKey = currentMonth.toISOString().slice(0, 7);
    const monthDeadlines = filteredDeadlines.filter(
      (d) => d.dueDate.toISOString().slice(0, 7) === monthKey,
    );
    const now = new Date();
    return {
      total: monthDeadlines.length,
      pending: monthDeadlines.filter((d) => d.status === 'Pendente' && d.dueDate >= now).length,
      completed: monthDeadlines.filter((d) => d.status === 'Concluído').length,
      overdue: monthDeadlines.filter((d) => d.status === 'Pendente' && d.dueDate < now).length,
    };
  }, [filteredDeadlines, currentMonth]);

  useEffect(() => {
    const container = document.querySelector<HTMLElement>('[data-calendar-scroller]');
    if (!container) return;
    const todayEl = container.querySelector<HTMLElement>('[data-today="true"]');
    if (todayEl) {
      const left = todayEl.offsetLeft - container.clientWidth / 2 + todayEl.offsetWidth / 2;
      container.scrollLeft = Math.max(0, left);
    } else {
      container.scrollLeft = 0;
    }
  }, [currentMonth]);

  const goToPrevMonth = useCallback(() => setCurrentMonth((m) => subMonths(m, 1)), []);
  const goToNextMonth = useCallback(() => setCurrentMonth((m) => addMonths(m, 1)), []);
  const goToToday    = useCallback(() => setCurrentMonth(startOfMonth(new Date())), []);
  const openDeadlines = useCallback(() => openTab('deadlines'), [openTab]);

  const handleCompleteDeadline = useCallback(async (deadlineId: string) => {
    if (!user) return;
    try {
      await completeDeadline(deadlineId, user.id);
      notify('Prazo marcado como concluído.', 'success');
    } catch {
      notify('Erro ao concluir prazo.', 'error');
    }
  }, [completeDeadline, user, notify]);

  const handleOpenDeadline = useCallback((deadlineId: string) => {
    openTab(`view-deadline:${deadlineId}`);
  }, [openTab]);

  const handleOpenCase = useCallback((caseId: string) => {
    openTab(`view-case:${caseId}`);
  }, [openTab]);

  const handleDragStart = useCallback((deadlineId: string) => {
    setDraggingDeadlineId(deadlineId);
  }, []);

  const handleDragEnd = useCallback(() => {
    setDraggingDeadlineId(null);
    setDragOverDayKey(null);
  }, []);

  const handleDayDragOver = useCallback((dateKey: string) => {
    setDragOverDayKey((prev) => (prev === dateKey ? prev : dateKey));
  }, []);

  const handleDayDragLeave = useCallback((dateKey: string) => {
    setDragOverDayKey((prev) => (prev === dateKey ? null : prev));
  }, []);

  const handleDayDrop = useCallback(async (date: Date, deadlineId: string) => {
    setDraggingDeadlineId(null);
    setDragOverDayKey(null);
    if (!deadlineId) return;

    const deadline = deadlines.find((d) => d.id === deadlineId);
    if (!deadline || format(getDisplayDate(deadline), 'yyyy-MM-dd') === format(date, 'yyyy-MM-dd')) return;

    try {
      if (deadline.status === 'Concluído') {
        await updateDeadline(deadlineId, { completedAt: atDayTime(date, 12, 0) });
      } else if (deadline.status === 'Cancelado') {
        await updateDeadline(deadlineId, { dueDate: atDayTime(date, 23, 59) });
      } else {
        const dueDate = atDayTime(date, 23, 59);
        const status: DeadlineStatus = dueDate.getTime() < Date.now() ? 'Vencido' : 'Pendente';
        await updateDeadline(deadlineId, { dueDate, status });
      }
    } catch {
      notify('Erro ao mover o prazo.', 'error');
    }
  }, [deadlines, updateDeadline, notify]);

  return {
    currentMonth,
    monthLabel,
    daysInMonth,
    stats,
    filterPriority,
    priorityOptions,
    setFilterPriority,
    goToPrevMonth,
    goToNextMonth,
    goToToday,
    openDeadlines,
    handleCompleteDeadline,
    handleOpenDeadline,
    handleOpenCase,
    getStatusColor,
    getPriorityColor,
    draggingDeadlineId,
    dragOverDayKey,
    handleDragStart,
    handleDragEnd,
    handleDayDragOver,
    handleDayDragLeave,
    handleDayDrop,
  };
};
