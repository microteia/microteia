import { useCallback, useEffect, useMemo, useState } from 'react';
import { useDI } from '../../../../infrastructure/di/useDI';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useNotification } from '../../../../stores/useNotification';
import { makeGetAllTenantsUseCase } from '../../../../domain/usecases/tenants/GetAllTenantsUseCase';
import { makeGetRegistrationPolicyUseCase } from '../../../../domain/usecases/registration/GetRegistrationPolicyUseCase';
import { makeUpdateRegistrationPolicyUseCase } from '../../../../domain/usecases/registration/UpdateRegistrationPolicyUseCase';
import {
  makeCreatePlanUseCase,
  makeDeletePlanUseCase,
  makeListPlansUseCase,
  makeUpdatePlanUseCase,
} from '../../../../domain/usecases/plans/PlanUseCases';
import type { PlanInput } from '../../../../domain/repositories/IPlanRepository';
import type { Plan } from '../../../../domain/entities';
import type { CatalogPermission } from '../../../../domain/schema/access';
import { planDeniedClosure } from '../../../../domain/schema/access';
import { PLAN_ESSENTIAL_PERMISSIONS } from '../../../../domain/schema/plans';
import { errorParamsOf } from '../../../../domain/errors/LocalizedError';
import type { SearchSelectOption } from '../../../components/ui/SearchSelect';
import { useLabel, useT } from '../../../shared/i18n/useT';

export interface PlanRow {
  id: string;
  name: string;
  archived: boolean;
  isDefault: boolean;
  tenantCount: number;
  deniedCount: number;
}

export interface PlansTabViewModel {
  loading: boolean;
  error: string | null;
  rows: PlanRow[];
  savingPlanId: string | null;

  defaultPlanValue: string;
  defaultPlanOptions: SearchSelectOption[];
  setDefaultPlan: (value: string) => Promise<void>;

  nameDrafts: Record<string, string>;
  setNameDraft: (planId: string, value: string) => void;
  commitName: (planId: string) => Promise<void>;
  limitDrafts: Record<string, string>;
  setLimitDraft: (planId: string, value: string) => void;
  commitLimit: (planId: string) => Promise<void>;
  setArchived: (planId: string, archived: boolean) => Promise<void>;

  createOpen: boolean;
  createName: string;
  creating: boolean;
  openCreate: () => void;
  closeCreate: () => void;
  setCreateName: (value: string) => void;
  submitCreate: () => Promise<void>;

  /** O plano cujas permissões estão abertas no diálogo. */
  editing: { id: string; name: string } | null;
  openPermissions: (planId: string) => void;
  closePermissions: () => void;
  /** O que o plano PERMITE — o que o seletor mostra marcado. */
  allowedPermissions: string[];
  setAllowedPermissions: (ids: string[]) => void;
  savingPermissions: boolean;
  savePermissions: () => Promise<void>;
  /** Os nomes das essenciais que o rascunho bloqueia — o aviso, nunca a recusa. */
  essentialDenied: string[];
  restrictTo: (permission: CatalogPermission) => boolean;

  planToDelete: { id: string; name: string } | null;
  requestDelete: (planId: string) => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
}

/** O valor do seletor para "sem plano" — `SearchSelect` não distingue vazio de "nada escolhido". */
const NO_PLAN = '__no-plan__';

/**
 * O plano restringe as permissões DECLARADAS — as do kernel e as que as extensões trazem. As de coleção
 * (`<coleção>.read` …) nascem de cada tela do escritório, e um plano global não tem como falar delas.
 */
const declaredOnly = (permission: CatalogPermission): boolean => !permission.derived;

const limitToDraft = (limit: number | null): string => (limit === null ? '' : String(limit));

