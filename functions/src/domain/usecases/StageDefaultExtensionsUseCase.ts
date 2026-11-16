import type { IDefaultExtensionOnboardingRepository } from '../repositories/IDefaultExtensionOnboardingRepository';
import { defaultInstallPlan } from '../schema/plugin/defaultExtensions';

export type StageDefaultExtensionsUseCase = {
  execute: (tenantId: string) => Promise<void>;
};

/** O escritório que nasce sem extensão padrão nenhuma — a instalação que não marcou nenhuma. */
export const NO_DEFAULT_EXTENSIONS: StageDefaultExtensionsUseCase = { execute: async () => undefined };

/**
 * Fixa, na criação do escritório, o que ele vai receber instalado. A instalação em si é do navegador de
 * quem entra — a mesma porta da tela de Extensões —, e esta lista é o que ele lê.
 *
 * Falhar aqui NÃO impede o escritório de nascer: ele perde as extensões padrão, que a pessoa ainda
 * instala pela tela, mas não perde a entrada no sistema. O erro vai para o log.
 */
export const makeStageDefaultExtensionsUseCase = (deps: {
  onboarding: IDefaultExtensionOnboardingRepository;
  logger: { error: (message: string) => void };
}): StageDefaultExtensionsUseCase => ({
  execute: async (tenantId) => {
    try {
      const defaults = await deps.onboarding.readDefaults();
      if (defaults.length === 0) return;
      const plan = defaultInstallPlan(defaults, await deps.onboarding.readCatalog(defaults));
      if (plan.length === 0) return;
      await deps.onboarding.stage(tenantId, plan);
    } catch (error) {
      deps.logger.error(`[defaultExtensions] ${tenantId}: ${error instanceof Error ? error.message : String(error)}`);
    }
  },
});
