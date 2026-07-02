import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { useFinancialLookup } from '../../../stores/useFinancialLookup';
import { useCaseStore } from '../../../stores/useCaseStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useContractStore } from '../../../stores/useContractStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { getConfigColor } from '../../../shared/styles/colorUtils';
import type { Financial, FinancialType } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface FinancialSummary {
  totalIncome: number;
  totalExpense: number;
  balance: number;
}

const toISODate = (d: Date): string => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const buildDefaultMonthTokens = (): FilterToken[] => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return [
    { key: 'dueDateFrom', values: [toISODate(start)] },
    { key: 'dueDateTo', values: [toISODate(end)] },
  ];
};

export interface FinancialsViewModel {
  financials: Financial[];
  filteredFinancials: Financial[];
  isLoading: boolean;
  summary: FinancialSummary;
  isSummaryVisible: boolean;
  toggleSummaryVisible: () => void;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  financialToDelete: Financial | null;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openCreateTab: () => void;
  openFinancial: (f: Financial) => void;
  openPerson: (personId: string | null | undefined) => void;
  openCase: (caseId: string | null | undefined) => void;
  openContract: (contractId: string | null | undefined) => void;
  handleDelete: (f: Financial) => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  handleMarkPaid: (f: Financial) => Promise<void>;
  handleCancelPayment: (f: Financial) => Promise<void>;
  handleRegisterCancellation: (f: Financial) => Promise<void>;
  formatAmount: (amount: number) => string;
  getStatusColor: (status: string) => string;
  getCardStatusColor: (f: Financial) => string;
  getTypeColor: (type: string) => string;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const useFinancialsViewModel = (): FinancialsViewModel => {
  const { financials, isLoading, deleteFinancial, markPaid, updateFinancialStatus, cancelFinancial } = useFinancialStore();
  const { statusConfigs } = useFinancialLookup();
  const { cases } = useCaseStore();
  const { persons } = usePersonStore();
  const { contracts } = useContractStore();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>(buildDefaultMonthTokens);
  const [isSummaryVisible, setIsSummaryVisible] = useState(true);
  const [financialToDelete, setFinancialToDelete] = useState<Financial | null>(null);

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

  const getStatusColor = useCallback((status: string): string => {
    return getConfigColor(statusConfigs, status, theme);
  }, [statusConfigs, theme]);

  const getCardStatusColor = useCallback((f: Financial): string => {
    if (f.status === 'Aberto' && f.dueDate.getTime() < Date.now()) return theme.colors.danger;
    return getConfigColor(statusConfigs, f.status, theme);
  }, [statusConfigs, theme]);

  const getTypeColor = useCallback((type: string): string => {
    return type === 'Receita' ? theme.colors.success : theme.colors.danger;
  }, [theme]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Categoria, pessoa, processo ou contrato...' },
    { key: 'type', label: 'Tipo', type: 'select', options: (['Receita', 'Despesa'] as FinancialType[]).map((t) => ({ value: t, label: t })) },
    {
      key: 'status', label: 'Status', type: 'select',
      options: statusConfigs.map((s) => ({ value: s.key, label: s.label, color: getConfigColor(statusConfigs, s.key, theme) })),
    },
    { key: 'case', label: 'Processo', type: 'select', options: caseOptions },
    { key: 'person', label: 'Pessoa', type: 'select', options: personOptions },
    { key: 'contract', label: 'Contrato', type: 'select', options: contractOptions },
    { key: 'dueDateFrom', label: 'Vencimento (de)', type: 'date' },
    { key: 'dueDateTo', label: 'Vencimento (até)', type: 'date' },
    { key: 'paymentDateFrom', label: 'Pagamento (de)', type: 'date' },
    { key: 'paymentDateTo', label: 'Pagamento (até)', type: 'date' },
    { key: 'periodFrom', label: 'Período (de)', type: 'date' },
    { key: 'periodTo', label: 'Período (até)', type: 'date' },
  ], [caseOptions, personOptions, contractOptions, statusConfigs, theme]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const formatAmount = useCallback((amount: number) => fmt.format(amount), []);

  const filteredFinancials = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const typeFilter = tokenMap['type'] ?? [];
    const statusFilter = tokenMap['status'] ?? [];
    const caseFilter = tokenMap['case'] ?? [];
    const personFilter = tokenMap['person'] ?? [];
    const contractFilter = tokenMap['contract'] ?? [];
    const dueDateStart = tokenMap['dueDateFrom']?.[0];
    const dueDateEnd = tokenMap['dueDateTo']?.[0];
    const paymentDateStart = tokenMap['paymentDateFrom']?.[0];
    const paymentDateEnd = tokenMap['paymentDateTo']?.[0];
    const periodStart = tokenMap['periodFrom']?.[0];
    const periodEnd = tokenMap['periodTo']?.[0];

    const dueDateStartAt = dueDateStart ? new Date(`${dueDateStart}T00:00:00`) : null;
    const dueDateEndAt = dueDateEnd ? new Date(`${dueDateEnd}T23:59:59`) : null;
    const paymentDateStartAt = paymentDateStart ? new Date(`${paymentDateStart}T00:00:00`) : null;
    const paymentDateEndAt = paymentDateEnd ? new Date(`${paymentDateEnd}T23:59:59`) : null;
    const periodStartAt = periodStart ? new Date(`${periodStart}T00:00:00`) : null;
    const periodEndAt = periodEnd ? new Date(`${periodEnd}T23:59:59`) : null;

    return [...financials]
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime())
      .filter((f) => {
        if (searchQ && !f.category.toLowerCase().includes(searchQ) &&
          !(f.personName?.toLowerCase().includes(searchQ)) &&
          !(f.caseNumber?.toLowerCase().includes(searchQ)) &&
          !(f.contractNumber?.toLowerCase().includes(searchQ))) return false;
        if (typeFilter.length > 0 && !typeFilter.includes(f.type)) return false;
        if (statusFilter.length > 0 && !statusFilter.includes(f.status)) return false;
        if (caseFilter.length > 0 && !caseFilter.includes(f.caseId ?? '')) return false;
        if (personFilter.length > 0 && !personFilter.includes(f.personId ?? '')) return false;
        if (contractFilter.length > 0 && !contractFilter.includes(f.contractId ?? '')) return false;
        if (dueDateStartAt && f.dueDate.getTime() < dueDateStartAt.getTime()) return false;
        if (dueDateEndAt && f.dueDate.getTime() > dueDateEndAt.getTime()) return false;
        if (paymentDateStartAt && (!f.paymentDate || f.paymentDate.getTime() < paymentDateStartAt.getTime())) return false;
        if (paymentDateEndAt && (!f.paymentDate || f.paymentDate.getTime() > paymentDateEndAt.getTime())) return false;
        if (periodStartAt) {
          const dueOk = f.dueDate.getTime() >= periodStartAt.getTime();
          const paidOk = !!f.paymentDate && f.paymentDate.getTime() >= periodStartAt.getTime();
          if (!dueOk && !paidOk) return false;
        }
        if (periodEndAt) {
          const dueOk = f.dueDate.getTime() <= periodEndAt.getTime();
          const paidOk = !!f.paymentDate && f.paymentDate.getTime() <= periodEndAt.getTime();
          if (!dueOk && !paidOk) return false;
        }
        return true;
      });
  }, [financials, tokenMap]);

  const summary = useMemo<FinancialSummary>(() => {
    const totalIncome = filteredFinancials.filter((f) => f.type === 'Receita' && f.status === 'Pago').reduce((s, f) => s + f.amount, 0);
    const totalExpense = filteredFinancials.filter((f) => f.type === 'Despesa' && f.status === 'Pago').reduce((s, f) => s + f.amount, 0);
    return { totalIncome, totalExpense, balance: totalIncome - totalExpense };
  }, [filteredFinancials]);

  const toggleSummaryVisible = useCallback(() => setIsSummaryVisible((prev) => !prev), []);

  const openCreateTab = useCallback(() => openTab('new-financial'), [openTab]);
  const openFinancial = useCallback((f: Financial) => openTab(`view-financial:${f.id}`), [openTab]);
  const openPerson = useCallback((personId: string | null | undefined) => { if (personId) openTab(`view-person:${personId}`); }, [openTab]);
  const openCase = useCallback((caseId: string | null | undefined) => { if (caseId) openTab(`view-case:${caseId}`); }, [openTab]);
  const openContract = useCallback((contractId: string | null | undefined) => { if (contractId) openTab(`view-contract:${contractId}`); }, [openTab]);

  const handleDelete = useCallback((f: Financial) => { setFinancialToDelete(f); }, []);

  const confirmDelete = useCallback(async () => {
    if (!financialToDelete) return;
    try {
      await deleteFinancial(financialToDelete.id);
      notify('Lançamento excluído.', 'success');
    } catch {
      notify('Erro ao excluir lançamento.', 'error');
    } finally {
      setFinancialToDelete(null);
    }
  }, [financialToDelete, deleteFinancial, notify]);

  const cancelDelete = useCallback(() => setFinancialToDelete(null), []);

  const handleMarkPaid = useCallback(async (f: Financial) => {
    try {
      await markPaid(f.id, new Date());
      notify('Pagamento registrado!', 'success');
    } catch {
      notify('Erro ao registrar pagamento.', 'error');
    }
  }, [markPaid, notify]);

  const handleCancelPayment = useCallback(async (f: Financial) => {
    try {
      await updateFinancialStatus(f.id, 'Aberto');
      notify('Pagamento cancelado.', 'success');
    } catch {
      notify('Erro ao cancelar pagamento.', 'error');
    }
  }, [updateFinancialStatus, notify]);

  const handleRegisterCancellation = useCallback(async (f: Financial) => {
    try {
      await cancelFinancial(f.id, new Date());
      notify('Cancelamento registrado.', 'success');
    } catch {
      notify('Erro ao registrar cancelamento.', 'error');
    }
  }, [cancelFinancial, notify]);

  return {
    financials,
    filteredFinancials,
    isLoading,
    summary,
    isSummaryVisible,
    toggleSummaryVisible,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'financials',
    financialToDelete,
    setFilterTokens,
    openCreateTab,
    openFinancial,
    openPerson,
    openCase,
    openContract,
    handleDelete,
    confirmDelete,
    cancelDelete,
    handleMarkPaid,
    handleCancelPayment,
    handleRegisterCancellation,
    formatAmount,
    getStatusColor,
    getCardStatusColor,
    getTypeColor,
  };
};
