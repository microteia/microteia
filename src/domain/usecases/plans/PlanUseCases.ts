import type { IPlanRepository, PlanInput } from '../../repositories/IPlanRepository';
import type { ITenantRepository } from '../../repositories/ITenantRepository';
import type { IRegistrationPolicyRepository } from '../../repositories/IRegistrationPolicyRepository';
import { LocalizedError } from '../../errors/LocalizedError';
import { MIN_PLAN_MEMBER_LIMIT, type PlanDefinition } from '../../schema/plans';

export const PLAN_NAME_MAX = 80;

const normalized = (input: Partial<PlanInput>): Partial<PlanInput> => {
  const change: Partial<PlanInput> = { ...input };
  if (input.name !== undefined) {
    const name = input.name.trim();
    if (name === '' || name.length > PLAN_NAME_MAX) {
      throw new LocalizedError('@core.admin/access.plans.name-invalid', { max: String(PLAN_NAME_MAX) });
    }
    change.name = name;
  }
  if (input.memberLimit !== undefined && input.memberLimit !== null
    && (!Number.isInteger(input.memberLimit) || input.memberLimit < MIN_PLAN_MEMBER_LIMIT)) {
    throw new LocalizedError('@core.admin/access.plans.limit-invalid', { min: String(MIN_PLAN_MEMBER_LIMIT) });
  }
  if (input.deniedPermissions !== undefined) {
    change.deniedPermissions = [...new Set(input.deniedPermissions)].sort();
  }
  return change;
};

export type ListPlansUseCase = { execute: () => Promise<PlanDefinition[]> };
export const makeListPlansUseCase = (repo: IPlanRepository): ListPlansUseCase => ({
  execute: () => repo.listPlans(),
});

export type GetPlanUseCase = { execute: (planId: string) => Promise<PlanDefinition | null> };
export const makeGetPlanUseCase = (repo: IPlanRepository): GetPlanUseCase => ({
  execute: (planId) => repo.getPlan(planId),
});

export type CreatePlanUseCase = { execute: (name: string, updatedBy: string) => Promise<PlanDefinition> };

/** O plano nasce sem restrição e sem limite: o padrão é "tudo", e quem o cria decide o que tirar. */
export const makeCreatePlanUseCase = (repo: IPlanRepository): CreatePlanUseCase => ({
  execute: async (name, updatedBy) => {
    const { name: valid } = normalized({ name });
    return repo.createPlan({ name: valid as string, memberLimit: null, deniedPermissions: [], archived: false }, updatedBy);
  },
});

export type UpdatePlanUseCase = {
  execute: (planId: string, change: Partial<PlanInput>, updatedBy: string) => Promise<void>;
};
export const makeUpdatePlanUseCase = (repo: IPlanRepository): UpdatePlanUseCase => ({
  execute: async (planId, change, updatedBy) => repo.updatePlan(planId, normalized(change), updatedBy),
});

export type DeletePlanUseCase = { execute: (planId: string) => Promise<void> };

/**
 * Excluir só o plano que ninguém usa. O escritório que apontasse para um plano apagado ficaria sem
 * restrição nenhuma em silêncio — o oposto do que quem excluiu quis. Para tirar um plano de oferta sem
 * mexer em quem está nele, arquiva-se.
 */
export const makeDeletePlanUseCase = (repo: IPlanRepository): DeletePlanUseCase => ({
  execute: async (planId) => {
    if (await repo.isPlanInUse(planId)) throw new LocalizedError('@core.admin/access.plans.delete.in-use');
    await repo.deletePlan(planId);
  },
});

/**
 * Os planos que o kernel trazia fixos, como eram: mesmo id, mesmo nome, mesmo limite, nenhuma
 * restrição. Existem SÓ para a migração — nenhuma outra parte do produto os conhece.
 */
const LEGACY_PLANS: ReadonlyArray<{ id: string } & Pick<PlanInput, 'name' | 'memberLimit'>> = [
  { id: 'solo', name: 'Solo', memberLimit: 1 },
  { id: 'office', name: '@core.admin/plan.office', memberLimit: 5 },
  { id: 'professional', name: 'Professional', memberLimit: 15 },
  { id: 'enterprise', name: 'Enterprise', memberLimit: 100 },
];

const LEGACY_DEFAULT_PLAN = 'solo';

export type MigrateLegacyPlansUseCase = { execute: (updatedBy: string) => Promise<number> };

/**
 * Transforma em documento os planos que o kernel trazia fixos (#24) — só os que algum escritório USA.
 *
 * Instalação nova não ganha plano nenhum: semear os nossos nomes comerciais seria o defeito que tirar
 * o plano do código existe para corrigir. O que se materializa é o que os dados já referenciam, para o
 * escritório que estava em `solo` continuar num plano que existe.
 *
 * O plano padrão vira `solo` só quando ESTA execução o criou — era o plano de todo escritório novo até
 * aqui. Rodada de novo, depois de o `SYSTEM` ter tirado o padrão, ela não o devolve.
 *
 * Roda quando o `SYSTEM` abre Gestão de Acessos, e é idempotente: `createPlanIfMissing` nunca sobrepõe
 * um plano já editado.
 */
export const makeMigrateLegacyPlansUseCase = (
  plans: IPlanRepository,
  tenants: Pick<ITenantRepository, 'getAllTenants'>,
  registration: IRegistrationPolicyRepository,
): MigrateLegacyPlansUseCase => ({
  execute: async (updatedBy) => {
    const [existing, all] = await Promise.all([plans.listPlans(), tenants.getAllTenants()]);
    const known = new Set(existing.map((plan) => plan.id));
    const inUse = new Set(all.map((tenant) => tenant.plan).filter((plan): plan is string => !!plan));

    let created = 0;
    let createdDefault = false;
    for (const legacy of LEGACY_PLANS) {
      if (!inUse.has(legacy.id) || known.has(legacy.id)) continue;
      const { id, ...input } = legacy;
      if (await plans.createPlanIfMissing(id, { ...input, deniedPermissions: [], archived: false }, updatedBy)) {
        created += 1;
        if (id === LEGACY_DEFAULT_PLAN) createdDefault = true;
      }
    }

    if (createdDefault && (await registration.getPolicy()).defaultPlanId === null) {
      await registration.updatePolicy({ defaultPlanId: LEGACY_DEFAULT_PLAN }, updatedBy);
    }
    return created;
  },
});
