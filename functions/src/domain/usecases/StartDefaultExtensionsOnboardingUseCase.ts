import type { IOfficeDefaultsRepository } from '../repositories/IOfficeDefaultsRepository';
import type { ITenantRepository } from '../repositories/ITenantRepository';
import { notFound, permissionDenied } from '../errors/DomainError';
import { onboardingPlanWindowEnd } from '../schema/plugin/defaultExtensions';

export type StartDefaultExtensionsOnboardingUseCase = {
  /** Devolve até quando (epoch em ms) a janela vale, ou `null` se não há janela. */
  execute: (input: { tenantId: string; userId: string }) => Promise<{ windowEndsAt: number | null }>;
};

/**
 * Abre a janela de instalação das extensões padrão (#28): o teto do plano deixa de valer para o DONO
 * enquanto a lista não esvazia, por no máximo `PLAN_ONBOARDING_WINDOW_MS` a partir de agora.
 *
 * Só o dono, e só o servidor marca o começo. Se o navegador pudesse gravá-lo, poderia reabrir a janela
 * a cada dia; se a ausência dele abrisse a janela, bastaria não chamar isto. A recomposição roda aqui,
 * antes de responder: quem chamou instala em seguida, e precisa do conjunto já sem o teto.
 */
export const makeStartDefaultExtensionsOnboardingUseCase = (deps: {
  tenants: Pick<ITenantRepository, 'getById'>;
  defaults: Pick<IOfficeDefaultsRepository, 'startOnboarding'>;
  materialize: (tenantId: string, userIds: string[]) => Promise<unknown>;
  now?: () => number;
}): StartDefaultExtensionsOnboardingUseCase => ({
  execute: async ({ tenantId, userId }) => {
    const tenant = await deps.tenants.getById(tenantId);
    if (!tenant) throw notFound('@core.access/permission.denied');
    if (tenant.ownerId !== userId) throw permissionDenied('@core.access/permission.denied');

    const now = (deps.now ?? Date.now)();
    const onboarding = await deps.defaults.startOnboarding(tenantId, now);
    const windowEndsAt = onboardingPlanWindowEnd(onboarding, now);
    if (windowEndsAt !== null) await deps.materialize(tenantId, [userId]);
    return { windowEndsAt };
  },
});
