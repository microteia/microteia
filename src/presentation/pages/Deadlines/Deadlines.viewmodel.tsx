import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useAuth } from '../../../stores/useAuth';
import { useDeadlineStore } from '../../../stores/useDeadlineStore';
import { useDeadlineLookup } from '../../../stores/useDeadlineLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomFieldListing, CUSTOM_FIELD_FILTER_PREFIX } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { consumeNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { Deadline, DeadlineStatus, DeadlinePriority } from '../../../domain/entities';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

const PRIORITY_ORDER: Record<DeadlinePriority, number> = {
  'Crítica': 3, 'Alta': 2, 'Média': 1, 'Baixa': 0,
};

export interface DeadlinesViewModel {
  deadlines: Deadline[];
  filteredDeadlines: Deadline[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  deadlineToDelete: Deadline | null;
  deadlineToComplete: Deadline | null;
  caseOptions: { value: string; label: string }[];
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewDeadline: () => void;
  openDeadline: (d: Deadline) => void;
  openCase: (caseId: string) => void;
  handleDelete: (d: Deadline) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  handleComplete: (d: Deadline) => void;
  confirmComplete: () => Promise<void>;
  cancelComplete: () => void;
  isOverdue: (d: Deadline) => boolean;
  isToday: (d: Deadline) => boolean;
  getDaysUntilDue: (d: Deadline) => number;
  getStatusColor: (status: string) => string;
  getPriorityColor: (priority: string) => string;
  getCustomFieldItems: (d: Deadline) => CustomFieldCardItem[];
}

export const useDeadlinesViewModel = (): DeadlinesViewModel => {
  const { deadlines, isLoading, deleteDeadline, completeDeadline } = useDeadlineStore();
  const { user } = useAuth();
  const { typeConfigs } = useDeadlineLookup();
  const { cases } = useCaseStore();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const { getCustomFieldsFor } = useScreenDefinitions();
  const theme = useTheme();

  const customFields = useMemo(() => getCustomFieldsFor('deadlines'), [getCustomFieldsFor]);
  const customListing = useCustomFieldListing('deadlines', customFields, CUSTOM_FIELD_FILTER_PREFIX);

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>(
    () => consumeNavigationIntent('deadlines') as FilterToken[] | undefined ?? [{ key: 'status', values: ['Pendente'] }],
  );
  const [deadlineToDelete, setDeadlineToDelete] = useState<Deadline | null>(null);
  const [deadlineToComplete, setDeadlineToComplete] = useState<Deadline | null>(null);

  const caseOptions = useMemo(() =>
    cases.map((c) => ({ value: c.id, label: c.caseNumber ? `${c.caseNumber} — ${c.title}` : c.title })),
    [cases],
  );

  const getStatusColor = useCallback((status: string): string => {
    const map: Record<DeadlineStatus, string> = {
      'Pendente':  theme.colors.info,
      'Concluído': theme.colors.success,
      'Vencido':   theme.colors.danger,
      'Cancelado': theme.colors.textSecondary,
    };
    return map[status as DeadlineStatus] ?? theme.colors.textSecondary;
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

  const statusOptions = useMemo<FilterOption[]>(() =>
    (['Pendente', 'Concluído', 'Vencido', 'Cancelado'] as DeadlineStatus[]).map((s) => ({
      value: s, label: s, color: getStatusColor(s),
    })),
    [getStatusColor],
  );

  const priorityOptions = useMemo<FilterOption[]>(() =>
    (['Crítica', 'Alta', 'Média', 'Baixa'] as DeadlinePriority[]).map((p) => ({
      value: p, label: p, color: getPriorityColor(p),
    })),
    [getPriorityColor],
  );

  const typeOptions = useMemo<FilterOption[]>(() =>
    typeConfigs.map((t) => ({ value: t.key, label: t.label })),
    [typeConfigs],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Tipo, processo ou número...' },
    { key: 'status', label: 'Status', type: 'select', options: statusOptions },
    { key: 'priority', label: 'Prioridade', type: 'select', options: priorityOptions },
    ...(typeOptions.length > 0 ? [{ key: 'type', label: 'Tipo', type: 'select' as const, options: typeOptions }] : []),
    { key: 'case', label: 'Processo', type: 'select', options: caseOptions },
    ...customListing.filterDefs,
  ], [statusOptions, priorityOptions, typeOptions, caseOptions, customListing.filterDefs]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const isOverdue = useCallback((d: Deadline) => {
    if (d.status !== 'Pendente') return false;
    return d.dueDate.getTime() < Date.now();
  }, []);

  const isToday = useCallback((d: Deadline) => {
    const now = new Date();
    return (
      d.dueDate.getFullYear() === now.getFullYear() &&
      d.dueDate.getMonth() === now.getMonth() &&
      d.dueDate.getDate() === now.getDate()
    );
  }, []);

  const getDaysUntilDue = useCallback((d: Deadline): number => {
    const now = new Date();
    const due = new Date(d.dueDate);
    now.setHours(0, 0, 0, 0);
    due.setHours(0, 0, 0, 0);
    return Math.round((due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  }, []);

  const filteredDeadlines = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const statusFilter = tokenMap['status'] ?? [];
    const priorityFilter = tokenMap['priority'] ?? [];
    const typeFilter = tokenMap['type'] ?? [];
    const caseFilter = tokenMap['case'] ?? [];

    return [...deadlines]
      .filter((d) => {
        if (searchQ && !d.type.toLowerCase().includes(searchQ) &&
          !d.caseTitle.toLowerCase().includes(searchQ) &&
          !d.caseNumber.toLowerCase().includes(searchQ)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(d.status)) return false;
        if (priorityFilter.length > 0 && !priorityFilter.includes(d.priority)) return false;
        if (typeFilter.length > 0 && !typeFilter.includes(d.type)) return false;
        if (caseFilter.length > 0 && !caseFilter.includes(d.caseId)) return false;
        return customListing.matchesFilters(d.customValues, tokenMap);
      })
      .sort((a, b) => {
        const dateDiff = a.dueDate.getTime() - b.dueDate.getTime();
        if (dateDiff !== 0) return dateDiff;
        return PRIORITY_ORDER[b.priority as DeadlinePriority] - PRIORITY_ORDER[a.priority as DeadlinePriority];
      });
  }, [deadlines, tokenMap, customListing]);

  const openNewDeadline = useCallback(() => openTab('new-deadline'), [openTab]);
  const openDeadline = useCallback((d: Deadline) => openTab(`view-deadline:${d.id}`), [openTab]);
  const openCase = useCallback((caseId: string) => openTab(`view-case:${caseId}`), [openTab]);

  const handleDelete = useCallback((d: Deadline) => setDeadlineToDelete(d), []);

  const confirmDelete = useCallback(async () => {
    if (!deadlineToDelete) return;
    try {
      await deleteDeadline(deadlineToDelete.id);
      notify('Prazo excluído.', 'success');
    } catch {
      notify('Erro ao excluir prazo.', 'error');
    } finally {
      setDeadlineToDelete(null);
    }
  }, [deadlineToDelete, deleteDeadline, notify]);

  const cancelDelete = useCallback(() => setDeadlineToDelete(null), []);

  const handleComplete = useCallback((d: Deadline) => {
    setDeadlineToComplete(d);
  }, []);

  const confirmComplete = useCallback(async () => {
    if (!deadlineToComplete || !user) return;
    try {
      await completeDeadline(deadlineToComplete.id, user.id);
      notify('Prazo marcado como concluído.', 'success');
    } catch {
      notify('Erro ao concluir prazo.', 'error');
    } finally {
      setDeadlineToComplete(null);
    }
  }, [deadlineToComplete, completeDeadline, user, notify]);

  const cancelComplete = useCallback(() => setDeadlineToComplete(null), []);

  const getCustomFieldItems = useCallback(
    (d: Deadline): CustomFieldCardItem[] => customListing.cardItems(d.customValues),
    [customListing],
  );

  return {
    deadlines,
    filteredDeadlines,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'deadlines',
    deadlineToDelete,
    deadlineToComplete,
    caseOptions,
    setFilterTokens,
    openNewDeadline,
    openDeadline,
    openCase,
    handleDelete,
    confirmDelete,
    cancelDelete,
    handleComplete,
    confirmComplete,
    cancelComplete,
    isOverdue,
    isToday,
    getDaysUntilDue,
    getStatusColor,
    getPriorityColor,
    getCustomFieldItems,
  };
};
