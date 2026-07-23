import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';
import type { IActionRepository } from '../../repositories/IActionRepository';
import type { IScriptRepository } from '../../repositories/IScriptRepository';
import type { DeletionActor } from '../../entities';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import { planInstall, planUninstall, planUpgrade } from '../../services/pluginLifecycle';
import type { LifecycleResult } from './PluginLifecycleUseCases';
import { buildScreenKeyMap, materializeScreen } from './screenModule';
import {
  actionInputFromTemplate,
  rewriteStepLiteral,
  scriptInputFromTemplate,
  workflowInputFromTemplate,
} from './packageMaterialize';
import { workflowOutRefs } from './pluginReferences';

export interface MarketplaceDeps {
  workflowRepository: IWorkflowDefinitionRepository;
  installationRepository: IPluginInstallationRepository;
  screenRepository: IScreenDefinitionRepository;
  actionRepository: IActionRepository;
  scriptRepository: IScriptRepository;
}

const deletionActor = (actor: LifecycleActor): DeletionActor => ({
  uid: actor.userId,
  name: actor.userId,
  photoURL: '',
});

const displayConfig = (plugin: MarketplacePlugin): Record<string, unknown> => ({
  name: plugin.manifest.name,
  summary: plugin.summary,
  workflowCount: plugin.workflows.length,
});

/**
 * Cria os artefatos com id gerado (scripts → workflows → actions) e devolve os mapas
 * `templateId → idReal` das actions e das telas. Ordem obrigatória: cada tipo referencia o anterior,
 * e os ids criados alimentam a reescrita. Workflows nascem numa passada e são corrigidos noutra (o
 * `targetWorkflowId` de um workflow que chama outro só existe depois que todos têm id). As telas
 * ficam a cargo de quem chama, porque install e upgrade tratam-nas de formas diferentes.
 */
const materializeArtifacts = async (
  deps: MarketplaceDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
): Promise<{ actionMap: Map<string, string>; screenKeyMap: Map<string, string> }> => {
  const pluginId = plugin.manifest.id;

  const scriptMap = new Map<string, string>();
  for (const template of plugin.scripts ?? []) {
    const created = await deps.scriptRepository.createScript(tenantId, scriptInputFromTemplate(template, pluginId));
    scriptMap.set(template.templateId, created.id);
  }

  const screenKeyMap = buildScreenKeyMap(pluginId, plugin.screens ?? []);
  const workflowMap = new Map<string, string>();
  const createdWorkflows: { templateId: string; id: string }[] = [];
  for (const template of plugin.workflows) {
    const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
    const created = await deps.workflowRepository.createWorkflowDefinition(tenantId, input);
    workflowMap.set(template.templateId, created.id);
    createdWorkflows.push({ templateId: template.templateId, id: created.id });
  }

  for (const template of plugin.workflows) {
    if (!workflowOutRefs(template).some((ref) => ref.kind === 'workflow')) continue;
    const created = createdWorkflows.find((w) => w.templateId === template.templateId);
    if (!created) continue;
    const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
    const steps = rewriteStepLiteral(input.steps, 'targetWorkflowId', workflowMap);
    await deps.workflowRepository.updateWorkflowSteps(tenantId, created.id, steps);
  }

  const actionMap = new Map<string, string>();
  for (const template of plugin.actions ?? []) {
    const created = await deps.actionRepository.create(
      tenantId,
      actionInputFromTemplate(template, pluginId, workflowMap, userId),
    );
    actionMap.set(template.templateId, created.id);
  }

  return { actionMap, screenKeyMap };
};

/** Remove os artefatos de id gerado (actions, workflows, scripts) daquele plugin. Telas à parte. */
const removeGeneratedArtifacts = async (
  deps: MarketplaceDeps,
  tenantId: string,
  pluginId: string,
  actor: LifecycleActor,
): Promise<{ removedActions: number; removedWorkflows: number; removedScripts: number }> => {
  const actions = (await deps.actionRepository.getAll(tenantId)).filter((a) => a.ownerPluginId === pluginId);
  for (const action of actions) {
    await deps.actionRepository.delete(tenantId, action.id, deletionActor(actor));
  }

  const workflows = (await deps.workflowRepository.getWorkflowDefinitions(tenantId)).filter(
    (w) => w.ownerPluginId === pluginId,
  );
  for (const workflow of workflows) {
    await deps.workflowRepository.deleteWorkflowDefinition(tenantId, workflow.id);
  }

  const scripts = (await deps.scriptRepository.getScripts(tenantId)).filter((s) => s.ownerPluginId === pluginId);
  for (const script of scripts) {
    await deps.scriptRepository.deleteScript(tenantId, script.id);
  }

  return { removedActions: actions.length, removedWorkflows: workflows.length, removedScripts: scripts.length };
};

/** Campos que o usuário acrescentou a uma tela gerenciada (sem o `ownerPluginId` do plugin, e cuja
 * chave não colide com um campo da nova versão) — preservados na atualização. */
const preservedUserFields = <T extends { key: string; ownerPluginId?: string | null }>(
  existingFields: T[],
  pluginFields: T[],
  pluginId: string,
): T[] => {
  const pluginKeys = new Set(pluginFields.map((f) => f.key));
  return existingFields.filter((f) => f.ownerPluginId !== pluginId && !pluginKeys.has(f.key));
};

