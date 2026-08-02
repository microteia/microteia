import { useMemo, useState } from 'react';
import { useTheme } from 'styled-components';
import { CASES_COLLECTION, PERSONS_COLLECTION, useCaseRecords, type CaseRecord } from '../../shared/useCollectionRecords';
import { useOpenRecord } from '../../shared/useOpenRecord';
import { DEADLINES_COLLECTION, FINANCIALS_COLLECTION, useDeadlineRecords, useFinancialRecords } from '../../shared/useCollectionRecords';
import type { DeadlineRecord } from '../../shared/useCollectionRecords';
import { useOpenScreenList } from '../../shared/useOpenScreenList';
import { usePersonRecords } from '../../shared/useCollectionRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useRecords } from '../../../stores/useRecords';
import { setNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import { FILTER_RANGE_TO_SUFFIX } from '../../hooks/useCustomFieldListing';
import type { FilterToken } from '../../components/ui/CompositeFilter';

/** As quatro prioridades que o painel colore. Ver a nota em `Calendar.viewmodel`. */
type DeadlinePriority = 'Baixa' | 'Média' | 'Alta' | 'Crítica';

export interface KPIStat {
  label: string;
  value: number | string;
  color: string;
  onClick?: () => void;
}

export interface UpcomingDeadline {
  deadline: DeadlineRecord;
  daysLeft: number;
  isToday: boolean;
  isTomorrow: boolean;
  isOverdue: boolean;
  priorityColor: string;
  caseNumberDisplay: string;
}

export interface OverdueDeadline {
  deadline: DeadlineRecord;
  daysOverdue: number;
  priorityColor: string;
  caseNumberDisplay: string;
}

export type FinancialPeriodDays = 7 | 15 | 30;

export interface DashboardViewModel {
  isLoading: boolean;
  kpis: KPIStat[];
  upcomingDeadlines: UpcomingDeadline[];
  overdueDeadlines: OverdueDeadline[];
  recentCases: CaseRecord[];
  allDeadlines: DeadlineRecord[];
  pendingIncome: number;
  pendingExpense: number;
  financialPeriodDays: FinancialPeriodDays;
  setFinancialPeriodDays: (days: FinancialPeriodDays) => void;
  formatAmount: (v: number) => string;
  openCases: () => void;
  openCasesActive: () => void;
  openDeadlines: () => void;
  openDeadlinesOverdue: () => void;
  openFinancials: () => void;
  openFinancialDashboard: () => void;
  openCase: (caseId: string | null) => void;
  openDeadline: (deadline: DeadlineRecord) => void;
  getPriorityColor: (priority: string) => string;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

const msInDay = 1000 * 60 * 60 * 24;

const toISODate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const useDashboardViewModel = (): DashboardViewModel => {
  const deadlines = useDeadlineRecords();
  const { isLoading } = useRecords();
  const cases = useCaseRecords();
  const openRecord = useOpenRecord();
  const financials = useFinancialRecords();
  const openScreenList = useOpenScreenList();
  const persons = usePersonRecords();
  const { openTab } = useWorkspace();
  const theme = useTheme();

  const [financialPeriodDays, setFinancialPeriodDays] = useState<FinancialPeriodDays>(30);

  const priorityColorMap = useMemo<Record<DeadlinePriority, string>>(() => ({
    'Baixa':   theme.colors.success,
    'Média':   theme.colors.warning,
    'Alta':    theme.colors.secondary,
    'Crítica': theme.colors.danger,
  }), [theme]);

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
      .filter((d) => !!d.dueDate && (
        d.status === 'Vencido' ||
        (d.status === 'Pendente' && d.dueDate.getTime() < todayStart.getTime())
      ))
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .map((d) => ({
        deadline: d,
        daysOverdue: Math.floor((todayStart.getTime() - (d.dueDate?.getTime() ?? 0)) / msInDay),
        priorityColor: priorityColorMap[d.priority as DeadlinePriority] ?? theme.colors.textSecondary,
        caseNumberDisplay: cases.find((c) => c.id === d.caseId)?.caseNumber ?? '—',
      })),
    [deadlines, todayStart, priorityColorMap, theme, cases],
  );

  const upcomingDeadlines = useMemo<UpcomingDeadline[]>(() => {
    const cutoff = todayStart.getTime() + sevenDaysMs;
    return pendingDeadlines
      .filter((d) => !!d.dueDate && d.dueDate.getTime() >= todayStart.getTime() && d.dueDate.getTime() <= cutoff)
      .sort((a, b) => (a.dueDate?.getTime() ?? 0) - (b.dueDate?.getTime() ?? 0))
      .map((d) => {
        const daysDiff = Math.floor(((d.dueDate?.getTime() ?? 0) - todayStart.getTime()) / msInDay);
        return {
          deadline: d,
          daysLeft: daysDiff,
          isToday: daysDiff === 0,
          isTomorrow: daysDiff === 1,
          isOverdue: false,
          priorityColor: priorityColorMap[d.priority as DeadlinePriority] ?? theme.colors.textSecondary,
          caseNumberDisplay: cases.find((c) => c.id === d.caseId)?.caseNumber ?? '—',
        };
      });
  }, [pendingDeadlines, todayStart, sevenDaysMs, priorityColorMap, theme, cases]);

  const financialCutoffDay = useMemo(() =>
    new Date(todayStart.getFullYear(), todayStart.getMonth(), todayStart.getDate() + financialPeriodDays),
    [todayStart, financialPeriodDays],
  );

  const pendingFinancials = useMemo(() => {
    const cutoffMs = financialCutoffDay.getTime() + msInDay - 1;
    return financials.filter((f) => f.status === 'Aberto' && !!f.dueDate && f.dueDate.getTime() <= cutoffMs);
  }, [financials, financialCutoffDay]);

  const pendingIncome = useMemo(() =>
    pendingFinancials.filter((f) => f.type === 'Receita').reduce((s, f) => s + f.amount, 0),
    [pendingFinancials],
  );

  const pendingExpense = useMemo(() =>
    pendingFinancials.filter((f) => f.type === 'Despesa').reduce((s, f) => s + f.amount, 0),
    [pendingFinancials],
  );

  const recentCases = useMemo<CaseRecord[]>(() =>
    [...activeCases]
      .sort((a, b) => (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0))
      .slice(0, 5),
    [activeCases],
  );

  const kpis = useMemo<KPIStat[]>(() => [
    { label: 'Processos Ativos',    value: activeCases.length,       color: theme.colors.kpiCases,             onClick: () => openScreenList(CASES_COLLECTION)   },
    { label: 'Pessoas Ativas',      value: activePersons.length,     color: theme.colors.kpiPersons,           onClick: () => openScreenList(PERSONS_COLLECTION) },
    { label: 'Prazos Pendentes',    value: pendingDeadlines.length,  color: theme.colors.kpiDeadlinesPending,  onClick: () => openScreenList(DEADLINES_COLLECTION) },
    { label: 'Prazos Vencidos',     value: overdueDeadlines.length,  color: theme.colors.kpiDeadlinesOverdue,  onClick: () => openScreenList(DEADLINES_COLLECTION) },
  ], [activeCases.length, activePersons.length, pendingDeadlines.length, overdueDeadlines.length, openScreenList, theme]);

  const openCases = () => openScreenList(CASES_COLLECTION);
  const openCasesActive = () =>
    openScreenList(CASES_COLLECTION, [{ key: 'status', values: ['Em Andamento'] }]);
  const openDeadlines = () => openScreenList(DEADLINES_COLLECTION);
  const openDeadlinesOverdue = () =>
    openScreenList(DEADLINES_COLLECTION, [{ key: 'status', values: ['Vencido'] }]);
  const financialOpenFilterTokens = (): FilterToken[] => [
    { key: 'status', values: ['Aberto'] },
    { key: `dueDate${FILTER_RANGE_TO_SUFFIX}`, values: [toISODate(financialCutoffDay)] },
  ];
  const openFinancials = () => openScreenList(FINANCIALS_COLLECTION, financialOpenFilterTokens());
  const openFinancialDashboard = () => {
    setNavigationIntent('financial-dashboard', financialOpenFilterTokens());
    openTab('financial-dashboard');
  };
  const openCase = (caseId: string | null) => { if (caseId) openRecord(CASES_COLLECTION, caseId); };
  const openDeadline = (deadline: DeadlineRecord) => openRecord(DEADLINES_COLLECTION, deadline.id);
  const getPriorityColor = (priority: string) => priorityColorMap[priority as DeadlinePriority] ?? theme.colors.textSecondary;
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
    financialPeriodDays,
    setFinancialPeriodDays,
    formatAmount,
    openCases,
    openCasesActive,
    openDeadlines,
    openDeadlinesOverdue,
    openFinancials,
    openFinancialDashboard,
    openCase,
    openDeadline,
    getPriorityColor,
  };
};
