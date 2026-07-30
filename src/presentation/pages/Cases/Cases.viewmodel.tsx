import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseTagStore } from '../../../stores/useCaseTagStore';
import { useContractStore } from '../../../stores/useContractStore';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useNotification } from '../../../stores/useNotification';
import { useLookups } from '../../../stores/useLookups';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveListActions } from '../../shared/listActionCapabilities';
import type { ScreenListAction } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import { useCustomFieldListing, CUSTOM_FIELD_FILTER_PREFIX } from '../../hooks/useCustomFieldListing';
import type { CustomFieldCardItem } from '../../hooks/useCustomFieldListing';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import { consumeNavigationIntent } from '../../../infrastructure/navigation/navigationIntent';
import type { Case } from '../../../domain/entities';
import type { FilterDef, FilterToken, FilterOption } from '../../components/ui/CompositeFilter';

const parseBRDate = (s: string): Date | null => {
  if (!s.trim()) return null;
  const parts = s.trim().split('/');
  if (parts.length !== 3) return null;
  const [d, m, y] = parts;
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  return isNaN(date.getTime()) ? null : date;
};

export interface CasesViewModel {
  cases: Case[];
  filteredCases: Case[];
  isLoading: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  isAdmin: boolean;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openNewCase: () => void;
  openCase: (c: Case) => void;
  listActions: ScreenListAction[];
  handleCopyLink: (c: Case) => void;
  handleClone: (c: Case) => void;
  tagManagerCase: Case | null;
  setTagManagerCase: (c: Case | null) => void;
  closeTagManager: () => void;
  tagAdapter: TagStoreAdapter;
  caseToDelete: Case | null;
  setCaseToDelete: (c: Case | null) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  getStatusColor: (status: string) => string;
  getPhaseColor: (phase: string) => string;
  getPartyNames: (ids: string[]) => string[];
  getDaysInTramitation: (c: Case) => number | null;
  getCustomFieldItems: (c: Case) => CustomFieldCardItem[];
}