export type InstallMarketplacePluginUseCase = {
  execute: (plugin: MarketplacePlugin, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Instala um plugin: valida, MATERIALIZA os artefatos no tenant com remapeamento de ids e só então
 * grava o registro. As telas são criadas por `upsert` na chave namespaced determinística.
 */
export const makeInstallMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): InstallMarketplacePluginUseCase => ({
  execute: async (plugin, actor) => {
    const pluginId = plugin.manifest.id;
    const { tenantId, userId } = actor;
    const current = await deps.installationRepository.getById(tenantId, pluginId);

    const outcome = planInstall(
      current,
      {
        pluginId,
        version: plugin.manifest.version,
        grantedPermissions: plugin.manifest.permissions ?? [],
        // Cache denormalizado para exibir extensões importadas (fora do catálogo) na tela de Extensões.
        config: displayConfig(plugin),
      },
      actor,
    );
    if (!outcome.ok) return { ok: false, error: outcome.error };

    const { actionMap, screenKeyMap } = await materializeArtifacts(deps, plugin, tenantId, userId);

    for (const template of plugin.screens ?? []) {
      const { screenKey, input } = materializeScreen(template, pluginId, screenKeyMap, userId, actionMap);
      await deps.screenRepository.upsert(tenantId, screenKey, input);
    }

    await deps.installationRepository.save(outcome.value);
    return { ok: true, installation: outcome.value };
  },
});

export type UpgradeMarketplacePluginUseCase = {
  execute: (plugin: MarketplacePlugin, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Atualiza um plugin já instalado para uma versão mais recente. Os artefatos de id gerado (actions,
 * workflows, scripts) são recriados do zero; as telas são reconciliadas por chave determinística:
 * `upsert` das que continuam (PRESERVANDO os campos que o usuário adicionou por cima — os sem
 * `ownerPluginId` do plugin) e exclusão das que sumiram na nova versão. Os REGISTROS (customRecords)
 * seguem intactos, pois vivem pela chave da tela, que não muda entre versões.
 */
export const makeUpgradeMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): UpgradeMarketplacePluginUseCase => ({
  execute: async (plugin, actor) => {
    const pluginId = plugin.manifest.id;
    const { tenantId, userId } = actor;
    const current = await deps.installationRepository.getById(tenantId, pluginId);

    const outcome = planUpgrade(current, plugin.manifest.version, actor);
    if (!outcome.ok) return { ok: false, error: outcome.error };

    await removeGeneratedArtifacts(deps, tenantId, pluginId, actor);
    const { actionMap, screenKeyMap } = await materializeArtifacts(deps, plugin, tenantId, userId);

    const ownedScreens = (await deps.screenRepository.getAll(tenantId)).filter((s) => s.ownerPluginId === pluginId);
    const nextKeys = new Set<string>();
    for (const template of plugin.screens ?? []) {
      const { screenKey, input } = materializeScreen(template, pluginId, screenKeyMap, userId, actionMap);
      nextKeys.add(screenKey);
      const existing = ownedScreens.find((s) => s.id === screenKey);
      const merged = existing
        ? { ...input, fields: [...input.fields, ...preservedUserFields(existing.fields, input.fields, pluginId)] }
        : input;
      await deps.screenRepository.upsert(tenantId, screenKey, merged);
    }
    for (const screen of ownedScreens) {
      if (!nextKeys.has(screen.id)) {
        await deps.screenRepository.delete(tenantId, screen.id, deletionActor(actor));
      }
    }

    const installation = { ...outcome.value, config: displayConfig(plugin) };
    await deps.installationRepository.save(installation);
    return { ok: true, installation };
  },
});

export interface UninstallCounts {
  removedScreens: number;
  removedActions: number;
  removedWorkflows: number;
  removedScripts: number;
}

export type UninstallMarketplacePluginResult = ({ ok: true } & UninstallCounts) | LifecycleResult;

export type UninstallMarketplacePluginUseCase = {
  execute: (pluginId: string, actor: LifecycleActor) => Promise<UninstallMarketplacePluginResult>;
};

/**
 * Desinstala: valida e remove TODOS os artefatos do tenant marcados com aquele `ownerPluginId` —
 * telas, actions, workflows e scripts. Os REGISTROS (customRecords) das telas são mantidos como
 * órfãos: a estrutura some, os dados ficam.
 */
export const makeUninstallMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): UninstallMarketplacePluginUseCase => ({
  execute: async (pluginId, actor) => {
    const { tenantId } = actor;
    const current = await deps.installationRepository.getById(tenantId, pluginId);
    const outcome = planUninstall(current);
    if (!outcome.ok) return { ok: false, error: outcome.error };

    const screens = (await deps.screenRepository.getAll(tenantId)).filter((s) => s.ownerPluginId === pluginId);
    for (const screen of screens) {
      await deps.screenRepository.delete(tenantId, screen.id, deletionActor(actor));
    }

    const { removedActions, removedWorkflows, removedScripts } = await removeGeneratedArtifacts(
      deps, tenantId, pluginId, actor,
    );

    await deps.installationRepository.delete(tenantId, pluginId);
    return {
      ok: true,
      removedScreens: screens.length,
      removedActions,
      removedWorkflows,
      removedScripts,
    };
  },
});