export const usePlansTabViewModel = (): PlansTabViewModel => {
  const t = useT('core.admin');
  const label = useLabel();
  const { notify } = useNotification();
  const { user } = useAuth();
  const { catalog } = useAuthorization();
  const { planRepository, tenantRepository, registrationPolicyRepository } = useDI();

  const uc = useMemo(() => ({
    list: makeListPlansUseCase(planRepository),
    create: makeCreatePlanUseCase(planRepository),
    update: makeUpdatePlanUseCase(planRepository),
    remove: makeDeletePlanUseCase(planRepository),
    tenants: makeGetAllTenantsUseCase(tenantRepository),
    getPolicy: makeGetRegistrationPolicyUseCase(registrationPolicyRepository),
    updatePolicy: makeUpdateRegistrationPolicyUseCase(registrationPolicyRepository),
  }), [planRepository, tenantRepository, registrationPolicyRepository]);

  const [plans, setPlans] = useState<Plan[]>([]);
  const [tenantCounts, setTenantCounts] = useState<Record<string, number>>({});
  const [defaultPlanId, setDefaultPlanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [savingPlanId, setSavingPlanId] = useState<string | null>(null);
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [limitDrafts, setLimitDrafts] = useState<Record<string, string>>({});
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deniedDraft, setDeniedDraft] = useState<string[]>([]);
  const [savingPermissions, setSavingPermissions] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const report = useCallback(
    (cause: unknown, fallback: string) => notify(label(
      cause instanceof Error && cause.message.startsWith('@') ? cause.message : `@core.admin/${fallback}`,
      errorParamsOf(cause),
    ), 'error'),
    [notify, label],
  );

  const applyPlans = useCallback((list: Plan[]) => {
    setPlans(list);
    setNameDrafts(Object.fromEntries(list.map((plan) => [plan.id, plan.name])));
    setLimitDrafts(Object.fromEntries(list.map((plan) => [plan.id, limitToDraft(plan.memberLimit)])));
  }, []);

  useEffect(() => {
    Promise.all([uc.list.execute(), uc.tenants.execute(), uc.getPolicy.execute()])
      .then(([list, tenants, policy]) => {
        applyPlans(list);
        const counts: Record<string, number> = {};
        for (const tenant of tenants) if (tenant.plan) counts[tenant.plan] = (counts[tenant.plan] ?? 0) + 1;
        setTenantCounts(counts);
        setDefaultPlanId(policy.defaultPlanId);
      })
      .catch(() => setError(t('access.plans.load-failed')))
      .finally(() => setLoading(false));
  }, [uc, applyPlans, t]);

  const rows = useMemo<PlanRow[]>(() => plans
    .map((plan) => ({
      id: plan.id,
      name: label(plan.name),
      archived: plan.archived,
      isDefault: plan.id === defaultPlanId,
      tenantCount: tenantCounts[plan.id] ?? 0,
      deniedCount: plan.deniedPermissions.length,
    }))
    .sort((a, b) => Number(a.archived) - Number(b.archived) || a.name.localeCompare(b.name)),
  [plans, defaultPlanId, tenantCounts, label]);

  const patchPlan = useCallback(async (planId: string, change: Partial<PlanInput>): Promise<boolean> => {
    if (!user) return false;
    setSavingPlanId(planId);
    try {
      await uc.update.execute(planId, change, user.id);
      setPlans((prev) => prev.map((plan) => (plan.id === planId ? { ...plan, ...change } : plan)));
      notify(t('access.plans.updated'), 'success');
      return true;
    } catch (cause) {
      report(cause, 'access.plans.update-failed');
      return false;
    } finally {
      setSavingPlanId(null);
    }
  }, [user, uc, notify, t, report]);

  const setDefaultPlan = useCallback(async (value: string) => {
    if (!user) return;
    const next = value === NO_PLAN ? null : value;
    if (next === defaultPlanId) return;
    try {
      await uc.updatePolicy.execute({ defaultPlanId: next }, user.id);
      setDefaultPlanId(next);
      notify(t('access.plans.default.updated'), 'success');
    } catch {
      notify(t('access.plans.default.update-failed'), 'error');
    }
  }, [user, defaultPlanId, uc, notify, t]);

  const commitName = useCallback(async (planId: string) => {
    const plan = plans.find((candidate) => candidate.id === planId);
    const draft = (nameDrafts[planId] ?? '').trim();
    if (!plan || draft === plan.name) return;
    if (!(await patchPlan(planId, { name: draft }))) {
      setNameDrafts((prev) => ({ ...prev, [planId]: plan.name }));
    }
  }, [plans, nameDrafts, patchPlan]);

  const commitLimit = useCallback(async (planId: string) => {
    const plan = plans.find((candidate) => candidate.id === planId);
    if (!plan) return;
    const raw = (limitDrafts[planId] ?? '').trim();
    const limit = raw === '' ? null : Number(raw);
    if (limit === plan.memberLimit) return;
    if (!(await patchPlan(planId, { memberLimit: limit }))) {
      setLimitDrafts((prev) => ({ ...prev, [planId]: limitToDraft(plan.memberLimit) }));
    }
  }, [plans, limitDrafts, patchPlan]);

  /**
   * Arquivar o plano PADRÃO tira o padrão junto: o servidor já ignora padrão arquivado, e a tela que
   * continuasse dizendo que ele é o padrão mentiria sobre o escritório que vai nascer.
   */
  const setArchived = useCallback(async (planId: string, archived: boolean) => {
    if (!(await patchPlan(planId, { archived }))) return;
    if (archived && planId === defaultPlanId && user) {
      try {
        await uc.updatePolicy.execute({ defaultPlanId: null }, user.id);
        setDefaultPlanId(null);
        notify(t('access.plans.archived-default'), 'info');
      } catch {
        notify(t('access.plans.default.update-failed'), 'error');
      }
    }
  }, [patchPlan, defaultPlanId, user, uc, notify, t]);

  const submitCreate = useCallback(async () => {
    if (!user || creating || createName.trim() === '') return;
    setCreating(true);
    try {
      const created = await uc.create.execute(createName, user.id);
      applyPlans([...plans, created]);
      setCreateOpen(false);
      setCreateName('');
      notify(t('access.plans.created'), 'success');
    } catch (cause) {
      report(cause, 'access.plans.create-failed');
    } finally {
      setCreating(false);
    }
  }, [user, creating, createName, uc, plans, applyPlans, notify, t, report]);

  const editingPlan = useMemo(() => plans.find((plan) => plan.id === editingId) ?? null, [plans, editingId]);

  const offerableIds = useMemo(
    () => catalog.list.filter(declaredOnly).map((permission) => permission.id),
    [catalog],
  );

  const openPermissions = useCallback((planId: string) => {
    const plan = plans.find((candidate) => candidate.id === planId);
    if (!plan) return;
    setDeniedDraft(plan.deniedPermissions);
    setEditingId(planId);
  }, [plans]);

  const closePermissions = useCallback(() => setEditingId(null), []);

  const allowedPermissions = useMemo(() => {
    const denied = new Set(deniedDraft);
    return offerableIds.filter((id) => !denied.has(id));
  }, [offerableIds, deniedDraft]);

  /**
   * Desmarcar uma permissão desmarca também o que DEPENDE dela — a tela mostra o teto que vai valer,
   * e não um que a materialização corrigiria em silêncio. Marcar traz o que ela exige (o seletor já
   * faz isso). As negadas que este catálogo não conhece — de uma extensão que não está instalada no
   * escritório aberto — continuam negadas: o plano é global, e este catálogo, não.
   */
  const setAllowedPermissions = useCallback((ids: string[]) => {
    const allowed = new Set(ids);
    const offerable = new Set(offerableIds);
    const explicit = offerableIds.filter((id) => !allowed.has(id));
    const closed = planDeniedClosure(catalog, explicit).filter((id) => offerable.has(id));
    setDeniedDraft((prev) => [...new Set([...prev.filter((id) => !offerable.has(id)), ...closed])].sort());
  }, [offerableIds, catalog]);

  const savePermissions = useCallback(async () => {
    if (!editingId) return;
    setSavingPermissions(true);
    const saved = await patchPlan(editingId, { deniedPermissions: deniedDraft });
    setSavingPermissions(false);
    if (saved) setEditingId(null);
  }, [editingId, deniedDraft, patchPlan]);

  const essentialDenied = useMemo(() => {
    const denied = new Set(deniedDraft);
    return PLAN_ESSENTIAL_PERMISSIONS
      .filter((id) => denied.has(id))
      .map((id) => {
        const permission = catalog.byId.get(id);
        return permission ? label(permission.name) : id;
      });
  }, [deniedDraft, catalog, label]);

  const confirmDelete = useCallback(async () => {
    if (!deleteId) return;
    try {
      await uc.remove.execute(deleteId);
      applyPlans(plans.filter((plan) => plan.id !== deleteId));
      notify(t('access.plans.deleted'), 'success');
    } catch (cause) {
      report(cause, 'access.plans.delete-failed');
    } finally {
      setDeleteId(null);
    }
  }, [deleteId, uc, plans, applyPlans, notify, t, report]);

  const defaultPlanOptions = useMemo<SearchSelectOption[]>(() => [
    { value: NO_PLAN, label: t('access.plan.none') },
    ...plans
      .filter((plan) => !plan.archived)
      .map((plan) => ({ value: plan.id, label: label(plan.name) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  ], [plans, t, label]);

  const planToDelete = useMemo(() => {
    const plan = plans.find((candidate) => candidate.id === deleteId);
    return plan ? { id: plan.id, name: label(plan.name) } : null;
  }, [plans, deleteId, label]);

  return {
    loading,
    error,
    rows,
    savingPlanId,
    defaultPlanValue: defaultPlanId ?? NO_PLAN,
    defaultPlanOptions,
    setDefaultPlan,
    nameDrafts,
    setNameDraft: (planId, value) => setNameDrafts((prev) => ({ ...prev, [planId]: value })),
    commitName,
    limitDrafts,
    setLimitDraft: (planId, value) => setLimitDrafts((prev) => ({ ...prev, [planId]: value })),
    commitLimit,
    setArchived,
    createOpen,
    createName,
    creating,
    openCreate: () => setCreateOpen(true),
    closeCreate: () => setCreateOpen(false),
    setCreateName,
    submitCreate,
    editing: editingPlan ? { id: editingPlan.id, name: label(editingPlan.name) } : null,
    openPermissions,
    closePermissions,
    allowedPermissions,
    setAllowedPermissions,
    savingPermissions,
    savePermissions,
    essentialDenied,
    restrictTo: declaredOnly,
    planToDelete,
    requestDelete: setDeleteId,
    cancelDelete: () => setDeleteId(null),
    confirmDelete,
  };
};
