import type { IExtensionStatsRepository } from '../repositories/IExtensionStatsRepository';

export interface RecountInstallsInput {
  pluginId: string;
  tenantId: string;
  installed: boolean;
}

export type RecountExtensionInstallsUseCase = {
  execute: (input: RecountInstallsInput) => Promise<number>;
};

export type RecountExtensionRatingsUseCase = {
  execute: (pluginId: string) => Promise<{ count: number; sum: number }>;
};

/**
 * Marca (ou desmarca) o escritório e reconta. Na primeira vez que a extensão é vista, levanta as
 * instalações que já existiam antes desta contagem — sem isso toda extensão instalada antes do
 * deploy apareceria com o número dos que a instalaram depois dele.
 */
export const makeRecountExtensionInstallsUseCase = (
  repo: IExtensionStatsRepository,
): RecountExtensionInstallsUseCase => ({
  execute: async ({ pluginId, tenantId, installed }) => {
    await repo.setInstallMarker(pluginId, tenantId, installed);
    if (!(await repo.isInstallCountSeeded(pluginId))) {
      await repo.seedInstallMarkers(pluginId, await repo.findCatalogInstallTenants(pluginId));
    }
    const installs = await repo.countInstallMarkers(pluginId);
    await repo.writeInstallCount(pluginId, installs);
    return installs;
  },
});

export const makeRecountExtensionRatingsUseCase = (
  repo: IExtensionStatsRepository,
): RecountExtensionRatingsUseCase => ({
  execute: async (pluginId) => {
    const totals = await repo.aggregateRatings(pluginId);
    await repo.writeRatings(pluginId, totals.count, totals.sum);
    return totals;
  },
});
