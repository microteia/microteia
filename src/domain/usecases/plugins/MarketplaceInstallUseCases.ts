import type { MarketplacePlugin } from '../../entities/MarketplacePlugin';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IPluginInstallationRepository } from '../../repositories/IPluginInstallationRepository';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';
import type { IActionRepository } from '../../repositories/IActionRepository';
import type { IScriptRepository } from '../../repositories/IScriptRepository';
import type { DeletionActor, ScreenDefinition } from '../../entities';
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
import type { ILookupDefinitionRepository } from '../../repositories/ILookupDefinitionRepository';
import { isLookupCollection } from '../../schema/lookupRegistry';
import type { ITagDefinitionRepository } from '../../repositories/ITagDefinitionRepository';
import { ENTITY_REGISTRY_LIST } from '../../schema/entityRegistry';

/** Coleções de etiquetas declaradas em código — não recebem documento de declaração. */
const BUILTIN_TAG_COLLECTIONS = new Set(
  ENTITY_REGISTRY_LIST.map((entity) => entity.tagCollection).filter(Boolean) as string[],
);

/** Repositórios necessários para materializar/liberar os artefatos de dados de um pacote (telas,
 *  actions, workflows, scripts) — sem depender do registro de instalação. Reusado tanto pela máquina
 *  antiga (PluginInstallation) quanto pelo novo fluxo de extensões instaladas (`installed_extensions`). */
export interface ArtifactDeps {
  workflowRepository: IWorkflowDefinitionRepository;
  screenRepository: IScreenDefinitionRepository;
  actionRepository: IActionRepository;
  scriptRepository: IScriptRepository;
  lookupDefinitionRepository: ILookupDefinitionRepository;
  tagDefinitionRepository: ITagDefinitionRepository;
}

export interface MarketplaceDeps extends ArtifactDeps {
  installationRepository: IPluginInstallationRepository;
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

const stripUndefined = <T>(value: T): T => {
  if (Array.isArray(value)) return value.map((item) => stripUndefined(item)) as T;
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .filter(([, v]) => v !== undefined)
        .map(([k, v]) => [k, stripUndefined(v)]),
    ) as T;
  }
  return value;
};

// --- Refcount de donos: um artefato pode pertencer a VÁRIAS extensões ao mesmo tempo. -------------

type Owned = { ownerPluginId?: string | null; ownerPluginIds?: string[] | null };

/** Conjunto de donos, tolerando o campo antigo `ownerPluginId` (singular) de dados anteriores. */
const ownerSet = (a: Owned): string[] =>
  a.ownerPluginIds && a.ownerPluginIds.length ? a.ownerPluginIds : (a.ownerPluginId ? [a.ownerPluginId] : []);

const addOwner = (owners: string[], pluginId: string): string[] =>
  owners.includes(pluginId) ? owners : [...owners, pluginId];

const removeOwner = (owners: string[], pluginId: string): string[] => owners.filter((o) => o !== pluginId);

/** União preservando ordem: os ids do template primeiro, mais os que só existiam na tela (do usuário). */
const unionIds = (base: string[] = [], extra: string[] = []): string[] => {
  const seen = new Set(base);
  return [...base, ...extra.filter((id) => !seen.has(id))];
};

/** Revisão de origem de um artefato (0 quando ausente — legado materializado antes do campo). O
 * conteúdo só é reescrito quando a revisão que CHEGA (template) é estritamente maior que a atual. */
const revOf = (a: { sourceRev?: number | null }): number => a.sourceRev ?? 0;

const screenToInput = (screen: ScreenDefinition): ScreenDefinitionInput => {
  const clone = { ...screen } as Record<string, unknown>;
  for (const key of ['id', 'tenantId', 'createdAt', 'updatedAt', 'deletedBy', 'deletedByName', 'deletedByPhotoURL']) {
    delete clone[key];
  }
  return stripUndefined(clone) as unknown as ScreenDefinitionInput;
};

/** Campos que o usuário acrescentou a uma tela gerenciada (sem o `ownerPluginId` do plugin, e cuja
 * chave não colide com um campo da nova versão) — preservados na atualização/reuso. */
