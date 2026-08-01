import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { useFinancialStore } from '../../../stores/useFinancialStore';
import { CASES_COLLECTION, useCaseRecords } from '../../shared/useCollectionRecords';
import { useOpenRecord } from '../../shared/useOpenRecord';
import { useContractRecords, usePersonRecords } from '../../shared/useCollectionRecords';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useLookups } from '../../../stores/useLookups';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveListActions } from '../../shared/listActionCapabilities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import { useCustomFieldListing, CUSTOM_FIELD_FILTER_PREFIX } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { consumeNavigationIntent, setNavigationIntent, subscribeNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import { getConfigColor } from '../../../shared/styles/colorUtils';
import {
  buildDefaultMonthTokens,
  buildFinancialFilterDefs,
  buildTokenMap,
  computeFinancialSummary,
  filterFinancialsByTokens,
  type FinancialSummary,
} from '../../shared/financials/financialFilters';
import type { Financial, ScreenListAction } from '../../../domain/entities';
import type { FilterDef, FilterOption, FilterToken } from '../../components/ui/CompositeFilter';
import { useTagAdapter, useTagCollection } from '../../shared/entityScreen/useTagAdapter';
import { useTags } from '../../../stores/useTags';

export type { FinancialSummary };

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
  openFinancialDashboard: () => void;
  openFinancial: (f: Financial) => void;
  openPerson: (personId: string | null | undefined) => void;
  openCase: (caseId: string | null | undefined) => void;
  openContract: (contractId: string | null | undefined) => void;
  getPersonName: (f: Financial) => string | null;
  getCaseNumber: (f: Financial) => string | null;
  getContractNumber: (f: Financial) => string | null;
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
  getCustomFieldItems: (f: Financial) => CustomFieldCardItem[];
  listActions: ScreenListAction[];
  handleCopyLink: (f: Financial) => void;
  handleClone: (f: Financial) => void;
  tagManagerFinancial: Financial | null;
  setTagManagerFinancial: (f: Financial | null) => void;
  closeTagManager: () => void;
  tagAdapter: TagStoreAdapter;
}