export const useCasesViewModel = (): CasesViewModel => {
  const { cases, isLoading, deleteCase } = useCaseStore();
  const { tags, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag } = useCaseTagStore();
  const { contracts } = useContractStore();
  const { persons } = usePersonStore();
  const { tenantRole } = useTenant();
  const { getOptions } = useLookups();
  const areaConfigs = getOptions('caseAreas');
  const phaseConfigs = getOptions('casePhases');
  const statusConfigs = getOptions('caseStatuses');
  const instanceConfigs = getOptions('caseInstances');
  const actionTypeConfigs = getOptions('caseActionTypes');
  const courtConfigs = getOptions('caseCourts');
  const districtConfigs = getOptions('caseDistricts');
  const judgeConfigs = getOptions('caseJudges');
  const { openTab } = useWorkspace();
  const { getScreenFieldsFor, getDefinition } = useScreenDefinitions();
  const { notify } = useNotification();
  const theme = useTheme();

  const customFields = useMemo(() => getScreenFieldsFor('cases'), [getScreenFieldsFor]);
  const customListing = useCustomFieldListing(customFields, CUSTOM_FIELD_FILTER_PREFIX);

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>(
    () => consumeNavigationIntent('cases') as FilterToken[] | undefined ?? [],
  );

  const isAdmin = tenantRole === 'admin';

  const tagOptions = useMemo<FilterOption[]>(() =>
    tags.map((t) => ({ value: t.id, label: t.name, color: t.color })),
    [tags],
  );

  const areaOptions = useMemo<FilterOption[]>(() =>
    areaConfigs.map((a) => ({ value: a.key, label: a.label })),
    [areaConfigs],
  );

  const phaseOptions = useMemo<FilterOption[]>(() =>
    phaseConfigs.map((p) => ({ value: p.key, label: p.label, color: resolveColor(p.color, theme) })),
    [phaseConfigs, theme],
  );

  const instanceOptions = useMemo<FilterOption[]>(() =>
    instanceConfigs.map((i) => ({ value: i.key, label: i.label })),
    [instanceConfigs],
  );

  const statusOptions = useMemo<FilterOption[]>(() =>
    statusConfigs.map((s) => ({ value: s.key, label: s.label, color: resolveColor(s.color, theme) })),
    [statusConfigs, theme],
  );

  const actionTypeOptions = useMemo<FilterOption[]>(() =>
    actionTypeConfigs.map((a) => ({ value: a.key, label: a.label })),
    [actionTypeConfigs],
  );

  const courtOptions = useMemo<FilterOption[]>(() =>
    courtConfigs.map((c) => ({ value: c.key, label: c.label })),
    [courtConfigs],
  );

  const districtOptions = useMemo<FilterOption[]>(() =>
    districtConfigs.map((d) => ({ value: d.key, label: d.label })),
    [districtConfigs],
  );

  const judgeOptions = useMemo<FilterOption[]>(() =>
    judgeConfigs.map((j) => ({ value: j.key, label: j.label })),
    [judgeConfigs],
  );

  const personOptions = useMemo<FilterOption[]>(() =>
    persons
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
  );

  const contractOptions = useMemo<FilterOption[]>(() =>
    contracts
      .map((c) => ({ value: c.id, label: `${c.number} — ${c.title}` }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [contracts],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Título, número...' },
    ...(personOptions.length > 0 ? [{ key: 'parties', label: 'Partes', type: 'select' as const, options: personOptions }] : []),
    { key: 'status', label: 'Status', type: 'select', options: statusOptions },
    { key: 'area', label: 'Área', type: 'select', options: areaOptions },
    ...(actionTypeOptions.length > 0 ? [{ key: 'type', label: 'Tipo de Ação', type: 'select' as const, options: actionTypeOptions }] : []),
    { key: 'phase', label: 'Fase Processual', type: 'select', options: phaseOptions },
    { key: 'instance', label: 'Instância', type: 'select', options: instanceOptions },
    ...(courtOptions.length > 0 ? [{ key: 'court', label: 'Vara/Tribunal', type: 'select' as const, options: courtOptions }] : []),
    ...(districtOptions.length > 0 ? [{ key: 'district', label: 'Comarca', type: 'select' as const, options: districtOptions }] : []),
    ...(judgeOptions.length > 0 ? [{ key: 'judge', label: 'Juiz', type: 'select' as const, options: judgeOptions }] : []),
    { key: 'filedAtFrom', label: 'Distribuição (de)', type: 'text', placeholder: 'dd/mm/aaaa' },
    { key: 'filedAtTo', label: 'Distribuição (até)', type: 'text', placeholder: 'dd/mm/aaaa' },
    ...(personOptions.length > 0 ? [{ key: 'lawyer', label: 'Advogado', type: 'select' as const, options: personOptions }] : []),
    ...(contractOptions.length > 0 ? [{ key: 'contract', label: 'Contrato', type: 'select' as const, options: contractOptions }] : []),
    ...(tagOptions.length > 0 ? [{ key: 'tag', label: 'Etiqueta', type: 'select' as const, options: tagOptions }] : []),
    ...customListing.filterDefs,
  ], [statusOptions, areaOptions, phaseOptions, instanceOptions, actionTypeOptions, courtOptions, districtOptions, judgeOptions, contractOptions, tagOptions, personOptions, customListing.filterDefs]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredCases = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const statusFilter = tokenMap['status'] ?? [];
    const areaFilter = tokenMap['area'] ?? [];
    const typeFilter = tokenMap['type'] ?? [];
    const phaseFilter = tokenMap['phase'] ?? [];
    const instanceFilter = tokenMap['instance'] ?? [];
    const courtFilter = tokenMap['court'] ?? [];
    const districtFilter = tokenMap['district'] ?? [];
    const judgeFilter = tokenMap['judge'] ?? [];
    const filedAtFromStr = tokenMap['filedAtFrom']?.[0] ?? '';
    const filedAtToStr = tokenMap['filedAtTo']?.[0] ?? '';
    const lawyerFilter = tokenMap['lawyer'] ?? [];
    const contractFilter = tokenMap['contract'] ?? [];
    const tagFilter = tokenMap['tag'] ?? [];
    const partiesFilter = tokenMap['parties'] ?? [];

    const filedAtFrom = parseBRDate(filedAtFromStr);
    const filedAtToRaw = parseBRDate(filedAtToStr);
    const filedAtTo = filedAtToRaw
      ? new Date(filedAtToRaw.getFullYear(), filedAtToRaw.getMonth(), filedAtToRaw.getDate() + 1)
      : null;

    return cases.filter((c) => {
      if (searchQ && !c.title.toLowerCase().includes(searchQ) &&
        !c.caseNumber.toLowerCase().includes(searchQ)) return false;
      if (statusFilter.length > 0 && !statusFilter.includes(c.status)) return false;
      if (areaFilter.length > 0 && !areaFilter.includes(c.area)) return false;
      if (typeFilter.length > 0 && !typeFilter.some((t) => (c.type ?? []).includes(t))) return false;
      if (phaseFilter.length > 0 && !phaseFilter.includes(c.phase)) return false;
      if (instanceFilter.length > 0 && (c.instance == null || !instanceFilter.includes(c.instance))) return false;
      if (courtFilter.length > 0 && !courtFilter.includes(c.court ?? '')) return false;
      if (districtFilter.length > 0 && !districtFilter.includes(c.courtDistrict ?? '')) return false;
      if (judgeFilter.length > 0 && !judgeFilter.includes(c.judge ?? '')) return false;
      if (lawyerFilter.length > 0 && !lawyerFilter.includes(c.responsibleLawyerId ?? '')) return false;
      if (contractFilter.length > 0 && !contractFilter.includes(c.contractId ?? '')) return false;
      if (tagFilter.length > 0 && !tagFilter.some((tid) => c.tagIds?.includes(tid))) return false;
      if (partiesFilter.length > 0 && !partiesFilter.some((id) =>
        (c.activePoleIds ?? []).includes(id) || (c.passivePoleIds ?? []).includes(id)
      )) return false;
      if (filedAtFrom && (!c.filedAt || c.filedAt < filedAtFrom)) return false;
      if (filedAtTo && (!c.filedAt || c.filedAt >= filedAtTo)) return false;
      return customListing.matchesFilters(c, tokenMap);
    });
  }, [cases, tokenMap, customListing]);

  const personMap = useMemo(() => {
    const map: Record<string, string> = {};
    persons.forEach((p) => { map[p.id] = p.name; });
    return map;
  }, [persons]);

  const getPartyNames = useCallback((ids: string[]): string[] =>
    ids.map((id) => personMap[id]).filter(Boolean) as string[],
    [personMap],
  );

  const today = useMemo(() => new Date(), []);

  const getDaysInTramitation = useCallback((c: Case): number | null => {
    if (!c.filedAt) return null;
    const diff = today.getTime() - c.filedAt.getTime();
    return Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
  }, [today]);

  const openNewCase = useCallback(() => openTab('new-case'), [openTab]);
  const openCase = useCallback((c: Case) => openTab(`view-case:${c.id}`), [openTab]);

  const listActions = useMemo(
    () => resolveListActions('cases', getDefinition('cases')?.listActions),
    [getDefinition],
  );

  const handleCopyLink = useCallback((c: Case) => {
    void navigator.clipboard.writeText(generateDeepLink(`view-case:${c.id}`));
    notify('Link copiado para a área de transferência.', 'success');
  }, [notify]);

  const handleClone = useCallback((c: Case) => openTab(`new-case:clone:${c.id}`), [openTab]);

  const [tagManagerCase, setTagManagerCase] = useState<Case | null>(null);
  const closeTagManager = useCallback(() => setTagManagerCase(null), []);

  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);
  const cancelDelete = useCallback(() => setCaseToDelete(null), []);
  const confirmDelete = useCallback(async () => {
    if (!caseToDelete) return;
    try {
      // Passa pelo store para manter a cascata de anotações/documentos do detalhe.
      await deleteCase(caseToDelete.id);
      notify('Registro excluído.', 'success');
    } catch {
      notify('Erro ao excluir o processo.', 'error');
    } finally {
      setCaseToDelete(null);
    }
  }, [caseToDelete, deleteCase, notify]);

  const tagAdapter = useMemo<TagStoreAdapter>(() => ({
    tags,
    getAppliedTags: (entityId: string) => {
      const target = cases.find((c) => c.id === entityId);
      return getTagsForCase(entityId, target?.tagIds ?? []);
    },
    setTags: (entityId: string, tagIds: string[]) => setTagsForCase(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, cases, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag]);

  const getStatusColor = useCallback((status: string): string => {
    return getConfigColor(statusConfigs, status, theme);
  }, [statusConfigs, theme]);

  const getPhaseColor = useCallback((phase: string): string => {
    return getConfigColor(phaseConfigs, phase, theme);
  }, [phaseConfigs, theme]);

  const getCustomFieldItems = useCallback(
    (c: Case): CustomFieldCardItem[] => customListing.cardItems(c),
    [customListing],
  );

  return {
    listActions,
    handleCopyLink,
    handleClone,
    tagManagerCase,
    setTagManagerCase,
    closeTagManager,
    tagAdapter,
    caseToDelete,
    setCaseToDelete,
    cancelDelete,
    confirmDelete,
    cases,
    filteredCases,
    isLoading,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'cases',
    isAdmin,
    setFilterTokens,
    openNewCase,
    openCase,
    getStatusColor,
    getPhaseColor,
    getPartyNames,
    getDaysInTramitation,
    getCustomFieldItems,
  };
};
