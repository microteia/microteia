import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useAuditLogStore } from '../../../stores/useAuditLogStore';
import { useAuditLogAlert } from '../../../stores/useAuditLogAlert';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useDI } from '../../../infrastructure/di/useDI';
import { useOpenRecord } from '../../shared/useOpenRecord';
import { makeGetAllTenantsUseCase } from '../../../domain/usecases/tenants/GetAllTenantsUseCase';
import type { AuditLog, AuditAction, AuditSeverity, Tenant } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { entityLabel, entityFilterOptions, ACTION_KEYS, SEVERITY_KEYS } from './auditLogLabels';
import { severityColor, actionColor } from './AuditLogCard/AuditLogCard.styles';

import { useT, useLabel } from '../../shared/i18n/useT';
const MY_OFFICE = 'MY_OFFICE';
const ALL_OFFICES = 'ALL_OFFICES';

export interface AuditLogRow {
  log: AuditLog;
  expanded: boolean;
  tenantName: string | null;
  entityLabel: string;
}

export interface AuditLogsViewModel {
  isUnauthorized: boolean;
  rows: AuditLogRow[];
  loading: boolean;
  hasMore: boolean;
  error: string | null;
  isSystem: boolean;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  setFilterTokens: (tokens: FilterToken[]) => void;
  toggleExpand: (id: string) => void;
  loadMore: () => void;
  openEntity: (log: AuditLog) => void;
}

