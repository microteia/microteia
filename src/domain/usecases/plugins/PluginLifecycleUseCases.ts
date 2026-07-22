import type { InstallPluginInput } from '../../entities/PluginInstallation';
import type { PluginInstallation, PluginLifecycleError } from '../../entities/PluginInstallation';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { LifecycleActor, LifecycleOutcome } from '../../services/pluginLifecycle';
import {
  planDisable,
  planEnable,
  planInstall,
  planUninstall,
  planUpgrade,
} from '../../services/pluginLifecycle';

export type LifecycleResult = { ok: true; installation: PluginInstallation | null } | { ok: false; error: PluginLifecycleError };

const persist = async (
  repo: IPluginInstallationRepository,
  outcome: LifecycleOutcome<PluginInstallation>,
): Promise<LifecycleResult> => {
  if (!outcome.ok) return { ok: false, error: outcome.error };
  await repo.save(outcome.value);
  return { ok: true, installation: outcome.value };
};

export type InstallPluginUseCase = {
  execute: (input: InstallPluginInput, actor: LifecycleActor) => Promise<LifecycleResult>;
};

export const makeInstallPluginUseCase = (repo: IPluginInstallationRepository): InstallPluginUseCase => ({
  execute: async (input, actor) => {
    const current = await repo.getById(actor.tenantId, input.pluginId);
    return persist(repo, planInstall(current, input, actor));
  },
});

export type EnablePluginUseCase = {
  execute: (pluginId: string, actor: LifecycleActor) => Promise<LifecycleResult>;
};

export const makeEnablePluginUseCase = (repo: IPluginInstallationRepository): EnablePluginUseCase => ({
  execute: async (pluginId, actor) => {
    const current = await repo.getById(actor.tenantId, pluginId);
    return persist(repo, planEnable(current, actor));
  },
});

export type DisablePluginUseCase = {
  execute: (pluginId: string, actor: LifecycleActor) => Promise<LifecycleResult>;
};

export const makeDisablePluginUseCase = (repo: IPluginInstallationRepository): DisablePluginUseCase => ({
  execute: async (pluginId, actor) => {
    const current = await repo.getById(actor.tenantId, pluginId);
    return persist(repo, planDisable(current, actor));
  },
});

export type UpgradePluginUseCase = {
  execute: (pluginId: string, nextVersion: string, actor: LifecycleActor) => Promise<LifecycleResult>;
};

export const makeUpgradePluginUseCase = (repo: IPluginInstallationRepository): UpgradePluginUseCase => ({
  execute: async (pluginId, nextVersion, actor) => {
    const current = await repo.getById(actor.tenantId, pluginId);
    return persist(repo, planUpgrade(current, nextVersion, actor));
  },
});

export type UninstallPluginUseCase = {
  execute: (pluginId: string, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Remove a instalação. A varredura de artefatos com `ownerPluginId` (telas, workflows, scripts do
 * plugin) fica para a Etapa 7, quando esses artefatos passam a existir — aqui só o registro sai.
 */
export const makeUninstallPluginUseCase = (repo: IPluginInstallationRepository): UninstallPluginUseCase => ({
  execute: async (pluginId, actor) => {
    const current = await repo.getById(actor.tenantId, pluginId);
    const outcome = planUninstall(current);
    if (!outcome.ok) return { ok: false, error: outcome.error };
    await repo.delete(actor.tenantId, pluginId);
    return { ok: true, installation: null };
  },
});
