import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useNotification } from '../../../../stores/useNotification';
import { makeGetAllTenantsUseCase } from '../../../../domain/usecases/tenants/GetAllTenantsUseCase';
import { makeUpdateTenantMemberLimitUseCase } from '../../../../domain/usecases/tenants/UpdateTenantMemberLimitUseCase';
import { makeUpdateTenantUseCase } from '../../../../domain/usecases/tenants/UpdateTenantUseCase';
import { TENANT_PLANS, TENANT_PLAN_LABELS, TENANT_PLAN_MEMBER_LIMITS } from '../../../../domain/entities';
import type { Tenant, TenantPlan } from '../../../../domain/entities';
import type { FilterDef, FilterToken } from '../../../components/ui/CompositeFilter';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';

import { useT, useLabel } from '../../../shared/i18n/useT';
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
  planOptions: SearchSelectOption[];
  planDrafts: Record<string, TenantPlan>;
  memberLimitDrafts: Record<string, string>;
  setFilterTokens: (tokens: FilterToken[]) => void;
  handlePlanChange: (tenantId: string, plan: TenantPlan) => Promise<void>;
  handleMemberLimitDraftChange: (tenantId: string, value: string) => void;
  handleMemberLimitCommit: (tenantId: string) => Promise<void>;
}

export const useOfficesTabViewModel = (): OfficesTabViewModel => {
  const t = useT('core.admin');
  const label = useLabel();
  const { tenantRepository } = useDI();
  const { notify } = useNotification();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, TenantPlan>>({});
  const [memberLimitDrafts, setMemberLimitDrafts] = useState<Record<string, string>>({});

  const getAllTenantsUseCase = useMemo(() => makeGetAllTenantsUseCase(tenantRepository), [tenantRepository]);
  const updateMemberLimitUseCase = useMemo(() => makeUpdateTenantMemberLimitUseCase(tenantRepository), [tenantRepository]);
  const updateTenantUseCase = useMemo(() => makeUpdateTenantUseCase(tenantRepository), [tenantRepository]);

  const planOptions = useMemo<SearchSelectOption[]>(
    () => TENANT_PLANS.map((plan) => ({ value: plan, label: label(TENANT_PLAN_LABELS[plan]) })),
    [ label],
  );

  useEffect(() => {
    getAllTenantsUseCase.execute()
      .then((list) => {
        setTenants(list);
        setPlanDrafts(Object.fromEntries(list.map((t) => [t.id, t.plan])));
        setMemberLimitDrafts(
          Object.fromEntries(list.map((t) => [t.id, t.memberLimit === null ? '' : String(t.memberLimit)])),
        );
      })
      .catch(() => setError(t('access.offices.load-failed')))
      .finally(() => setLoading(false));
  }, [getAllTenantsUseCase, t]);

  const filterDefs = useMemo<FilterDef[]>(() => [
    {
      key: 'search',
      label: t('core.ui/filter.search'),
      type: 'text',
      placeholder: t('access.offices.filter.search.placeholder'),
    },
  ], [t]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((token) => { map[token.key] = token.values; });
    return map;
  }, [filterTokens]);

  const filteredTenants = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    if (!searchQ) return tenants;
    return tenants.filter((t) => t.name.toLowerCase().includes(searchQ));
  }, [tenants, tokenMap]);

  const handlePlanChange = useCallback(async (tenantId: string, plan: TenantPlan) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    if (!tenant || tenant.plan === plan) return;

    const memberLimit = TENANT_PLAN_MEMBER_LIMITS[plan];
    setPlanDrafts((prev) => ({ ...prev, [tenantId]: plan }));
    setSavingTenantId(tenantId);
    try {
      await updateTenantUseCase.execute(tenantId, { plan, memberLimit });
      setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, plan, memberLimit } : t)));
      setMemberLimitDrafts((prev) => ({ ...prev, [tenantId]: String(memberLimit) }));
      notify(t('access.plan.updated'), 'success');
    } catch {
      notify(t('access.plan.update-failed'), 'error');
      setPlanDrafts((prev) => ({ ...prev, [tenantId]: tenant.plan }));
    } finally {
      setSavingTenantId(null);
    }
  }, [tenants, updateTenantUseCase, notify, t]);

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
        notify(t('access.member-limit.invalid'), 'error');
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
      notify(t('access.member-limit.updated'), 'success');
    } catch {
      notify(t('access.member-limit.update-failed'), 'error');
      setMemberLimitDrafts((prev) => ({ ...prev, [tenantId]: tenant.memberLimit === null ? '' : String(tenant.memberLimit) }));
    } finally {
      setSavingTenantId(null);
    }
  }, [tenants, memberLimitDrafts, updateMemberLimitUseCase, notify, t]);

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
    planOptions,
    planDrafts,
    memberLimitDrafts,
    setFilterTokens,
    handlePlanChange,
    handleMemberLimitDraftChange,
    handleMemberLimitCommit,
  };
};
