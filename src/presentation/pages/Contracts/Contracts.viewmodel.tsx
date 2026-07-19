import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useContractStore } from '../../../stores/useContractStore';
import { useContractTagStore } from '../../../stores/useContractTagStore';
import { useContractLookup } from '../../../stores/useContractLookup';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useNotification } from '../../../stores/useNotification';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveListActions } from '../../shared/listActionCapabilities';
import type { ScreenListAction } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import { useCustomFieldListing, CUSTOM_FIELD_FILTER_PREFIX } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import type { Contract } from '../../../domain/entities';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

export interface ContractsViewModel {
  contracts: Contract[];
  filteredContracts: Contract[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  isAdmin: boolean;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewContract: () => void;
  openContract: (c: Contract) => void;
  listActions: ScreenListAction[];
  handleCopyLink: (c: Contract) => void;
  handleClone: (c: Contract) => void;
  tagManagerContract: Contract | null;
  setTagManagerContract: (c: Contract | null) => void;
  closeTagManager: () => void;
  tagAdapter: TagStoreAdapter;
  contractToDelete: Contract | null;
  setContractToDelete: (c: Contract | null) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  getStatusColor: (status: string) => string;
  getPersonNames: (ids: string[]) => string[];
  getCustomFieldItems: (c: Contract) => CustomFieldCardItem[];
}

export const useContractsViewModel = (): ContractsViewModel => {
  const { contracts, isLoading, deleteContract } = useContractStore();
  const { tags, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag } = useContractTagStore();
  const { persons } = usePersonStore();
  const { tenantRole } = useTenant();
  const { typeConfigs, categoryConfigs, statusConfigs } = useContractLookup();
  const { openTab } = useWorkspace();
  const { getCustomFieldsFor, getDefinition } = useScreenDefinitions();
  const { notify } = useNotification();
  const theme = useTheme();

  const customFields = useMemo(() => getCustomFieldsFor('contracts'), [getCustomFieldsFor]);
  const customListing = useCustomFieldListing('contracts', customFields, CUSTOM_FIELD_FILTER_PREFIX);

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  const isAdmin = tenantRole === 'admin';

  const tagOptions = useMemo<FilterOption[]>(() =>
    tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const statusOptions = useMemo<FilterOption[]>(() =>
    statusConfigs.map((s) => ({ value: s.key, label: s.label, color: resolveColor(s.color, theme) })),
    [statusConfigs, theme],
  );

  const typeOptions = useMemo<FilterOption[]>(() =>
    typeConfigs.map((t) => ({ value: t.key, label: t.label })),
    [typeConfigs],
  );

  const categoryOptions = useMemo<FilterOption[]>(() =>
    categoryConfigs.map((c) => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );

  const personOptions = useMemo<FilterOption[]>(() =>
    persons
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Número, título...' },
    { key: 'status', label: 'Status', type: 'select', options: statusOptions },
    { key: 'type', label: 'Tipo', type: 'select', options: typeOptions },
    { key: 'category', label: 'Categoria', type: 'select', options: categoryOptions },
    ...(personOptions.length > 0 ? [{ key: 'client', label: 'Cliente', type: 'select' as const, options: personOptions }] : []),
    ...(personOptions.length > 0 ? [{ key: 'parties', label: 'Contratante/Contratado', type: 'select' as const, options: personOptions }] : []),
    ...(tagOptions.length > 0 ? [{ key: 'tag', label: 'Etiqueta', type: 'select' as const, options: tagOptions }] : []),
    ...customListing.filterDefs,
  ], [statusOptions, typeOptions, categoryOptions, personOptions, tagOptions, customListing.filterDefs]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredContracts = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const statusFilter = tokenMap['status'] ?? [];
    const typeFilter = tokenMap['type'] ?? [];
    const categoryFilter = tokenMap['category'] ?? [];
    const clientFilter = tokenMap['client'] ?? [];
    const partiesFilter = tokenMap['parties'] ?? [];
    const tagFilter = tokenMap['tag'] ?? [];

    return contracts.filter((c) => {
      if (searchQ && !c.title.toLowerCase().includes(searchQ) &&
        !c.number.toLowerCase().includes(searchQ)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
      if (typeFilter.length > 0 && !typeFilter.includes(c.type)) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(c.category)) return false;
      if (clientFilter.length > 0 && !clientFilter.includes(c.clientId ?? '')) return false;
      if (partiesFilter.length > 0 && !partiesFilter.some((id) =>
        c.contractorIds.includes(id) || c.contracteeIds.includes(id)
      )) return false;
      if (tagFilter.length > 0 && !tagFilter.some((tid) => c.tagIds?.includes(tid))) return false;
      return customListing.matchesFilters(c.customValues, tokenMap);
    });
  }, [contracts, tokenMap, customListing]);

  const personMap = useMemo(() => {
    const map: Record<string, string> = {};
    persons.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [persons]);

  const getPersonNames = useCallback((ids: string[]): string[] =>
    ids.map((id) => personMap[id]).filter(Boolean) as string[],
    [personMap],
  );

  const openNewContract = useCallback(() => openTab('new-contract'), [openTab]);
  const openContract = useCallback((c: Contract) => openTab(`view-contract:${c.id}`), [openTab]);

  const listActions = useMemo(
    () => resolveListActions('contracts', getDefinition('contracts')?.listActions),
    [getDefinition],
  );

  const handleCopyLink = useCallback((c: Contract) => {
    void navigator.clipboard.writeText(generateDeepLink(`view-contract:${c.id}`));
    notify('Link copiado para a área de transferência.', 'success');
  }, [notify]);

  const handleClone = useCallback((c: Contract) => openTab(`new-contract:clone:${c.id}`), [openTab]);

  const [tagManagerContract, setTagManagerContract] = useState<Contract | null>(null);
  const closeTagManager = useCallback(() => setTagManagerContract(null), []);

  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);
  const cancelDelete = useCallback(() => setContractToDelete(null), []);
  const confirmDelete = useCallback(async () => {
    if (!contractToDelete) return;
    try {
      // Passa pelo store para manter a cascata de anotações/documentos do detalhe.
      await deleteContract(contractToDelete.id);
      notify('Registro excluído.', 'success');
    } catch {
      notify('Erro ao excluir o contrato.', 'error');
    } finally {
      setContractToDelete(null);
    }
  }, [contractToDelete, deleteContract, notify]);

  const tagAdapter = useMemo<TagStoreAdapter>(() => ({
    tags,
    getAppliedTags: (entityId: string) => {
      const target = contracts.find((c) => c.id === entityId);
      return getTagsForContract(entityId, target?.tagIds ?? []);
    },
    setTags: (entityId: string, tagIds: string[]) => setTagsForContract(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, contracts, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag]);

  const getStatusColor = useCallback((status: string): string => {
    return getConfigColor(statusConfigs, status, theme);
  }, [statusConfigs, theme]);

  const getCustomFieldItems = useCallback(
    (c: Contract): CustomFieldCardItem[] => customListing.cardItems(c.customValues),
    [customListing],
  );

  return {
    listActions,
    handleCopyLink,
    handleClone,
    tagManagerContract,
    setTagManagerContract,
    closeTagManager,
    tagAdapter,
    contractToDelete,
    setContractToDelete,
    cancelDelete,
    confirmDelete,
    contracts,
    filteredContracts,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'contracts',
    isAdmin,
    setFilterTokens,
    openNewContract,
    openContract,
    getStatusColor,
    getPersonNames,
    getCustomFieldItems,
  };
};
