import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { IScreenDefinitionRepository } from '../../repositories/IScreenDefinitionRepository';
import type { IActionRepository } from '../../repositories/IActionRepository';
import type { IScriptRepository } from '../../repositories/IScriptRepository';
import type { DeletionActor } from '../../entities';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import { planInstall, planUninstall } from '../../services/pluginLifecycle';
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

export type InstallMarketplacePluginUseCase = {
  execute: (plugin: MarketplacePlugin, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Instala um plugin: valida, MATERIALIZA os artefatos no tenant com remapeamento de ids e só então
 * grava o registro. Ordem obrigatória — scripts → workflows → actions → telas — porque cada tipo
 * referencia o anterior; os ids gerados na criação alimentam os mapas que reescrevem as referências.
 * Workflows são criados numa passada e corrigidos noutra (o `targetWorkflowId` de um workflow que
 * chama outro só existe depois que todos têm id).
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
        config: { name: plugin.manifest.name, summary: plugin.summary, workflowCount: plugin.workflows.length },
      },
      actor,
    );
    if (!outcome.ok) return { ok: false, error: outcome.error };

    // 1. Scripts (sem dependências).
    const scriptMap = new Map<string, string>();
    for (const template of plugin.scripts ?? []) {
      const created = await deps.scriptRepository.createScript(tenantId, scriptInputFromTemplate(template, pluginId));
      scriptMap.set(template.templateId, created.id);
    }

    // 2. Workflows — passada 1: cria com `scriptId` já remapeado e tela-gatilho namespaced.
    const screenKeyMap = buildScreenKeyMap(pluginId, plugin.screens ?? []);
    const workflowMap = new Map<string, string>();
    const createdWorkflows: { templateId: string; id: string }[] = [];
    for (const template of plugin.workflows) {
      const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
      const created = await deps.workflowRepository.createWorkflowDefinition(tenantId, input);
      workflowMap.set(template.templateId, created.id);
      createdWorkflows.push({ templateId: template.templateId, id: created.id });
    }

    // 3. Workflows — passada 2: remapeia `targetWorkflowId` (workflow que chama workflow).
    for (const template of plugin.workflows) {
      if (!workflowOutRefs(template).some((ref) => ref.kind === 'workflow')) continue;
      const created = createdWorkflows.find((w) => w.templateId === template.templateId);
      if (!created) continue;
      const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
      const steps = rewriteStepLiteral(input.steps, 'targetWorkflowId', workflowMap);
      await deps.workflowRepository.updateWorkflowSteps(tenantId, created.id, steps);
    }

    // 4. Actions — remapeia `workflowId`.
    const actionMap = new Map<string, string>();
    for (const template of plugin.actions ?? []) {
      const created = await deps.actionRepository.create(
        tenantId,
        actionInputFromTemplate(template, pluginId, workflowMap, userId),
      );
      actionMap.set(template.templateId, created.id);
    }

    // 5. Telas — chaves namespaced, refs entre telas e `viewActionIds`/`cardActionIds` remapeados.
    for (const template of plugin.screens ?? []) {
      const { screenKey, input } = materializeScreen(template, pluginId, screenKeyMap, userId, actionMap);
      await deps.screenRepository.upsert(tenantId, screenKey, input);
    }

    await deps.installationRepository.save(outcome.value);
    return { ok: true, installation: outcome.value };
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

    await deps.installationRepository.delete(tenantId, pluginId);
    return {
      ok: true,
      removedScreens: screens.length,
      removedActions: actions.length,
      removedWorkflows: workflows.length,
      removedScripts: scripts.length,
    };
  },
});
