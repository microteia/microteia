import { describe, expect, it, vi } from 'vitest';
import { makeStageDefaultExtensionsUseCase } from './StageDefaultExtensionsUseCase';
import type { IDefaultExtensionOnboardingRepository } from '../repositories/IDefaultExtensionOnboardingRepository';

const setup = (defaults: string[], over: Partial<IDefaultExtensionOnboardingRepository> = {}) => {
  const onboarding = {
    readDefaults: vi.fn(async () => defaults),
    readCatalog: vi.fn(async (ids: readonly string[]) => ids.map((id) => ({ id, status: 'approved', proven: true }))),
    stage: vi.fn(async () => undefined),
    ...over,
  } satisfies IDefaultExtensionOnboardingRepository;
  const logger = { error: vi.fn() };
  return { useCase: makeStageDefaultExtensionsUseCase({ onboarding, logger }), onboarding, logger };
};

describe('StageDefaultExtensionsUseCase', () => {
  it('grava o plano do escritório novo', async () => {
    const { useCase, onboarding } = setup(['com.acme.a', 'com.acme.b']);
    await useCase.execute('t1');
    expect(onboarding.stage).toHaveBeenCalledWith('t1', ['com.acme.a', 'com.acme.b']);
  });

  it('sem padrão nenhuma, não grava documento — e nem lê o catálogo', async () => {
    const { useCase, onboarding } = setup([]);
    await useCase.execute('t1');
    expect(onboarding.readCatalog).not.toHaveBeenCalled();
    expect(onboarding.stage).not.toHaveBeenCalled();
  });

  it('marcada, mas sem nada instalável no catálogo: nada a gravar', async () => {
    const { useCase, onboarding } = setup(['com.acme.a'], { readCatalog: vi.fn(async () => []) });
    await useCase.execute('t1');
    expect(onboarding.stage).not.toHaveBeenCalled();
  });

  it('a falha não impede o escritório de nascer: vai para o log', async () => {
    const { useCase, logger } = setup(['com.acme.a'], { stage: vi.fn(async () => { throw new Error('boom'); }) });
    await expect(useCase.execute('t1')).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(expect.stringContaining('boom'));
  });
});