const preservedUserFields = <T extends { key: string; ownerPluginId?: string | null }>(
  existingFields: T[],
  pluginFields: T[],
  pluginId: string,
): T[] => {
  const pluginKeys = new Set(pluginFields.map((f) => f.key));
  return existingFields.filter((f) => f.ownerPluginId !== pluginId && !pluginKeys.has(f.key));
};

// --- Materialização com DEDUPLICAÇÃO por `sourceId` ----------------------------------------------

/**
 * Cria (ou REUSA) os artefatos de id gerado — scripts → workflows → actions — devolvendo os mapas
 * `templateId → idReal` das actions e das telas. A deduplicação é por `sourceId` (o id universal de
 * origem): se um artefato com o mesmo `sourceId` já existe no tenant (trazido por outra extensão),
 * reusa-se ele e apenas acrescenta este plugin ao conjunto de donos — nunca duplica.
 */
const materializeArtifacts = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
  existingScreens: ScreenDefinition[],
): Promise<{ actionMap: Map<string, string>; screenKeyMap: Map<string, string> }> => {
  const pluginId = plugin.manifest.id;

  const existingScripts = await deps.scriptRepository.getScripts(tenantId);
  const scriptMap = new Map<string, string>();
  for (const template of plugin.scripts ?? []) {
    const existing = existingScripts.find((s) => s.sourceId === template.templateId);
    if (existing) {
      scriptMap.set(template.templateId, existing.id);
      const owners = addOwner(ownerSet(existing), pluginId);
      if (revOf(template) > revOf(existing)) {
        await deps.scriptRepository.updateScript(tenantId, existing.id, {
          ...scriptInputFromTemplate(template, pluginId),
          ownerPluginIds: owners,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
        });
      } else if (owners.length !== ownerSet(existing).length) {
        await deps.scriptRepository.updateScript(tenantId, existing.id, { ownerPluginIds: owners, ownerPluginId: existing.ownerPluginId ?? pluginId });
      }
    } else {
      const created = await deps.scriptRepository.createScript(tenantId, scriptInputFromTemplate(template, pluginId));
      scriptMap.set(template.templateId, created.id);
    }
  }

  const screenKeyMap = buildScreenKeyMap(pluginId, plugin.screens ?? [], existingScreens);

  const existingWorkflows = await deps.workflowRepository.getWorkflowDefinitions(tenantId);
  const workflowMap = new Map<string, string>();
  // Workflows TOCADOS (criados OU reescritos in-place) — os que a passada 2 precisa remapear.
  const touchedWorkflows: { templateId: string; id: string }[] = [];
  for (const template of plugin.workflows) {
    const existing = existingWorkflows.find((w) => w.sourceId === template.templateId);
    if (existing) {
      workflowMap.set(template.templateId, existing.id);
      const owners = addOwner(ownerSet(existing), pluginId);
      if (revOf(template) > revOf(existing)) {
        const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
        // Reescreve o conteúdo mas PRESERVA o estado local do tenant (`enabled`) e o dono primário.
        await deps.workflowRepository.updateWorkflowDefinition(tenantId, existing.id, {
          ...input,
          enabled: existing.enabled,
          ownerPluginIds: owners,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
        });
        touchedWorkflows.push({ templateId: template.templateId, id: existing.id });
      } else if (owners.length !== ownerSet(existing).length) {
        await deps.workflowRepository.updateWorkflowDefinition(tenantId, existing.id, { ownerPluginIds: owners, ownerPluginId: existing.ownerPluginId ?? pluginId });
      }
    } else {
      const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
      const created = await deps.workflowRepository.createWorkflowDefinition(tenantId, input);
      workflowMap.set(template.templateId, created.id);
      touchedWorkflows.push({ templateId: template.templateId, id: created.id });
    }
  }

  // Passada 2 — nos workflows tocados que chamam outro workflow, remapeia `targetWorkflowId` para os
  // ids reais (os reusados sem reescrita já têm os passos corretos, então ficam de fora).
  for (const template of plugin.workflows) {
    if (!workflowOutRefs(template).some((ref) => ref.kind === 'workflow')) continue;
    const touched = touchedWorkflows.find((w) => w.templateId === template.templateId);
    if (!touched) continue;
    const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenKeyMap);
    const steps = rewriteStepLiteral(input.steps, 'targetWorkflowId', workflowMap);
    await deps.workflowRepository.updateWorkflowSteps(tenantId, touched.id, steps);
  }

  const existingActions = await deps.actionRepository.getAll(tenantId);
  const actionMap = new Map<string, string>();
  for (const template of plugin.actions ?? []) {
    const existing = existingActions.find((a) => a.sourceId === template.templateId);
    if (existing) {
      actionMap.set(template.templateId, existing.id);
      const owners = addOwner(ownerSet(existing), pluginId);
      if (revOf(template) > revOf(existing)) {
        await deps.actionRepository.update(tenantId, existing.id, {
          ...actionInputFromTemplate(template, pluginId, workflowMap, userId),
          ownerPluginIds: owners,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
        });
      } else if (owners.length !== ownerSet(existing).length) {
        await deps.actionRepository.update(tenantId, existing.id, { ownerPluginIds: owners, ownerPluginId: existing.ownerPluginId ?? pluginId });
      }
    } else {
      const created = await deps.actionRepository.create(
        tenantId,
        actionInputFromTemplate(template, pluginId, workflowMap, userId),
      );
      actionMap.set(template.templateId, created.id);
    }
  }

  return { actionMap, screenKeyMap };
};

