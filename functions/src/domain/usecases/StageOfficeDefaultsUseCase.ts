import type { IOfficeDefaultsRepository } from '../repositories/IOfficeDefaultsRepository';
import { defaultInstallPlan } from '../schema/plugin/defaultExtensions';

export type StageOfficeDefaultsUseCase = {
  execute: (tenantId: string) => Promise<void>;
};

/** O escritório que nasce sem nada decidido pela instalação. */
export const NO_OFFICE_DEFAULTS: StageOfficeDefaultsUseCase = { execute: async () => undefined };

/**
 * Fixa, na criação do escritório, o que a instalação decidiu que ele recebe: o idioma e as extensões
 * padrão. A instalação das extensões é do navegador de quem entra — a mesma porta da tela de
 * Extensões —, e a lista gravada aqui é o que ele lê.
 *
 * O IDIOMA VEM PRIMEIRO, e não por estética: a semente de tela é resolvida no idioma GRAVADO do
 * escritório no instante em que o servidor a grava. Com o idioma ainda ausente, a primeira extensão
 * padrão semearia em inglês — e o que foi semeado é dado do escritório, que trocar o idioma não retraduz.
 *
 * Falhar aqui NÃO impede o escritório de nascer, e uma parte não impede a outra: sem o idioma ele ainda
 * recebe as extensões, e sem as extensões ainda tem o idioma. O erro vai para o log.
 */
export const makeStageOfficeDefaultsUseCase = (deps: {
  defaults: IOfficeDefaultsRepository;
  logger: { error: (message: string) => void };
}): StageOfficeDefaultsUseCase => {
  const report = (tenantId: string, what: string, error: unknown) =>
    deps.logger.error(`[officeDefaults:${what}] ${tenantId}: ${error instanceof Error ? error.message : String(error)}`);
  const logged = (tenantId: string, what: string, step: () => Promise<void>) =>
    step().catch((error: unknown) => report(tenantId, what, error));

  return {
    execute: async (tenantId) => {
      const intent = await deps.defaults.readIntent().catch((error: unknown) => {
        report(tenantId, 'read', error);
        return null;
      });
      if (!intent) return;
      const { locale, extensions } = intent;

      if (locale) await logged(tenantId, 'locale', () => deps.defaults.setLocale(tenantId, locale));

      if (extensions.length === 0) return;
      await logged(tenantId, 'extensions', async () => {
        const plan = defaultInstallPlan(extensions, await deps.defaults.readCatalog(extensions));
        if (plan.length > 0) await deps.defaults.stage(tenantId, plan);
      });
    },
  };
};
