import { useState, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseTagStore } from '../../../stores/useCaseTagStore';
import { useCaseLookup } from '../../../stores/useCaseLookup';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
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
  getStatusColor: (status: string) => string;
  getPhaseColor: (phase: string) => string;
  getPartyNames: (ids: string[]) => string[];
  getDaysInTramitation: (c: Case) => number | null;
}

export const useCasesViewModel = (): CasesViewModel => {
  const { cases, isLoading } = useCaseStore();
  const { tags } = useCaseTagStore();
  const { persons } = usePersonStore();
  const { tenantRole, members } = useTenant();
  const { areaConfigs, phaseConfigs, statusConfigs, instanceConfigs, actionTypeConfigs, courtConfigs, districtConfigs, judgeConfigs } = useCaseLookup();
  const { openTab } = useWorkspace();
  const theme = useTheme();

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

  const lawyerOptions = useMemo<FilterOption[]>(() =>
    members
      .filter((m) => m.role === 'admin' || m.role === 'lawyer')
      .map((m) => ({ value: m.userId, label: m.displayName }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [members],
  );

  const personOptions = useMemo<FilterOption[]>(() =>
    persons
      .map((p) => ({ value: p.id, label: p.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
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
    ...(lawyerOptions.length > 0 ? [{ key: 'lawyer', label: 'Advogado', type: 'select' as const, options: lawyerOptions }] : []),
    ...(tagOptions.length > 0 ? [{ key: 'tag', label: 'Etiqueta', type: 'select' as const, options: tagOptions }] : []),
  ], [statusOptions, areaOptions, phaseOptions, instanceOptions, actionTypeOptions, courtOptions, districtOptions, judgeOptions, lawyerOptions, tagOptions, personOptions]);

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
      if (typeFilter.length > 0 && !typeFilter.includes(c.type ?? '')) return false;
      if (phaseFilter.length > 0 && !phaseFilter.includes(c.phase)) return false;
      if (instanceFilter.length > 0 && (c.instance == null || !instanceFilter.includes(c.instance))) return false;
      if (courtFilter.length > 0 && !courtFilter.includes(c.court ?? '')) return false;
      if (districtFilter.length > 0 && !districtFilter.includes(c.courtDistrict ?? '')) return false;
      if (judgeFilter.length > 0 && !judgeFilter.includes(c.judge ?? '')) return false;
      if (lawyerFilter.length > 0 && !lawyerFilter.includes(c.responsibleLawyerId)) return false;
      if (tagFilter.length > 0 && !tagFilter.some((tid) => c.tagIds?.includes(tid))) return false;
      if (partiesFilter.length > 0 && !partiesFilter.some((id) =>
        (c.activePoleIds ?? []).includes(id) || (c.passivePoleIds ?? []).includes(id)
      )) return false;
      if (filedAtFrom && (!c.filedAt || c.filedAt < filedAtFrom)) return false;
      if (filedAtTo && (!c.filedAt || c.filedAt >= filedAtTo)) return false;
      return true;
    });
  }, [cases, tokenMap]);

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

  const getStatusColor = useCallback((status: string): string => {
    return getConfigColor(statusConfigs, status, theme);
  }, [statusConfigs, theme]);

  const getPhaseColor = useCallback((phase: string): string => {
    return getConfigColor(phaseConfigs, phase, theme);
  }, [phaseConfigs, theme]);

  return {
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
  };
};