/**
 * Materializa as telas do pacote por `upsert`. Se a tela já existe (mesma chave — reuso por
 * `sourceId` ou reinstalação), UNE o conjunto de donos e PRESERVA os campos que o usuário adicionou
 * por cima. Devolve as chaves tocadas (o upgrade usa para achar as telas que sumiram).
 */
const upsertPluginScreens = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
  screenKeyMap: Map<string, string>,
  actionMap: Map<string, string>,
  existingScreens: ScreenDefinition[],
): Promise<Set<string>> => {
  const pluginId = plugin.manifest.id;
  const nextKeys = new Set<string>();
  for (const template of plugin.screens ?? []) {
    const { screenKey, input } = materializeScreen(template, pluginId, screenKeyMap, userId, actionMap);
    nextKeys.add(screenKey);
    const existing = existingScreens.find((s) => s.id === screenKey);
    const merged = existing
      ? {
          ...input,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
          ownerPluginIds: addOwner(ownerSet(existing), pluginId),
          fields: [...input.fields, ...preservedUserFields(existing.fields, input.fields, pluginId)],
          // Ações do card/detalhe que o usuário configurou por cima (Form Design) são preservadas —
          // sem isso, reinstalar/atualizar as apagaria, já que o template não as traz.
          viewActionIds: unionIds(input.viewActionIds, existing.viewActionIds),
          cardActionIds: unionIds(input.cardActionIds, existing.cardActionIds),
        }
      : input;
    await deps.screenRepository.upsert(tenantId, screenKey, merged);
  }
  return nextKeys;
};

/**
 * Declara as listas do pacote, acrescentando este plugin aos donos. Uma lista do kernel já é
 * declarada em código e não ganha documento — replicá-la transformaria cada mudança do registro
 * numa migração de dados.
 */
const declarePluginLookups = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
): Promise<void> => {
  const templates = (plugin.lookups ?? []).filter((lookup) => !isLookupCollection(lookup.collection));
  if (templates.length === 0) return;
  const pluginId = plugin.manifest.id;
  const existing = await deps.lookupDefinitionRepository.getAll(tenantId);
  for (const template of templates) {
    const current = existing.find((definition) => definition.collection === template.collection);
    const owners = addOwner(ownerSet(current ?? {}), pluginId);
    await deps.lookupDefinitionRepository.upsert(tenantId, {
      collection: template.collection,
      label: current?.label ?? template.label,
      ownerPluginId: owners[0],
      ownerPluginIds: owners,
      createdBy: current?.createdBy ?? userId,
    });
  }
};

/**
 * Libera as listas deste plugin. Sem donos, some apenas a DECLARAÇÃO — as opções cadastradas pelo
 * escritório ficam na coleção, e voltam a valer assim que alguém recriar a lista com o mesmo nome.
 * É o mesmo princípio que já vale para os registros de uma tela desinstalada.
 */