const fmt = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export const useFinancialsViewModel = (): FinancialsViewModel => {
  const { financials, isLoading, deleteFinancial, updateFinancial, markPaid, updateFinancialStatus, cancelFinancial } = useFinancialStore();
  const { getTags } = useTags();
  const tags = getTags(useTagCollection('financials'));
  const { getOptions } = useLookups();
  const statusConfigs = getOptions('financialStatuses');
  const cases = useCaseRecords();
  const openRecord = useOpenRecord();
  const persons = usePersonRecords();
  const contracts = useContractRecords();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const { getScreenFieldsFor, getDefinition } = useScreenDefinitions();
  const theme = useTheme();

  const customFields = useMemo(() => getScreenFieldsFor('financials'), [getScreenFieldsFor]);
  const customListing = useCustomFieldListing(customFields, CUSTOM_FIELD_FILTER_PREFIX);

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>(
    () => consumeNavigationIntent('financials') as FilterToken[] | undefined ?? buildDefaultMonthTokens(),
  );
  const [isSummaryVisible, setIsSummaryVisible] = useState(false);
  const [financialToDelete, setFinancialToDelete] = useState<Financial | null>(null);

  useEffect(
    () => subscribeNavigationIntent('financials', (tokens) => setFilterTokens(tokens as FilterToken[])),
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

  const getStatusColor = useCallback((status: string): string => {
    return getConfigColor(statusConfigs, status, theme);
  }, [statusConfigs, theme]);

  const getCardStatusColor = useCallback((f: Financial): string => {
    if (f.status === 'Aberto' && f.dueDate.getTime() < Date.now()) return theme.colors.danger;
    return getConfigColor(statusConfigs, f.status, theme);
  }, [statusConfigs, theme]);

  const getTypeColor = useCallback((type: string): string => {
    return type === 'Receita' ? theme.colors.revenue : theme.colors.expense;
  }, [theme]);

  const filterDefs = useMemo<FilterDef[]>(
    () => [
      ...buildFinancialFilterDefs({ caseOptions, personOptions, contractOptions, tagOptions, statusConfigs, theme }),
      ...customListing.filterDefs,
    ],
    [caseOptions, personOptions, contractOptions, tagOptions, statusConfigs, theme, customListing.filterDefs],
  );

  const formatAmount = useCallback((amount: number) => fmt.format(amount), []);

  const filteredFinancials = useMemo(() => {
    const tokenMap = buildTokenMap(filterTokens);
    return filterFinancialsByTokens(financials, filterTokens, { cases, persons, contracts })
      .filter((f) => customListing.matchesFilters(f, tokenMap))
      .sort((a, b) => b.dueDate.getTime() - a.dueDate.getTime());
  }, [financials, filterTokens, customListing, cases, persons, contracts]);

  const personById = useMemo(() => {
    const map: Record<string, string> = {};
    persons.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [persons]);

  const caseById = useMemo(() => {
    const map: Record<string, string> = {};
    cases.forEach((c) => { map[c.id] = c.caseNumber; });
    return map;
  }, [cases]);

  const contractById = useMemo(() => {
    const map: Record<string, string> = {};
    contracts.forEach((c) => { map[c.id] = c.number; });
    return map;
  }, [contracts]);

  const getPersonName = useCallback((f: Financial): string | null => (f.personId ? (personById[f.personId] ?? null) : null), [personById]);
  const getCaseNumber = useCallback((f: Financial): string | null => (f.caseId ? (caseById[f.caseId] ?? null) : null), [caseById]);
  const getContractNumber = useCallback((f: Financial): string | null => (f.contractId ? (contractById[f.contractId] ?? null) : null), [contractById]);

  const summary = useMemo<FinancialSummary>(() => computeFinancialSummary(filteredFinancials), [filteredFinancials]);

  const toggleSummaryVisible = useCallback(() => setIsSummaryVisible((prev) => !prev), []);

  const openCreateTab = useCallback(() => openTab('new-financial'), [openTab]);
  const openFinancialDashboard = useCallback(() => {
    setNavigationIntent('financial-dashboard', filterTokens);
    openTab('financial-dashboard');
  }, [openTab, filterTokens]);
  const openFinancial = useCallback((f: Financial) => openTab(`view-financial:${f.id}`), [openTab]);

  const listActions = useMemo(
    () => resolveListActions('financials', getDefinition('financials')?.listActions),
    [getDefinition],
  );

  const handleCopyLink = useCallback((f: Financial) => {
    void navigator.clipboard.writeText(generateDeepLink(`view-financial:${f.id}`));
    notify('Link copiado para a área de transferência.', 'success');
  }, [notify]);

  const handleClone = useCallback((f: Financial) => openTab(`new-financial:clone:${f.id}`), [openTab]);

  const [tagManagerFinancial, setTagManagerFinancial] = useState<Financial | null>(null);
  const closeTagManager = useCallback(() => setTagManagerFinancial(null), []);

  const tagIdsOf = useCallback((entityId: string) => financials.find((f) => f.id === entityId)?.tagIds ?? [], [financials]);
  const setRecordTags = useCallback((entityId: string, tagIds: string[]) => updateFinancial(entityId, { tagIds }), [updateFinancial]);
  const tagAdapter = useTagAdapter('financials', tagIdsOf, setRecordTags);
  const openPerson = useCallback((personId: string | null | undefined) => { if (personId) openTab(`view-person:${personId}`); }, [openTab]);
  const openCase = useCallback((caseId: string | null | undefined) => { if (caseId) openRecord(CASES_COLLECTION, caseId); }, [openRecord]);
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

  const getCustomFieldItems = useCallback(
    (f: Financial): CustomFieldCardItem[] => customListing.cardItems(f),
    [customListing],
  );

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
    listActions,
    handleCopyLink,
    handleClone,
    tagManagerFinancial,
    setTagManagerFinancial,
    closeTagManager,
    tagAdapter,
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
    openFinancialDashboard,
    openFinancial,
    openPerson,
    openCase,
    openContract,
    getPersonName,
    getCaseNumber,
    getContractNumber,
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
    getCustomFieldItems,
  };
};
