import { useState, useEffect, useMemo, useCallback } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useNotification } from '../../../../stores/useNotification';
import { makeGetAllTenantsUseCase } from '../../../../domain/usecases/tenants/GetAllTenantsUseCase';
import { makeUpdateTenantMemberLimitUseCase } from '../../../../domain/usecases/tenants/UpdateTenantMemberLimitUseCase';
import { makeUpdateTenantUseCase } from '../../../../domain/usecases/tenants/UpdateTenantUseCase';
import { makeCreateOrganizationUseCase } from '../../../../domain/usecases/tenants/CreateOrganizationUseCase';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import { makeListPlansUseCase } from '../../../../domain/usecases/plans/PlanUseCases';
import type { Plan, Tenant } from '../../../../domain/entities';
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
  /** Por escritório: os planos oferecidos mais o atual dele, mesmo arquivado ou não cadastrado. */
  planOptionsByTenant: Record<string, SearchSelectOption[]>;
  planDrafts: Record<string, string>;
  memberLimitDrafts: Record<string, string>;
  setFilterTokens: (tokens: FilterToken[]) => void;
  handlePlanChange: (tenantId: string, plan: string) => Promise<void>;
  handleMemberLimitDraftChange: (tenantId: string, value: string) => void;
  handleMemberLimitCommit: (tenantId: string) => Promise<void>;
  createOpen: boolean;
  createName: string;
  createOwnerEmail: string;
  creating: boolean;
  createError: string | null;
  canCreate: boolean;
  openCreate: () => void;
  closeCreate: () => void;
  setCreateName: (value: string) => void;
  setCreateOwnerEmail: (value: string) => void;
  submitCreate: () => void;
}

/** O valor do seletor para "sem plano" — `SearchSelect` não distingue `null` de "nada escolhido". */
const NO_PLAN = '__no-plan__';

