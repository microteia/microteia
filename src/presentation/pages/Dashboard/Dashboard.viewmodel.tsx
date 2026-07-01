import { useMemo } from 'react';
import { useTheme } from 'styled-components';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { setNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { Deadline, Case, DeadlinePriority } from '../../../domain/entities';

export interface KPIStat {
  label: string;
  value: number | string;
  color: string;
  onClick?: () => void;
}

export interface UpcomingDeadline {
  deadline: Deadline;
  daysLeft: number;
  isToday: boolean;
  isTomorrow: boolean;
  isOverdue: boolean;
  priorityColor: string;
}

export interface OverdueDeadline {
  deadline: Deadline;
  daysOverdue: number;
  priorityColor: string;
}

export interface DashboardViewModel {
  isLoading: boolean;
  kpis: KPIStat[];
  upcomingDeadlines: UpcomingDeadline[];
  overdueDeadlines: OverdueDeadline[];
  recentCases: Case[];
  allDeadlines: Deadline[];
  pendingIncome: number;
  pendingExpense: number;
  formatAmount: (v: number) => string;
  openCases: () => void;
  openCasesActive: () => void;
  openDeadlines: () => void;
  openDeadlinesOverdue: () => void;
  openFinancials: () => void;
  openCase: (caseId: string) => void;
  openDeadline: (deadline: Deadline) => void;
  getPriorityColor: (priority: DeadlinePriority) => string;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const msInDay = 1000 * 60 * 60 * 24;

export const useDashboardViewModel = (): DashboardViewModel => {
  const { deadlines, isLoading: loadingDeadlines } = useDeadlineStore();
  const { cases, isLoading: loadingCases } = useCaseStore();
  const { financials, isLoading: loadingFinancials } = useFinancialStore();
  const { persons, isLoading: loadingPersons } = usePersonStore();
  const { openTab } = useWorkspace();
  const theme = useTheme();

  const priorityColorMap = useMemo<Record<DeadlinePriority, string>>(() => ({
    'Baixa':   theme.colors.success,
    'Média':   theme.colors.warning,
    'Alta':    theme.colors.secondary,
    'Crítica': theme.colors.danger,
  }), [theme]);

  const isLoading = loadingDeadlines || loadingCases || loadingFinancials || loadingPersons;

  const todayStart = useMemo(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), now.getDate());
  }, []);
  const sevenDaysMs = 7 * msInDay;

  const activeCases = useMemo(() => cases.filter((c) => c.status === 'Em Andamento'), [cases]);
  const activePersons = useMemo(() => persons.filter((c) => c.status === 'Ativo'), [persons]);

  const pendingDeadlines = useMemo(() =>
    deadlines.filter((d) => d.status === 'Pendente'),
    [deadlines],
  );

  const overdueDeadlines = useMemo<OverdueDeadline[]>(() =>
    deadlines
      .filter((d) =>
        d.status === 'Vencido' ||
        (d.status === 'Pendente' && d.dueDate.getTime() < todayStart.getTime()),
      )
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map((d) => ({
        deadline: d,
        daysOverdue: Math.floor((todayStart.getTime() - d.dueDate.getTime()) / msInDay),
        priorityColor: priorityColorMap[d.priority] ?? theme.colors.textSecondary,
      })),
    [deadlines, todayStart, priorityColorMap, theme],
  );

  const upcomingDeadlines = useMemo<UpcomingDeadline[]>(() => {
    const cutoff = todayStart.getTime() + sevenDaysMs;
    return pendingDeadlines
      .filter((d) => d.dueDate.getTime() >= todayStart.getTime() && d.dueDate.getTime() <= cutoff)
      .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
      .map((d) => {
        const daysDiff = Math.floor((d.dueDate.getTime() - todayStart.getTime()) / msInDay);
        return {
          deadline: d,
          daysLeft: daysDiff,
          isToday: daysDiff === 0,
          isTomorrow: daysDiff === 1,
          isOverdue: false,
          priorityColor: priorityColorMap[d.priority] ?? theme.colors.textSecondary,
        };
      });
  }, [pendingDeadlines, todayStart, sevenDaysMs, priorityColorMap, theme]);

  const pendingFinancials = useMemo(() =>
    financials.filter((f) => f.status === 'Pendente'),
    [financials],
  );

  const pendingIncome = useMemo(() =>
    pendingFinancials.filter((f) => f.type === 'Receita').reduce((s, f) => s + f.amount, 0),
    [pendingFinancials],
  );

  const pendingExpense = useMemo(() =>
    pendingFinancials.filter((f) => f.type === 'Despesa').reduce((s, f) => s + f.amount, 0),
    [pendingFinancials],
  );

  const recentCases = useMemo<Case[]>(() =>
    [...activeCases]
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .slice(0, 5),
    [activeCases],
  );

  const kpis = useMemo<KPIStat[]>(() => [
    { label: 'Processos Ativos',    value: activeCases.length,       color: theme.colors.kpiCases,             onClick: () => openTab('cases')     },
    { label: 'Pessoas Ativas',      value: activePersons.length,     color: theme.colors.kpiPersons,           onClick: () => openTab('persons')   },
    { label: 'Prazos Pendentes',    value: pendingDeadlines.length,  color: theme.colors.kpiDeadlinesPending,  onClick: () => openTab('deadlines') },
    { label: 'Prazos Vencidos',     value: overdueDeadlines.length,  color: theme.colors.kpiDeadlinesOverdue,  onClick: () => openTab('deadlines') },
  ], [activeCases.length, activePersons.length, pendingDeadlines.length, overdueDeadlines.length, openTab, theme]);

  const openCases = () => openTab('cases');
  const openCasesActive = () => {
    setNavigationIntent('cases', [{ key: 'status', values: ['Em Andamento'] }]);
    openTab('cases');
  };
  const openDeadlines = () => openTab('deadlines');
  const openDeadlinesOverdue = () => {
    setNavigationIntent('deadlines', [{ key: 'status', values: ['Vencido'] }]);
    openTab('deadlines');
  };
  const openFinancials = () => openTab('financials');
  const openCase = (caseId: string) => openTab(`view-case:${caseId}`);
  const openDeadline = (deadline: Deadline) => openTab(`view-deadline:${deadline.id}`);
  const getPriorityColor = (priority: DeadlinePriority) => priorityColorMap[priority] ?? theme.colors.textSecondary;
  const formatAmount = (v: number) => fmt.format(v);

  return {
    isLoading,
    kpis,
    upcomingDeadlines,
    overdueDeadlines,
    recentCases,
    allDeadlines: deadlines,
    pendingIncome,
    pendingExpense,
    formatAmount,
    openCases,
    openCasesActive,
    openDeadlines,
    openDeadlinesOverdue,
    openFinancials,
    openCase,
    openDeadline,
    getPriorityColor,
  };
};
