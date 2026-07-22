import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import { planInstall, planUninstall } from '../../services/pluginLifecycle';
import type { LifecycleResult } from './PluginLifecycleUseCases';

export interface MarketplaceDeps {
  workflowRepository: IWorkflowDefinitionRepository;
  installationRepository: IPluginInstallationRepository;
}

export type InstallMarketplacePluginUseCase = {
  execute: (plugin: MarketplacePlugin, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Instala um plugin do catálogo: valida a instalação, MATERIALIZA os workflows do plugin no tenant
 * (marcados com `ownerPluginId`, habilitados) e só então grava o registro de instalação. A ordem
 * importa — validar antes de criar evita workflow órfão se a regra recusar; gravar o registro por
 * último evita marcar como instalado algo cuja materialização falhou.
 */
export const makeInstallMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): InstallMarketplacePluginUseCase => ({
  execute: async (plugin, actor) => {
    const pluginId = plugin.manifest.id;
    const current = await deps.installationRepository.getById(actor.tenantId, pluginId);

    const outcome = planInstall(
      current,
      {
        pluginId,
        version: plugin.manifest.version,
        grantedPermissions: plugin.manifest.permissions ?? [],
      },
      actor,
    );
    if (!outcome.ok) return { ok: false, error: outcome.error };

    for (const template of plugin.workflows) {
      await deps.workflowRepository.createWorkflowDefinition(actor.tenantId, {
        ...template,
        ownerPluginId: pluginId,
        enabled: true,
      });
    }

    await deps.installationRepository.save(outcome.value);
    return { ok: true, installation: outcome.value };
  },
});

export type UninstallMarketplacePluginResult =
  | { ok: true; removedWorkflows: number }
  | LifecycleResult;

export type UninstallMarketplacePluginUseCase = {
  execute: (pluginId: string, actor: LifecycleActor) => Promise<UninstallMarketplacePluginResult>;
};

/**
 * Desinstala: valida, remove TODOS os workflows do tenant marcados com aquele `ownerPluginId`
 * (a cascata de artefatos que a Etapa 5 reservou) e por fim apaga o registro de instalação.
 */
export const makeUninstallMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): UninstallMarketplacePluginUseCase => ({
  execute: async (pluginId, actor) => {
    const current = await deps.installationRepository.getById(actor.tenantId, pluginId);
    const outcome = planUninstall(current);
    if (!outcome.ok) return { ok: false, error: outcome.error };

    const all = await deps.workflowRepository.getWorkflowDefinitions(actor.tenantId);
    const owned = all.filter((workflow) => workflow.ownerPluginId === pluginId);
    for (const workflow of owned) {
      await deps.workflowRepository.deleteWorkflowDefinition(actor.tenantId, workflow.id);
    }

    await deps.installationRepository.delete(actor.tenantId, pluginId);
    return { ok: true, removedWorkflows: owned.length };
  },
});
