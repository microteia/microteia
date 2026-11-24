import { describe, expect, it, vi } from 'vitest';
import { makeStartDefaultExtensionsOnboardingUseCase } from './StartDefaultExtensionsOnboardingUseCase';
import type { DefaultExtensionsOnboarding } from '../schema/plugin/defaultExtensions';
import { PLAN_ONBOARDING_WINDOW_MS } from '../schema/plugin/defaultExtensions';
import type { Tenant } from '../entities/Tenant';
import { DomainError } from '../errors/DomainError';

const NOW = 1_800_000_000_000;

const setup = (onboarding: DefaultExtensionsOnboarding | null) => {
  const materialize = vi.fn(async () => 1);
  const startOnboarding = vi.fn(async (_tenantId: string, now: number) =>
    (onboarding && onboarding.pending.length > 0 && onboarding.startedAt === undefined
      ? { ...onboarding, startedAt: now }
      : onboarding));
  const useCase = makeStartDefaultExtensionsOnboardingUseCase({
    tenants: { getById: async (id) => (id === 't1' ? ({ id, ownerId: 'dona' } as Tenant) : null) },
    defaults: { startOnboarding },
    materialize,
    now: () => NOW,
  });
  return { useCase, materialize, startOnboarding };
};

describe('StartDefaultExtensionsOnboardingUseCase (#28)', () => {
  it('o dono abre a janela, e o conjunto dele é recomposto antes da resposta', async () => {
    const { useCase, materialize } = setup({ pending: ['com.acme.crm'], failed: [] });
    await expect(useCase.execute({ tenantId: 't1', userId: 'dona' })).resolves.toEqual({ windowEndsAt: NOW + PLAN_ONBOARDING_WINDOW_MS });
    expect(materialize).toHaveBeenCalledWith('t1', ['dona']);
  });

  it('chamar de novo não reabre a janela: o prazo conta do primeiro começo', async () => {
    const startedAt = NOW - 60_000;
    const { useCase } = setup({ pending: ['com.acme.crm'], failed: [], startedAt });
    await expect(useCase.execute({ tenantId: 't1', userId: 'dona' })).resolves.toEqual({ windowEndsAt: startedAt + PLAN_ONBOARDING_WINDOW_MS });
  });

  it('janela vencida, lista vazia ou escritório sem lista: não há janela nem recomposição', async () => {
    for (const onboarding of [
      { pending: ['com.acme.crm'], failed: [], startedAt: NOW - PLAN_ONBOARDING_WINDOW_MS },
      { pending: [], failed: [] },
      null,
    ]) {
      const { useCase, materialize } = setup(onboarding);
      await expect(useCase.execute({ tenantId: 't1', userId: 'dona' })).resolves.toEqual({ windowEndsAt: null });
      expect(materialize).not.toHaveBeenCalled();
    }
  });

  it('só o dono começa', async () => {
    const { useCase, startOnboarding } = setup({ pending: ['com.acme.crm'], failed: [] });
    const refusal = await useCase.execute({ tenantId: 't1', userId: 'ana' }).catch((error: unknown) => error);
    expect((refusal as DomainError).code).toBe('permission-denied');
    expect(startOnboarding).not.toHaveBeenCalled();
  });
});
