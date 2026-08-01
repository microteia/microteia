import { useState, useEffect, useMemo, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useAuditLogStore } from '../../../stores/useAuditLogStore';
import { useAuditLogAlert } from '../../../stores/useAuditLogAlert';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useDI } from '../../../infrastructure/di/useDI';
import { useOpenRecord } from '../../shared/useOpenRecord';
import { makeGetAllTenantsUseCase } from '../../../domain/usecases/tenants/GetAllTenantsUseCase';
import type { AuditLog, AuditAction, AuditSeverity, Tenant } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';
import { ENTITY_LABELS, ACTION_LABELS, SEVERITY_LABELS } from './auditLogLabels';
import { severityColor, actionColor } from './AuditLogCard/AuditLogCard.styles';

const MY_OFFICE = 'MY_OFFICE';
const ALL_OFFICES = 'ALL_OFFICES';

export interface AuditLogRow {
  log: AuditLog;
  expanded: boolean;
  tenantName: string | null;
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
  const { userRole } = useAuth();
  const { currentTenant, tenantRole } = useTenant();
  const { openTab } = useWorkspace();
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
    () => Object.entries(ENTITY_LABELS).map(([value, label]) => ({ value, label })),
    [],
  );

  const actionOptions = useMemo<FilterDef['options']>(
    () => Object.entries(ACTION_LABELS).map(([value, label]) => ({
      value,
      label,
      color: actionColor(theme, value as AuditAction),
    })),
    [theme],
  );

  const severityOptions = useMemo<FilterDef['options']>(
    () => Object.entries(SEVERITY_LABELS).map(([value, label]) => ({
      value,
      label,
      color: severityColor(theme, value as AuditSeverity),
    })),
    [theme],
  );

  const tenantScopeOptions = useMemo<FilterDef['options']>(() => [
    { value: MY_OFFICE, label: 'Meu Escritório' },
    { value: ALL_OFFICES, label: 'Todos os Escritórios' },
    ...allTenants.map((t) => ({ value: t.id, label: t.name })),
  ], [allTenants]);

  const filterDefs = useMemo<FilterDef[]>(() => {
    const defs: FilterDef[] = [
      { key: 'search', label: 'Busca', type: 'text', placeholder: 'Título ou conteúdo...' },
      { key: 'entity', label: 'Entidade', type: 'select', options: entityOptions },
      { key: 'action', label: 'Ação', type: 'select', options: actionOptions },
      { key: 'severity', label: 'Severidade', type: 'select', options: severityOptions },
    ];
    if (isSystem) {
      defs.push({ key: 'tenantScope', label: 'Escritório', type: 'select', options: tenantScopeOptions });
    }
    return defs;
  }, [entityOptions, actionOptions, severityOptions, tenantScopeOptions, isSystem]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
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

    return logs
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
      }));
  }, [logs, tokenMap, expandedIds, isSystem, tenantsById]);

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
