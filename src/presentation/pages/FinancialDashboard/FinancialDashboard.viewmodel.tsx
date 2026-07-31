import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import {
  startOfMonth,
  endOfMonth,
  eachMonthOfInterval,
  eachDayOfInterval,
  isWithinInterval,
  startOfDay,
  addDays,
  min,
  max,
  format,
} from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { useCaseRecords } from '../../shared/useCollectionRecords';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useContractStore } from '../../../stores/useContractStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useLookups } from '../../../stores/useLookups';
import { consumeNavigationIntent, setNavigationIntent, subscribeNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import { getConfigColor } from '../../../shared/styles/colorUtils';
import {
  buildDefaultMonthTokens,
  buildFinancialFilterDefs,
  computeFinancialSummary,
  filterFinancialsByTokens,
} from '../../shared/financials/financialFilters';
import type { Financial, FinancialType } from '../../../domain/entities';
import type { FilterDef, FilterOption, FilterToken } from '../../components/ui/CompositeFilter';
import { useTags } from '../../../stores/useTags';
import { useTagCollection } from '../../shared/entityScreen/useTagAdapter';

export interface FinancialDashboardKPI {
  label: string;
  value: string;
  color: string;
}

export interface MonthlyFlowPoint {
  month: string;
  Receita: number;
  Despesa: number;
  Saldo: number;
}

export interface DailyCategoryPoint {
  date: string;
  [category: string]: number | string;
}

export interface DistributionSlice {
  name: string;
  value: number;
  percentage: number;
  color: string;
}

export interface AgingBucket {
  label: string;
  Receita: number;
  Despesa: number;
}

export interface FinancialDashboardViewModel {
  isLoading: boolean;
  hasData: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  setFilterTokens: (tokens: FilterToken[]) => void;
  kpis: FinancialDashboardKPI[];
  monthlyFlow: MonthlyFlowPoint[];
  statusDistribution: DistributionSlice[];
  statusTotal: number;
  incomeVsExpense: DistributionSlice[];
  incomeVsExpenseTotal: number;
  categoryType: FinancialType;
  setCategoryType: (type: FinancialType) => void;
  dailyCategoryData: DailyCategoryPoint[];
  allCategories: string[];
  visibleCategories: string[];
  categoryColorMap: Record<string, string>;
  categoryLabelMap: Record<string, string>;
  toggleCategoryVisibility: (category: string) => void;
  agingBuckets: AgingBucket[];
  formatAmount: (v: number) => string;
  formatCompactAmount: (v: number) => string;
  openFinancials: () => void;
}

const currencyFmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const compactFmt = new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 });

const sumAmount = (list: Financial[]): number => list.reduce((s, f) => s + f.amount, 0);

const AGING_BUCKET_DAYS = [7, 15, 30] as const;