export const useAuditLogsViewModel = (): AuditLogsViewModel => {
  const t = useT('core.admin');
  const label = useLabel();
  const { userRole } = useAuth();
  const { currentTenant, tenantRole } = useTenant();
  const { openTab } = useWorkspace();
  const { dynamicScreens } = useScreenDefinitions();
  const openRecord = useOpenRecord();
  const { tenantRepository } = useDI();
  const { logs, loading, hasMore, error, search, loadMore } = useAuditLogStore();
  const { markAllAsRead } = useAuditLogAlert();
  const theme = useTheme();

  const isSystem = userRole === 'SYSTEM';
  const isTenantAdmin = tenantRole === 'admin';
  const isUnauthorized = !isSystem && !isTenantAdmin;

  const [allTenants, setAllTenants] = useState<Tenant[]>([]);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);

  useEffect(() => {
    if (!isSystem) return;
    const getAllTenants = makeGetAllTenantsUseCase(tenantRepository);
    getAllTenants.execute().then(setAllTenants).catch(() => setAllTenants([]));
  }, [isSystem, tenantRepository]);

  const tenantsById = useMemo(() => {
    const map = new Map<string, Tenant>();
    allTenants.forEach((t) => map.set(t.id, t));
    return map;
  }, [allTenants]);

  const entityOptions = useMemo<FilterDef['options']>(
    () => entityFilterOptions(t, label, dynamicScreens),
    [dynamicScreens, t, label],
  );

  const actionOptions = useMemo<FilterDef['options']>(
    () => Object.entries(ACTION_KEYS).map(([value, key]) => ({
      value,
      label: t(key),
      color: actionColor(theme, value as AuditAction),
    })),
    [theme, t],
  );

  const severityOptions = useMemo<FilterDef['options']>(
    () => Object.entries(SEVERITY_KEYS).map(([value, key]) => ({
      value,
      label: t(key),
      color: severityColor(theme, value as AuditSeverity),
    })),
    [theme, t],
  );

  const tenantScopeOptions = useMemo<FilterDef['options']>(() => [
    { value: MY_OFFICE, label: t('audit.scope.mine') },
    { value: ALL_OFFICES, label: t('audit.scope.all') },
    ...allTenants.map((tenant) => ({ value: tenant.id, label: tenant.name })),
  ], [allTenants, t]);

  const filterDefs = useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [
      {
        key: 'search',
        label: t('core.ui/filter.search'),
        type: 'text',
        placeholder: t('audit.filter.search.placeholder'),
      },
      { key: 'entity', label: t('audit.filter.entity'), type: 'select', options: entityOptions },
      { key: 'action', label: t('audit.filter.action'), type: 'select', options: actionOptions },
      { key: 'severity', label: t('audit.filter.severity'), type: 'select', options: severityOptions },
    ];
    if (isSystem) {
      defs.push({
        key: 'tenantScope',
        label: t('audit.filter.tenant'),
        type: 'select',
        options: tenantScopeOptions,
      });
    }
    return defs;
  }, [entityOptions, actionOptions, severityOptions, tenantScopeOptions, isSystem, t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  // Só o escopo de tenant muda a query do Firestore — entidade/ação/severidade/busca são
  // aplicados client-side sobre a página já carregada (ver `rows` abaixo), para não exigir
  // um índice composto do Firestore por combinação de filtro.
  const resolvedTenantId = useMemo(() => {
    const scope = tokenMap['tenantScope']?.[0] ?? MY_OFFICE;
    if (!isSystem) return currentTenant?.id ?? null;
    if (scope === ALL_OFFICES) return null;
    if (scope === MY_OFFICE) return currentTenant?.id ?? null;
    return scope;
  }, [isSystem, tokenMap, currentTenant]);

  useEffect(() => {
    if (isUnauthorized) return;
    void search({ tenantId: resolvedTenantId });
  }, [resolvedTenantId, isUnauthorized, search]);

  // Abrir a tela de Auditoria marca as falhas CRITICAL do escritório atual como lidas,
  // zerando o badge no WorkspaceSidebar (ver AuditLogAlertStore).
  useEffect(() => {
    if (isUnauthorized || !currentTenant) return;
    void markAllAsRead();
  }, [isUnauthorized, currentTenant, markAllAsRead]);

  const rows = useMemo<AuditLogRow[]>(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const entityFilter = tokenMap['entity']?.[0];
    const actionFilter = tokenMap['action']?.[0] as AuditAction | undefined;
    const severityFilter = tokenMap['severity']?.[0] as AuditSeverity | undefined;

    // Resolve ANTES de filtrar: a busca passa a comparar com o texto que está na tela, e não com a
    // chave. Log antigo guarda a frase pronta e atravessa `resolveLabel` intacto.
    return logs
      .map((log) => ({
        ...log,
        title: label(log.title, log.titleParams),
        text: label(log.text, log.textParams),
      }))
      .filter((log) => {
        if (entityFilter && log.entity !== entityFilter) return false;
        if (actionFilter && log.action !== actionFilter) return false;
        if (severityFilter && log.severity !== severityFilter) return false;
        if (searchQ && !log.title.toLowerCase().includes(searchQ) && !log.text.toLowerCase().includes(searchQ)) return false;
        return true;
      })
      .map((log) => ({
        log,
        expanded: expandedIds.has(log.id),
        tenantName: isSystem ? (tenantsById.get(log.tenantId)?.name ?? null) : null,
        entityLabel: entityLabel(t, label, log.entity, dynamicScreens),
      }));
  }, [logs, tokenMap, expandedIds, isSystem, tenantsById, dynamicScreens, label, t]);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  /**
   * O registro é aberto pela COLEÇÃO, resolvida no clique — a tela que a apresenta pode ter mudado
   * desde que o log foi gravado, e uma entidade que saiu do kernel mudou de aba (`view-person:`
   * virou `view-dyn:pessoas:`). `entityLink` é a chave fixa dos logs anteriores a isto.
   */
  const openEntity = useCallback((log: AuditLog) => {
    if (log.linkCollection && log.linkRecordId) {
      openRecord(log.linkCollection, log.linkRecordId);
      return;
    }
    if (log.entityLink) openTab(log.entityLink);
  }, [openRecord, openTab]);

  return {
    isUnauthorized,
    rows,
    loading,
    hasMore,
    error,
    isSystem,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'audit-logs',
    setFilterTokens,
    toggleExpand,
    loadMore,
    openEntity,
  };
};
