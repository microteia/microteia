import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useNotification } from '../../../../stores/useNotification';
import { makeGetAllTenantsUseCase } from '../../../../domain/usecases/tenants/GetAllTenantsUseCase';
import { makeUpdateTenantMemberLimitUseCase } from '../../../../domain/usecases/tenants/UpdateTenantMemberLimitUseCase';
import type { Tenant } from '../../../../domain/entities';
import type { FilterDef, FilterToken } from '../../../components/ui/CompositeFilter';

export interface OfficesTabViewModel {
  loading: boolean;
  error: string | null;
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  searchTerm: string;
  filteredTenants: Tenant[];
  totalCount: number;
  savingTenantId: string | null;
  memberLimitDrafts: Record<string, string>;
  setFilterTokens: (tokens: FilterToken[]) => void;
  handleMemberLimitDraftChange: (tenantId: string, value: string) => void;
  handleMemberLimitCommit: (tenantId: string) => Promise<void>;
}

export const useOfficesTabViewModel = (): OfficesTabViewModel => {
  const { tenantRepository } = useDI();
  const { notify } = useNotification();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);
  const [memberLimitDrafts, setMemberLimitDrafts] = useState<Record<string, string>>({});

  const getAllTenantsUseCase = useMemo(() => makeGetAllTenantsUseCase(tenantRepository), [tenantRepository]);
  const updateMemberLimitUseCase = useMemo(() => makeUpdateTenantMemberLimitUseCase(tenantRepository), [tenantRepository]);

  useEffect(() => {
    getAllTenantsUseCase.execute()
      .then((list) => {
        setTenants(list);
        setMemberLimitDrafts(
          Object.fromEntries(list.map((t) => [t.id, t.memberLimit === null ? '' : String(t.memberLimit)])),
        );
      })
      .catch(() => setError('Não foi possível carregar os escritórios.'))
      .finally(() => setLoading(false));
  }, [getAllTenantsUseCase]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Nome do escritório...' },
  ], []);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredTenants = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    if (!searchQ) return tenants;
    return tenants.filter((t) => t.name.toLowerCase().includes(searchQ));
  }, [tenants, tokenMap]);

  const handleMemberLimitDraftChange = useCallback((tenantId: string, value: string) => {
    setMemberLimitDrafts((prev) => ({ ...prev, [tenantId]: value }));
  }, []);

  const handleMemberLimitCommit = useCallback(async (tenantId: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant) return;

    const raw = (memberLimitDrafts[tenantId] ?? '').trim();
    let parsed: number | null;
    if (raw === '') {
      parsed = null;
    } else {
      const n = Number(raw);
      if (!Number.isInteger(n) || n < 0) {
        notify('Informe um número inteiro maior ou igual a zero, ou deixe em branco para não limitar.', 'error');
        setMemberLimitDrafts((prev) => ({ ...prev, [tenantId]: tenant.memberLimit === null ? '' : String(tenant.memberLimit) }));
        return;
      }
      parsed = n;
    }

    if (parsed === tenant.memberLimit) return;

    setSavingTenantId(tenantId);
    try {
      await updateMemberLimitUseCase.execute(tenantId, parsed);
      setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, memberLimit: parsed } : t)));
      notify('Limite de membros atualizado.', 'success');
    } catch {
      notify('Erro ao atualizar o limite de membros.', 'error');
      setMemberLimitDrafts((prev) => ({ ...prev, [tenantId]: tenant.memberLimit === null ? '' : String(tenant.memberLimit) }));
    } finally {
      setSavingTenantId(null);
    }
  }, [tenants, memberLimitDrafts, updateMemberLimitUseCase, notify]);

  const searchTerm = tokenMap['search']?.[0] ?? '';

  return {
    loading,
    error,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'access-management-offices',
    searchTerm,
    filteredTenants,
    totalCount: tenants.length,
    savingTenantId,
    memberLimitDrafts,
    setFilterTokens,
    handleMemberLimitDraftChange,
    handleMemberLimitCommit,
  };
};