export const useFinancialDashboardViewModel = (): FinancialDashboardViewModel => {
  const { financials, isLoading } = useFinancialStore();
  const { getOptions } = useLookups();
  const statusConfigs = getOptions('financialStatuses');
  const categoryConfigs = getOptions('financialCategories');
  const { getTags } = useTags();
  const tags = getTags(useTagCollection('financials'));
  const cases = useCaseRecords();
  const { persons } = usePersonStore();
  const { contracts } = useContractStore();
  const { openTab } = useWorkspace();
  const theme = useTheme();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>(
    () => consumeNavigationIntent('financial-dashboard') as FilterToken[] | undefined ?? buildDefaultMonthTokens(),
  );
  const [categoryType, setCategoryType] = useState<FinancialType>('Despesa');
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(() => new Set());

  useEffect(
    () => subscribeNavigationIntent('financial-dashboard', (tokens) => setFilterTokens(tokens as FilterToken[])),
    [],
  );

  const caseOptions = useMemo(() =>
    cases.map((c) => ({ value: c.id, label: `${c.caseNumber} — ${c.title}` })),
    [cases],
  );

  const personOptions = useMemo(() =>
    persons.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
  );

  const contractOptions = useMemo(() =>
    contracts.map((c) => ({ value: c.id, label: `${c.number} — ${c.title}` })),
    [contracts],
  );

  const tagOptions = useMemo<FilterOption[]>(() =>
    tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const filterDefs = useMemo<FilterDef[]>(
    () => buildFinancialFilterDefs({ caseOptions, personOptions, contractOptions, tagOptions, statusConfigs, theme }),
    [caseOptions, personOptions, contractOptions, tagOptions, statusConfigs, theme],
  );

  const filteredFinancials = useMemo(
    () => filterFinancialsByTokens(financials, filterTokens, { cases, persons, contracts }),
    [financials, filterTokens, cases, persons, contracts],
  );

  const formatAmount = useCallback((v: number) => currencyFmt.format(v), []);
  const formatCompactAmount = useCallback((v: number) => compactFmt.format(v), []);

  const getTypeColor = useCallback((type: FinancialType): string => (
    type === 'Receita' ? theme.colors.revenue : theme.colors.expense
  ), [theme]);

  const openFinancials = useCallback(() => {
    setNavigationIntent('financials', filterTokens);
    openTab('financials');
  }, [openTab, filterTokens]);

  const summary = useMemo(() => computeFinancialSummary(filteredFinancials), [filteredFinancials]);

  const kpis = useMemo<FinancialDashboardKPI[]>(() => [
    { label: 'Receitas Pagas', value: formatAmount(summary.totalIncome), color: getTypeColor('Receita') },
    { label: 'Despesas Pagas', value: formatAmount(summary.totalExpense), color: getTypeColor('Despesa') },
    { label: 'Saldo', value: formatAmount(summary.balance), color: summary.balance >= 0 ? getTypeColor('Receita') : getTypeColor('Despesa') },
    { label: 'Receitas a Receber', value: formatAmount(summary.pendingIncome), color: getTypeColor('Receita') },
    { label: 'Despesas a Pagar', value: formatAmount(summary.pendingExpense), color: getTypeColor('Despesa') },
    { label: 'Saldo Projetado', value: formatAmount(summary.projectedBalance), color: summary.projectedBalance >= 0 ? getTypeColor('Receita') : getTypeColor('Despesa') },
  ], [summary, formatAmount, getTypeColor]);

  const incomeVsExpense = useMemo<DistributionSlice[]>(() => {
    const total = summary.totalIncome + summary.totalExpense;
    return [
      { name: 'Receitas', value: summary.totalIncome, percentage: total > 0 ? Math.round((summary.totalIncome / total) * 100) : 0, color: getTypeColor('Receita') },
      { name: 'Despesas', value: summary.totalExpense, percentage: total > 0 ? Math.round((summary.totalExpense / total) * 100) : 0, color: getTypeColor('Despesa') },
    ].filter((s) => s.value > 0);
  }, [summary, getTypeColor]);

  const incomeVsExpenseTotal = useMemo(() => incomeVsExpense.reduce((s, d) => s + d.value, 0), [incomeVsExpense]);

  const statusDistribution = useMemo<DistributionSlice[]>(() => {
    const totals = new Map<string, number>();
    filteredFinancials.forEach((f) => totals.set(f.status, (totals.get(f.status) ?? 0) + f.amount));
    const total = Array.from(totals.values()).reduce((s, v) => s + v, 0);
    return statusConfigs
      .map((s) => ({
        name: s.label,
        value: totals.get(s.key) ?? 0,
        percentage: total > 0 ? Math.round(((totals.get(s.key) ?? 0) / total) * 100) : 0,
        color: getConfigColor(statusConfigs, s.key, theme),
      }))
      .filter((s) => s.value > 0)
      .sort((a, b) => b.value - a.value);
  }, [filteredFinancials, statusConfigs, theme]);

  const statusTotal = useMemo(() => statusDistribution.reduce((s, d) => s + d.value, 0), [statusDistribution]);

  const seriesRange = useMemo(() => {
    if (filteredFinancials.length === 0) {
      const now = new Date();
      return { start: startOfMonth(now), end: endOfMonth(now) };
    }
    const dueDates = filteredFinancials.map((f) => f.dueDate);
    return { start: startOfDay(min(dueDates)), end: startOfDay(max(dueDates)) };
  }, [filteredFinancials]);

  const monthlyFlow = useMemo<MonthlyFlowPoint[]>(() => {
    const months = eachMonthOfInterval({ start: seriesRange.start, end: seriesRange.end });
    return months.reduce<MonthlyFlowPoint[]>((acc, monthDate) => {
      const mStart = startOfMonth(monthDate);
      const mEnd = endOfMonth(monthDate);
      const income = sumAmount(
        filteredFinancials.filter((f) => f.type === 'Receita' && f.status === 'Pago' && f.paymentDate &&
          isWithinInterval(f.paymentDate, { start: mStart, end: mEnd })),
      );
      const expense = sumAmount(
        filteredFinancials.filter((f) => f.type === 'Despesa' && f.status === 'Pago' && f.paymentDate &&
          isWithinInterval(f.paymentDate, { start: mStart, end: mEnd })),
      );
      const previousBalance = acc.length > 0 ? acc[acc.length - 1].Saldo : 0;
      return [...acc, {
        month: format(monthDate, 'MMM/yy', { locale: ptBR }),
        Receita: income,
        Despesa: expense,
        Saldo: previousBalance + income - expense,
      }];
    }, []);
  }, [filteredFinancials, seriesRange]);

  const categoryScoped = useMemo(
    () => filteredFinancials.filter((f) => f.type === categoryType),
    [filteredFinancials, categoryType],
  );

  const allCategories = useMemo(
    () => Array.from(new Set(categoryScoped.map((f) => f.category))).sort(),
    [categoryScoped],
  );

  const categoryColorMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(allCategories.map((c) => [c, getConfigColor(categoryConfigs, c, theme)])),
    [allCategories, categoryConfigs, theme],
  );

  const categoryLabelMap = useMemo<Record<string, string>>(
    () => Object.fromEntries(allCategories.map((c) => [c, categoryConfigs.find((cfg) => cfg.key === c)?.label ?? c])),
    [allCategories, categoryConfigs],
  );

  const visibleCategories = useMemo(
    () => allCategories.filter((c) => !hiddenCategories.has(c)),
    [allCategories, hiddenCategories],
  );

  const toggleCategoryVisibility = useCallback((category: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev);
      if (next.has(category)) next.delete(category);
      else next.add(category);
      return next;
    });
  }, []);

  const dailyCategoryData = useMemo<DailyCategoryPoint[]>(() => {
    const days = eachDayOfInterval({ start: seriesRange.start, end: seriesRange.end });
    return days.map((day) => {
      const dayStart = startOfDay(day);
      const dayEnd = addDays(dayStart, 1);
      const row: DailyCategoryPoint = { date: format(day, 'dd/MM', { locale: ptBR }) };
      allCategories.forEach((category) => {
        row[category] = sumAmount(
          categoryScoped.filter((f) => f.category === category && f.dueDate >= dayStart && f.dueDate < dayEnd),
        );
      });
      return row;
    });
  }, [categoryScoped, allCategories, seriesRange]);

  const agingBuckets = useMemo<AgingBucket[]>(() => {
    const today = startOfDay(new Date());
    const openFinancialsList = filteredFinancials.filter((f) => f.status === 'Aberto');

    const buckets: AgingBucket[] = [
      { label: 'Vencido', Receita: 0, Despesa: 0 },
      { label: `Até ${AGING_BUCKET_DAYS[0]}d`, Receita: 0, Despesa: 0 },
      { label: `${AGING_BUCKET_DAYS[0]}-${AGING_BUCKET_DAYS[1]}d`, Receita: 0, Despesa: 0 },
      { label: `${AGING_BUCKET_DAYS[1]}-${AGING_BUCKET_DAYS[2]}d`, Receita: 0, Despesa: 0 },
      { label: `+${AGING_BUCKET_DAYS[2]}d`, Receita: 0, Despesa: 0 },
    ];

    openFinancialsList.forEach((f) => {
      const dueDay = startOfDay(f.dueDate);
      const diffDays = Math.round((dueDay.getTime() - today.getTime()) / 86400000);
      let bucketIndex: number;
      if (diffDays < 0) bucketIndex = 0;
      else if (diffDays <= AGING_BUCKET_DAYS[0]) bucketIndex = 1;
      else if (diffDays <= AGING_BUCKET_DAYS[1]) bucketIndex = 2;
      else if (diffDays <= AGING_BUCKET_DAYS[2]) bucketIndex = 3;
      else bucketIndex = 4;

      buckets[bucketIndex][f.type] += f.amount;
    });

    return buckets;
  }, [filteredFinancials]);

  const hasData = financials.length > 0;

  return {
    isLoading,
    hasData,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'financial-dashboard',
    setFilterTokens,
    kpis,
    monthlyFlow,
    statusDistribution,
    statusTotal,
    incomeVsExpense,
    incomeVsExpenseTotal,
    categoryType,
    setCategoryType,
    dailyCategoryData,
    allCategories,
    visibleCategories,
    categoryColorMap,
    categoryLabelMap,
    toggleCategoryVisibility,
    agingBuckets,
    formatAmount,
    formatCompactAmount,
    openFinancials,
  };
};
