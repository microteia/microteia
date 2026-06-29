import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isToday, addMonths, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import type { Deadline, DeadlinePriority } from '../../../domain/entities';

export interface DayDeadlineItem {
  deadline: Deadline;
  color: string;
  isOverdue: boolean;
  isCompleted: boolean;
}

export interface CalendarDayColumn {
  date: Date;
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
}

const PRIORITIES: DeadlinePriority[] = ['Baixa', 'Média', 'Alta', 'Crítica'];

export const useCalendarViewModel = (): CalendarViewModel => {
  const { deadlines } = useDeadlineStore();
  const { openTab } = useWorkspace();
  const theme = useTheme();

  const [currentMonth, setCurrentMonth] = useState<Date>(() => startOfMonth(new Date()));
  const [filterPriority, setFilterPriority] = useState<PriorityFilter>('all');

  const monthLabel = useMemo(
    () => format(currentMonth, 'MMMM yyyy', { locale: ptBR }),
    [currentMonth],
  );

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
      const dateKey = date.toISOString().slice(0, 10);
      const items: DayDeadlineItem[] = filteredDeadlines
        .filter((d) => d.dueDate.toISOString().slice(0, 10) === dateKey)
        .sort((a, b) => {
          const pri: DeadlinePriority[] = ['Crítica', 'Alta', 'Média', 'Baixa'];
          return pri.indexOf(a.priority) - pri.indexOf(b.priority);
        })
        .map((d) => ({
          deadline: d,
          color: priorityColorMap[d.priority] ?? theme.colors.textSecondary,
          isOverdue: d.status === 'Pendente' && d.dueDate.getTime() < now.getTime() && !isToday(d.dueDate),
          isCompleted: d.status === 'Concluído',
        }));

      return {
        date,
        dayNumber: date.getDate(),
        weekdayAbbr: format(date, 'EEE', { locale: ptBR }),
        isToday: isToday(date),
        items,
      };
    });
  }, [currentMonth, filteredDeadlines, priorityColorMap, theme]);

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
  };
};