const releasePluginLookups = async (
  deps: ArtifactDeps,
  tenantId: string,
  pluginId: string,
): Promise<void> => {
  for (const definition of await deps.lookupDefinitionRepository.getAll(tenantId)) {
    if (!ownerSet(definition).includes(pluginId)) continue;
    const owners = removeOwner(ownerSet(definition), pluginId);
    if (owners.length === 0) {
      await deps.lookupDefinitionRepository.delete(tenantId, definition.collection);
    } else {
      await deps.lookupDefinitionRepository.upsert(tenantId, {
        ...definition,
        ownerPluginId: owners[0],
        ownerPluginIds: owners,
      });
    }
  }
};

/** Declara os conjuntos de etiquetas do pacote. Os do kernel (`caseTags`) não ganham documento. */
const declarePluginTagLists = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
): Promise<void> => {
  const templates = (plugin.tagLists ?? []).filter((tagList) => !BUILTIN_TAG_COLLECTIONS.has(tagList.collection));
  if (templates.length === 0) return;
  const pluginId = plugin.manifest.id;
  const existing = await deps.tagDefinitionRepository.getAll(tenantId);
  for (const template of templates) {
    const current = existing.find((definition) => definition.collection === template.collection);
    const owners = addOwner(ownerSet(current ?? {}), pluginId);
    await deps.tagDefinitionRepository.upsert(tenantId, {
      collection: template.collection,
      label: current?.label ?? template.label,
      ownerPluginId: owners[0],
      ownerPluginIds: owners,
      createdBy: current?.createdBy ?? userId,
    });
  }
};

/** Libera os conjuntos deste plugin. Sem donos, some só a DECLARAÇÃO — as etiquetas ficam. */
const releasePluginTagLists = async (
  deps: ArtifactDeps,
  tenantId: string,
  pluginId: string,
): Promise<void> => {
  for (const definition of await deps.tagDefinitionRepository.getAll(tenantId)) {
    if (!ownerSet(definition).includes(pluginId)) continue;
    const owners = removeOwner(ownerSet(definition), pluginId);
    if (owners.length === 0) {
      await deps.tagDefinitionRepository.delete(tenantId, definition.collection);
    } else {
      await deps.tagDefinitionRepository.upsert(tenantId, {
        ...definition,
        ownerPluginId: owners[0],
        ownerPluginIds: owners,
      });
    }
  }
};

// --- Liberação com refcount: remove o plugin do dono; só apaga quando ninguém mais usa. -----------

const releaseScreen = async (deps: ArtifactDeps, tenantId: string, screen: ScreenDefinition, pluginId: string, actor: LifecycleActor): Promise<boolean> => {
  const owners = removeOwner(ownerSet(screen), pluginId);
  if (owners.length === 0) {
    await deps.screenRepository.delete(tenantId, screen.id, deletionActor(actor));
    return true;
  }
  await deps.screenRepository.upsert(tenantId, screen.id, { ...screenToInput(screen), ownerPluginIds: owners, ownerPluginId: owners[0] });
  return false;
};