export const useOfficesTabViewModel = (): OfficesTabViewModel => {
  const t = useT('core.admin');
  const label = useLabel();
  const { tenantRepository, planRepository } = useDI();
  const { notify } = useNotification();

  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([]);
  const [savingTenantId, setSavingTenantId] = useState<string | null>(null);
  const [planDrafts, setPlanDrafts] = useState<Record<string, string>>({});
  const [plans, setPlans] = useState<Plan[]>([]);
  const [memberLimitDrafts, setMemberLimitDrafts] = useState<Record<string, string>>({});

  const getAllTenantsUseCase = useMemo(() => makeGetAllTenantsUseCase(tenantRepository), [tenantRepository]);
  const listPlansUseCase = useMemo(() => makeListPlansUseCase(planRepository), [planRepository]);
  const updateMemberLimitUseCase = useMemo(() => makeUpdateTenantMemberLimitUseCase(tenantRepository), [tenantRepository]);
  const updateTenantUseCase = useMemo(() => makeUpdateTenantUseCase(tenantRepository), [tenantRepository]);
  const createOrganizationUseCase = useMemo(() => makeCreateOrganizationUseCase(tenantRepository), [tenantRepository]);

  // O escritório aberto em nome de alguém — o único caminho quando a instalação desligou o autocadastro.
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createOwnerEmail, setCreateOwnerEmail] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  /**
   * O plano arquivado não é OFERECIDO (#24), mas o escritório que já está nele continua vendo o nome
   * dele — senão o seletor ficaria em branco e pareceria sem plano. O mesmo para um id que nenhum
   * documento explica: aparece como está, para o `SYSTEM` saber que precisa escolher outro.
   */
  const planOptionsByTenant = useMemo<Record<string, SearchSelectOption[]>>(() => {
    const byId = new Map(plans.map((plan) => [plan.id, plan]));
    const offered: SearchSelectOption[] = [
      { value: NO_PLAN, label: t('access.plan.none') },
      ...plans
        .filter((plan) => !plan.archived)
        .map((plan) => ({ value: plan.id, label: label(plan.name) }))
        .sort((a, b) => a.label.localeCompare(b.label)),
    ];
    return Object.fromEntries(tenants.map((tenant) => {
      if (!tenant.plan || offered.some((option) => option.value === tenant.plan)) return [tenant.id, offered];
      const current = byId.get(tenant.plan);
      const extra = current
        ? { value: current.id, label: t('access.plans.archived-suffix', { name: label(current.name) }) }
        : { value: tenant.plan, label: t('access.plans.unknown', { id: tenant.plan }) };
      return [tenant.id, [...offered, extra]];
    }));
  }, [plans, tenants, t, label]);

  const applyList = useCallback((list: Tenant[]) => {
    setTenants(list);
    setPlanDrafts(Object.fromEntries(list.map((t) => [t.id, t.plan ?? NO_PLAN])));
    setMemberLimitDrafts(
      Object.fromEntries(list.map((t) => [t.id, t.memberLimit === null ? '' : String(t.memberLimit)])),
    );
  }, []);

  useEffect(() => {
    Promise.all([getAllTenantsUseCase.execute(), listPlansUseCase.execute()])
      .then(([list, registered]) => {
        setPlans(registered);
        applyList(list);
      })
      .catch(() => setError(t('access.offices.load-failed')))
      .finally(() => setLoading(false));
  }, [getAllTenantsUseCase, listPlansUseCase, applyList, t]);

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

  /**
   * Trocar o plano SUGERE o limite padrão dele, gravado junto — e o limite continua editável ao lado.
   * Sair de todo plano mantém o limite que o escritório tinha: "sem plano" não diz limite nenhum.
   */
  const handlePlanChange = useCallback(async (tenantId: string, choice: string) => {
    const tenant = tenants.find((t) => t.id === tenantId);
    const plan = choice === NO_PLAN ? null : choice;
    if (!tenant || tenant.plan === plan) return;

    const memberLimit = plan === null
      ? tenant.memberLimit
      : plans.find((candidate) => candidate.id === plan)?.memberLimit ?? null;
    setPlanDrafts((prev) => ({ ...prev, [tenantId]: choice }));
    setSavingTenantId(tenantId);
    try {
      await updateTenantUseCase.execute(tenantId, { plan, memberLimit });
      setTenants((prev) => prev.map((t) => (t.id === tenantId ? { ...t, plan, memberLimit } : t)));
      setMemberLimitDrafts((prev) => ({ ...prev, [tenantId]: memberLimit === null ? '' : String(memberLimit) }));
      notify(t('access.plan.updated'), 'success');
    } catch {
      notify(t('access.plan.update-failed'), 'error');
      setPlanDrafts((prev) => ({ ...prev, [tenantId]: tenant.plan ?? NO_PLAN }));
    } finally {
      setSavingTenantId(null);
    }
  }, [tenants, plans, updateTenantUseCase, notify, t]);

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

  const submitCreate = useCallback(() => {
    if (createName.trim() === '' || createOwnerEmail.trim() === '' || creating) return;
    setCreating(true);
    setCreateError(null);
    createOrganizationUseCase.execute(createName, createOwnerEmail)
      .then(() => getAllTenantsUseCase.execute())
      .then((list) => {
        applyList(list);
        setCreateOpen(false);
        setCreateName('');
        setCreateOwnerEmail('');
        notify(t('access.offices.create.done'), 'success');
      })
      .catch((cause: unknown) => setCreateError(label(
        cause instanceof Error && cause.message.startsWith('@') ? cause.message : '@core.admin/access.offices.create.failed',
        errorParamsOf(cause),
      )))
      .finally(() => setCreating(false));
  }, [createName, createOwnerEmail, creating, createOrganizationUseCase, getAllTenantsUseCase, applyList, notify, t, label]);

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
    planOptionsByTenant,
    planDrafts,
    memberLimitDrafts,
    setFilterTokens,
    handlePlanChange,
    handleMemberLimitDraftChange,
    handleMemberLimitCommit,
    createOpen,
    createName,
    createOwnerEmail,
    creating,
    createError,
    canCreate: createName.trim() !== '' && createOwnerEmail.trim() !== '' && !creating,
    openCreate: () => {
      setCreateError(null);
      setCreateOpen(true);
    },
    closeCreate: () => setCreateOpen(false),
    setCreateName,
    setCreateOwnerEmail,
    submitCreate,
  };
};
