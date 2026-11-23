import { describe, expect, it, vi } from 'vitest';
import type { IPlanRepository } from '../../repositories/IPlanRepository';
import type { IRegistrationPolicyRepository } from '../../repositories/IRegistrationPolicyRepository';
import type { Tenant } from '../../entities';
import type { PlanDefinition } from '../../schema/plans';
import {
  makeCreatePlanUseCase,
  makeDeletePlanUseCase,
  makeMigrateLegacyPlansUseCase,
  makeUpdatePlanUseCase,
} from './PlanUseCases';

const planRepo = (existing: PlanDefinition[] = [], inUse = false) => {
  const created: Array<{ id: string; name: string; memberLimit: number | null }> = [];
  const repo = {
    listPlans: vi.fn(async () => existing),
    getPlan: vi.fn(),
    subscribePlan: vi.fn(),
    createPlan: vi.fn(async (input) => ({ id: 'novo', ...input })),
    createPlanIfMissing: vi.fn(async (id: string, input: { name: string; memberLimit: number | null }) => {
      created.push({ id, name: input.name, memberLimit: input.memberLimit });
      return true;
    }),
    updatePlan: vi.fn(async () => undefined),
    deletePlan: vi.fn(async () => undefined),
    isPlanInUse: vi.fn(async () => inUse),
  } as unknown as IPlanRepository;
  return { repo, created };
};

const registrationRepo = (defaultPlanId: string | null = null) => ({
  getPolicy: vi.fn(async () => ({ acceptNewAccounts: true, selfServiceTenants: true, defaultExtensions: [], defaultLocale: null, defaultPlanId })),
  updatePolicy: vi.fn(async () => undefined),
  setDefaultExtension: vi.fn(),
}) as unknown as IRegistrationPolicyRepository & { updatePolicy: ReturnType<typeof vi.fn> };

const tenantsOn = (...plans: Array<string | null>) => ({
  getAllTenants: async () => plans.map((plan, index) => ({ id: `t${index}`, plan }) as Tenant),
});

describe('planos como dado (#24)', () => {
  it('o plano nasce sem restrição e sem limite', async () => {
    const { repo } = planRepo();
    await makeCreatePlanUseCase(repo).execute('  Starter ', 'sys');
    expect(repo.createPlan).toHaveBeenCalledWith({ name: 'Starter', memberLimit: null, deniedPermissions: [], archived: false }, 'sys');
  });

  it('nome vazio e limite abaixo de 1 são recusados antes de gravar', async () => {
    const { repo } = planRepo();
    await expect(makeCreatePlanUseCase(repo).execute(' ', 'sys')).rejects.toThrow('@core.admin/access.plans.name-invalid');
    await expect(makeUpdatePlanUseCase(repo).execute('p', { memberLimit: 0 }, 'sys')).rejects.toThrow('@core.admin/access.plans.limit-invalid');
    expect(repo.updatePlan).not.toHaveBeenCalled();
  });

  it('plano em uso não se exclui', async () => {
    const { repo } = planRepo([], true);
    await expect(makeDeletePlanUseCase(repo).execute('solo')).rejects.toThrow('@core.admin/access.plans.delete.in-use');
    expect(repo.deletePlan).not.toHaveBeenCalled();
  });
});

describe('migração dos planos fixos de antes', () => {
  it('cria só os planos que algum escritório usa, com o nome e o limite de antes', async () => {
    const { repo, created } = planRepo();
    const registration = registrationRepo();
    await makeMigrateLegacyPlansUseCase(repo, tenantsOn('solo', 'enterprise', null), registration).execute('sys');
    expect(created).toEqual([
      { id: 'solo', name: 'Solo', memberLimit: 1 },
      { id: 'enterprise', name: 'Enterprise', memberLimit: 100 },
    ]);
  });

  it('o solo criado agora vira o plano padrão — era o de todo escritório novo', async () => {
    const { repo } = planRepo();
    const registration = registrationRepo();
    await makeMigrateLegacyPlansUseCase(repo, tenantsOn('solo'), registration).execute('sys');
    expect(registration.updatePolicy).toHaveBeenCalledWith({ defaultPlanId: 'solo' }, 'sys');
  });

  it('instalação nova não ganha plano nenhum, e plano já existente não é tocado', async () => {
    const fresh = planRepo();
    await makeMigrateLegacyPlansUseCase(fresh.repo, tenantsOn(), registrationRepo()).execute('sys');
    expect(fresh.created).toEqual([]);

    const done = planRepo([{ id: 'solo', name: 'Básico', memberLimit: 2, deniedPermissions: [], archived: false }]);
    const registration = registrationRepo();
    await makeMigrateLegacyPlansUseCase(done.repo, tenantsOn('solo'), registration).execute('sys');
    expect(done.created).toEqual([]);
    expect(registration.updatePolicy).not.toHaveBeenCalled();
  });
});