const releaseGeneratedArtifacts = async (
  deps: ArtifactDeps,
  tenantId: string,
  pluginId: string,
  actor: LifecycleActor,
): Promise<{ removedActions: number; removedWorkflows: number; removedScripts: number }> => {
  let removedActions = 0;
  for (const action of (await deps.actionRepository.getAll(tenantId)).filter((a) => ownerSet(a).includes(pluginId))) {
    const owners = removeOwner(ownerSet(action), pluginId);
    if (owners.length === 0) { await deps.actionRepository.delete(tenantId, action.id, deletionActor(actor)); removedActions += 1; }
    else await deps.actionRepository.update(tenantId, action.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }

  let removedWorkflows = 0;
  for (const workflow of (await deps.workflowRepository.getWorkflowDefinitions(tenantId)).filter((w) => ownerSet(w).includes(pluginId))) {
    const owners = removeOwner(ownerSet(workflow), pluginId);
    if (owners.length === 0) { await deps.workflowRepository.deleteWorkflowDefinition(tenantId, workflow.id); removedWorkflows += 1; }
    else await deps.workflowRepository.updateWorkflowDefinition(tenantId, workflow.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }

  let removedScripts = 0;
  for (const script of (await deps.scriptRepository.getScripts(tenantId)).filter((s) => ownerSet(s).includes(pluginId))) {
    const owners = removeOwner(ownerSet(script), pluginId);
    if (owners.length === 0) { await deps.scriptRepository.deleteScript(tenantId, script.id); removedScripts += 1; }
    else await deps.scriptRepository.updateScript(tenantId, script.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }

  return { removedActions, removedWorkflows, removedScripts };
};

/**
 * Libera (refcount) os artefatos gerados que ESTE plugin possuía e que a versão nova do pacote NÃO
 * traz mais (o `sourceId` sumiu do conjunto de `templateId`s). Espelha a remoção que a reconciliação
 * de telas já faz — mantém o `applyPackageArtifacts` idempotente também na remoção.
 */
const releaseVanishedGeneratedArtifacts = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  pluginId: string,
  actor: LifecycleActor,
): Promise<void> => {
  const keepWorkflows = new Set((plugin.workflows ?? []).map((t) => t.templateId));
  const keepActions = new Set((plugin.actions ?? []).map((t) => t.templateId));
  const keepScripts = new Set((plugin.scripts ?? []).map((t) => t.templateId));

  for (const workflow of (await deps.workflowRepository.getWorkflowDefinitions(tenantId))
    .filter((w) => ownerSet(w).includes(pluginId) && !keepWorkflows.has(w.sourceId ?? ''))) {
    const owners = removeOwner(ownerSet(workflow), pluginId);
    if (owners.length === 0) await deps.workflowRepository.deleteWorkflowDefinition(tenantId, workflow.id);
    else await deps.workflowRepository.updateWorkflowDefinition(tenantId, workflow.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }

  for (const action of (await deps.actionRepository.getAll(tenantId))
    .filter((a) => ownerSet(a).includes(pluginId) && !keepActions.has(a.sourceId ?? ''))) {
    const owners = removeOwner(ownerSet(action), pluginId);
    if (owners.length === 0) await deps.actionRepository.delete(tenantId, action.id, deletionActor(actor));
    else await deps.actionRepository.update(tenantId, action.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }

  for (const script of (await deps.scriptRepository.getScripts(tenantId))
    .filter((s) => ownerSet(s).includes(pluginId) && !keepScripts.has(s.sourceId ?? ''))) {
    const owners = removeOwner(ownerSet(script), pluginId);
    if (owners.length === 0) await deps.scriptRepository.deleteScript(tenantId, script.id);
    else await deps.scriptRepository.updateScript(tenantId, script.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }
};

// --- API reutilizável para o fluxo de extensões instaladas (installed_extensions) -----------------

/**
 * Materializa os artefatos de DADOS de um pacote no tenant (telas, actions, workflows, scripts),
 * deduplicando por `sourceId` os que já existem de outra extensão, e reconcilia as telas por chave
 * (preservando registros e campos que o usuário adicionou). Idempotente: chamar de novo com uma versão
 * mais recente REUSA os artefatos de mesmo `sourceId` (mantém os ids) e libera as telas que sumiram.
 * Não depende do registro de instalação — serve à instalação-cópia baseada em `installed_extensions`.
 */
export const applyPackageArtifacts = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  actor: LifecycleActor,
): Promise<void> => {
  const { tenantId, userId } = actor;
  const pluginId = plugin.manifest.id;
  const existingScreens = await deps.screenRepository.getAll(tenantId);
  const { actionMap, screenKeyMap } = await materializeArtifacts(deps, plugin, tenantId, userId, existingScreens);
  await declarePluginLookups(deps, plugin, tenantId, userId);
  await declarePluginTagLists(deps, plugin, tenantId, userId);
  const nextKeys = await upsertPluginScreens(deps, plugin, tenantId, userId, screenKeyMap, actionMap, existingScreens);
  for (const screen of existingScreens.filter((s) => ownerSet(s).includes(pluginId))) {
    if (!nextKeys.has(screen.id)) await releaseScreen(deps, tenantId, screen, pluginId, actor);
  }
  await releaseVanishedGeneratedArtifacts(deps, plugin, tenantId, pluginId, actor);
};

/**
 * Libera (refcount) todos os artefatos de dados que este pacote trouxe ao tenant. Cada artefato só é
 * de fato apagado quando nenhuma outra extensão o usa; senão, apenas perde este plugin como dono. Os
 * REGISTROS das telas apagadas ficam órfãos (a estrutura some, os dados ficam). Devolve o que apagou.
 */
export const releasePackageArtifacts = async (
  deps: ArtifactDeps,
  pluginId: string,
  actor: LifecycleActor,
): Promise<UninstallCounts> => {
  const { tenantId } = actor;
  let removedScreens = 0;
  for (const screen of (await deps.screenRepository.getAll(tenantId)).filter((s) => ownerSet(s).includes(pluginId))) {
    if (await releaseScreen(deps, tenantId, screen, pluginId, actor)) removedScreens += 1;
  }
  await releasePluginLookups(deps, tenantId, pluginId);
  await releasePluginTagLists(deps, tenantId, pluginId);
  const { removedActions, removedWorkflows, removedScripts } = await releaseGeneratedArtifacts(deps, tenantId, pluginId, actor);
  return { removedScreens, removedActions, removedWorkflows, removedScripts };
};

export type InstallMarketplacePluginUseCase = {
  execute: (plugin: MarketplacePlugin, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Instala um plugin: valida, MATERIALIZA os artefatos (deduplicando os que já existem de outra
 * extensão, por `sourceId`) e grava o registro.
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

    const existingScreens = await deps.screenRepository.getAll(tenantId);
    const { actionMap, screenKeyMap } = await materializeArtifacts(deps, plugin, tenantId, userId, existingScreens);
    await declarePluginLookups(deps, plugin, tenantId, userId);
    await declarePluginTagLists(deps, plugin, tenantId, userId);
    await upsertPluginScreens(deps, plugin, tenantId, userId, screenKeyMap, actionMap, existingScreens);

    await deps.installationRepository.save(outcome.value);
    return { ok: true, installation: outcome.value };
  },
});

export type UpgradeMarketplacePluginUseCase = {
  execute: (plugin: MarketplacePlugin, actor: LifecycleActor) => Promise<LifecycleResult>;
};

/**
 * Atualiza um plugin já instalado para uma versão mais recente. Os artefatos de id gerado são
 * LIBERADOS (refcount) e re-materializados; as telas são reconciliadas por chave (preservando dados
 * e campos do usuário), e as que sumiram na nova versão são liberadas. Artefatos compartilhados com
 * outra extensão não são apagados — só perdem/reganham este plugin como dono.
 */
export const makeUpgradeMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): UpgradeMarketplacePluginUseCase => ({
  execute: async (plugin, actor) => {
    const pluginId = plugin.manifest.id;
    const current = await deps.installationRepository.getById(actor.tenantId, pluginId);

    const outcome = planUpgrade(current, plugin.manifest.version, actor);
    if (!outcome.ok) return { ok: false, error: outcome.error };

    // Uma só rota de materialização (mesma do fluxo installed_extensions): reescreve por `sourceRev`,
    // preserva o que o usuário adicionou e libera o que sumiu na versão nova. Sem release-first cego.
    await applyPackageArtifacts(deps, plugin, actor);

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
 * Desinstala: valida e LIBERA (refcount) os artefatos usados por este plugin — telas, actions,
 * workflows e scripts. Cada artefato só é de fato apagado quando NENHUMA outra extensão o usa;
 * caso contrário, apenas perde este plugin do conjunto de donos. Os REGISTROS (customRecords) das
 * telas apagadas ficam órfãos: a estrutura some, os dados ficam. As contagens são de fato apagados.
 */
export const makeUninstallMarketplacePluginUseCase = (
  deps: MarketplaceDeps,
): UninstallMarketplacePluginUseCase => ({
  execute: async (pluginId, actor) => {
    const { tenantId } = actor;
    const current = await deps.installationRepository.getById(tenantId, pluginId);
    const outcome = planUninstall(current);
    if (!outcome.ok) return { ok: false, error: outcome.error };

    let removedScreens = 0;
    for (const screen of (await deps.screenRepository.getAll(tenantId)).filter((s) => ownerSet(s).includes(pluginId))) {
      if (await releaseScreen(deps, tenantId, screen, pluginId, actor)) removedScreens += 1;
    }

    await releasePluginLookups(deps, tenantId, pluginId);
    await releasePluginTagLists(deps, tenantId, pluginId);

    const { removedActions, removedWorkflows, removedScripts } = await releaseGeneratedArtifacts(
      deps, tenantId, pluginId, actor,
    );

    await deps.installationRepository.delete(tenantId, pluginId);
    return { ok: true, removedScreens, removedActions, removedWorkflows, removedScripts };
  },
});
