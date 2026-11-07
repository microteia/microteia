import type { IInstalledCatalogSourceRepository } from '../../repositories/IInstalledCatalogSourceRepository';
import { KERNEL_VERSION } from '../../schema/plugin/kernelVersion';
import { buildInstalledCatalog } from './installedCatalogSnapshot';
import type { InstalledCatalogSnapshot } from './installedCatalogSnapshot';

export type ExportInstalledCatalogUseCase = {
  execute: (tenant: { id: string; name: string }, exportedAt: Date) => Promise<InstalledCatalogSnapshot>;
};

/**
 * O retrato tirado pela APLICAÇÃO. O `kernelVersion` é o do bundle que está rodando, e não o de um
 * manifesto em disco: é exatamente o contrato que instalou o que está sendo descrito.
 */
export const makeExportInstalledCatalogUseCase = (
  repo: IInstalledCatalogSourceRepository,
): ExportInstalledCatalogUseCase => ({
  execute: async (tenant, exportedAt) => {
    const { projectId, ...sources } = await repo.read(tenant.id);
    return buildInstalledCatalog({
      ...sources,
      projectId,
      tenant,
      kernelVersion: KERNEL_VERSION,
      exportedAt,
      exporter: { tool: 'application' },
    });
  },
});
