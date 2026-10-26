import type { LookupModuleTemplate, MarketplacePlugin, ScreenPatchTemplate } from '../../entities/MarketplacePlugin';
import { planLookupSeed, type SeededLookupOptions } from '../../schema/lookupSeed';
import type { IWorkflowDefinitionRepository } from '../../repositories/IWorkflowDefinitionRepository';
import type { IScreenDefinitionRepository, ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';
import type { IActionRepository } from '../../repositories/IActionRepository';
import type { IScriptRepository } from '../../repositories/IScriptRepository';
import type { DeletionActor, FieldDefinition, ScreenDefinition } from '../../entities';
import { CUSTOM_FIELD_ENABLED_ENTITIES } from '../../entities/entitySchemas';
import { builtinScreenBaseline } from '../../schema/screenEntity';
import type { LifecycleActor } from '../../services/pluginLifecycle';
import { buildScreenKeyMap, isAdoptedScreen, materializeScreen, ownerSet } from './screenModule';
import {
  actionInputFromTemplate,
  buildScreenCollectionMap,
  buildScreenEventMap,
  rewriteStepLiteral,
  scriptInputFromTemplate,
  workflowInputFromTemplate,
} from './packageMaterialize';
import { workflowOutRefs } from './pluginReferences';
import { installedArtifactId } from '../../services/artifactIdentity';
import type { IReportDefinitionRepository } from '../../repositories/IReportDefinitionRepository';
import { reportInputFromTemplate, reportTemplateSourceId } from './reportModule';
import type { ILookupDefinitionRepository } from '../../repositories/ILookupDefinitionRepository';
import type { ILookupRepository } from '../../repositories/ILookupRepository';
import { isLookupCollection } from '../../schema/lookupRegistry';
import type { ITagDefinitionRepository } from '../../repositories/ITagDefinitionRepository';
import { ENTITY_REGISTRY_LIST } from '../../schema/entityRegistry';
import type { LocalizedIssue } from './pluginReferences';
import { installCollisionIssues } from './installCollisions';

/** Coleções de etiquetas declaradas em código — não recebem documento de declaração. */
const BUILTIN_TAG_COLLECTIONS = new Set(
  ENTITY_REGISTRY_LIST.map((entity) => entity.tagCollection).filter(Boolean) as string[],
);

/** Repositórios necessários para materializar/liberar os artefatos de dados de um pacote (telas,
 *  actions, workflows, scripts) — sem depender de registro de instalação nenhum. É o que permite a
 *  MESMA materialização servir a instalação e a atualização de `installed_extensions`. */
export interface ArtifactDeps {
  workflowRepository: IWorkflowDefinitionRepository;
  screenRepository: IScreenDefinitionRepository;
  actionRepository: IActionRepository;
  scriptRepository: IScriptRepository;
  lookupDefinitionRepository: ILookupDefinitionRepository;
  tagDefinitionRepository: ITagDefinitionRepository;
  /** Opções das listas — só para SEMEÁ-las na instalação (`lookups[].seed`). */
  lookupRepository: ILookupRepository;
  reportRepository: IReportDefinitionRepository;
}

/**
 * O artefato de id gerado que esta extensão pode REUSAR: o mesmo `sourceId` E sem dono (criado pelo
 * escritório, adotado), já dela, ou de uma dependência que ela declara — o compartilhamento entre
 * extensões que se conhecem. Casar só pelo `sourceId` fundia duas extensões SEM relação nenhuma que
 * escolhessem o mesmo `templateId` num documento com dois donos — e a de revisão maior reescrevia o
 * conteúdo da outra, sem erro: uma passava a executar a lógica da outra. Agora cada uma fica com a sua.
 */
const claimable = (
  artifact: { sourceId?: string | null; ownerPluginId?: string | null; ownerPluginIds?: string[] | null },
  sourceId: string,
  related: ReadonlySet<string>,
): boolean => {
  if (artifact.sourceId !== sourceId) return false;
  const owners = ownerSet(artifact);
  return owners.length === 0 || owners.some((owner) => related.has(owner));
};

/** A própria extensão e as que ela declara em `dependencies`. */
const relatedPlugins = (plugin: MarketplacePlugin): ReadonlySet<string> =>
  new Set([plugin.manifest.id, ...Object.keys(plugin.manifest.dependencies ?? {})]);

/**
 * As recusas que dependem do que o escritório JÁ TEM — lidas antes de qualquer gravação, para que uma
 * instalação recusada não deixe metade dos artefatos para trás. Ver `installCollisionIssues`.
 */
export const packageInstallIssues = async (
  deps: Pick<ArtifactDeps, 'screenRepository' | 'lookupDefinitionRepository' | 'tagDefinitionRepository'>,
  plugin: MarketplacePlugin,
  tenantId: string,
): Promise<LocalizedIssue[]> => {
  const [screens, lookups, tagLists] = await Promise.all([
    deps.screenRepository.getAll(tenantId),
    deps.lookupDefinitionRepository.getAll(tenantId),
    deps.tagDefinitionRepository.getAll(tenantId),
  ]);
  return installCollisionIssues(plugin, { screens, lookups, tagLists });
};

const deletionActor = (actor: LifecycleActor): DeletionActor => ({
  uid: actor.userId,
  name: actor.userId,
  photoURL: '',
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

const addOwner = (owners: string[], pluginId: string): string[] =>
  owners.includes(pluginId) ? owners : [...owners, pluginId];

const removeOwner = (owners: string[], pluginId: string): string[] => owners.filter((o) => o !== pluginId);

/** União preservando ordem: os ids do template primeiro, mais os que só existiam na tela (do usuário). */
const unionIds = (base: string[] = [], extra: string[] = []): string[] => {
  const seen = new Set(base);
  return [...base, ...extra.filter((id) => !seen.has(id))];
};

/**
 * Reescrever, ou não, o conteúdo já materializado de um artefato de id gerado (script, workflow,
 * action) com o que o pacote traz.
 *
 * A revisão de origem existe para o caso de DUPLICIDADE: duas extensões carregando o mesmo artefato
 * (mesmo `sourceId`), e a mais velha não pode sobrescrever a cópia mais nova que o escritório já
 * tem. Ela decide, portanto, quando há revisão dos DOIS lados para comparar.
 *
 * Sem revisão do lado materializado, reescreve. Era aqui que "Atualizar" não atualizava: o catálogo
 * embutido é escrito à mão e não carimba revisão em workflow, action nem script, então os dois lados
 * ficavam em `0` e a comparação `0 > 0` congelava o artefato na PRIMEIRA instalação — para sempre. O
 * botão aparecia (ele compara o CONTEÚDO do pacote), dizia "Extensão atualizada" e não reescrevia
 * nada; só desinstalar e instalar de novo resolvia. As telas nunca tiveram essa trava — sempre
 * foram reescritas com a mescla do que é do escritório —, e é esse o comportamento que vale aqui.
 */
const shouldRewriteContent = (
  template: { sourceRev?: number | null },
  existing: { sourceRev?: number | null },
): boolean => {
  if (existing.sourceRev == null) return true;
  // Pacote sem revisão não sobrescreve uma cópia versionada: não há como saber qual é a mais nova.
  if (template.sourceRev == null) return false;
  return template.sourceRev > existing.sourceRev;
};

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
  const related = relatedPlugins(plugin);

  const existingScripts = await deps.scriptRepository.getScripts(tenantId);
  const scriptMap = new Map<string, string>();
  const takenScriptIds = new Set(existingScripts.map((script) => script.id));
  for (const template of plugin.scripts ?? []) {
    const existing = existingScripts.find((s) => claimable(s, template.templateId, related));
    if (existing) {
      scriptMap.set(template.templateId, existing.id);
      const owners = addOwner(ownerSet(existing), pluginId);
      if (shouldRewriteContent(template, existing)) {
        await deps.scriptRepository.updateScript(tenantId, existing.id, {
          ...scriptInputFromTemplate(template, pluginId),
          ownerPluginIds: owners,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
        });
      } else if (owners.length !== ownerSet(existing).length) {
        await deps.scriptRepository.updateScript(tenantId, existing.id, { ownerPluginIds: owners, ownerPluginId: existing.ownerPluginId ?? pluginId });
      }
    } else {
      const localId = installedArtifactId(template.templateId, template.name, takenScriptIds);
      const created = await deps.scriptRepository.createScript(tenantId, scriptInputFromTemplate(template, pluginId), localId);
      takenScriptIds.add(created.id);
      scriptMap.set(template.templateId, created.id);
    }
  }

  // Uma tela, uma lista de opções e um conjunto de etiquetas viram COLEÇÃO sob o tenant e disputam o
  // mesmo espaço de nomes — o que qualquer um deles já usa não está livre para a chave da tela. As do
  // próprio pacote entram porque ainda não foram declaradas no escritório neste ponto do fluxo.
  const takenCollections = new Set<string>([
    ...(await deps.lookupDefinitionRepository.getAll(tenantId)).map((definition) => definition.collection),
    ...(await deps.tagDefinitionRepository.getAll(tenantId)).map((definition) => definition.collection),
    ...(plugin.lookups ?? []).map((lookup) => lookup.collection),
    ...(plugin.tagLists ?? []).map((tagList) => tagList.collection),
  ]);
  const screenKeyMap = buildScreenKeyMap(plugin.screens ?? [], existingScreens, takenCollections);
  const screenEventMap = buildScreenEventMap(plugin.screens ?? [], screenKeyMap);
  const screenCollectionMap = buildScreenCollectionMap(plugin.screens ?? [], screenKeyMap);

  const existingWorkflows = await deps.workflowRepository.getWorkflowDefinitions(tenantId);
  const workflowMap = new Map<string, string>();
  const takenWorkflowIds = new Set(existingWorkflows.map((workflow) => workflow.id));
  // Workflows TOCADOS (criados OU reescritos in-place) — os que a passada 2 precisa remapear.
  const touchedWorkflows: { templateId: string; id: string }[] = [];
  for (const template of plugin.workflows) {
    const existing = existingWorkflows.find((w) => claimable(w, template.templateId, related));
    if (existing) {
      workflowMap.set(template.templateId, existing.id);
      const owners = addOwner(ownerSet(existing), pluginId);
      if (shouldRewriteContent(template, existing)) {
        const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenEventMap, screenCollectionMap);
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
      const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenEventMap, screenCollectionMap);
      const localId = installedArtifactId(template.templateId, template.name, takenWorkflowIds);
      const created = await deps.workflowRepository.createWorkflowDefinition(tenantId, input, localId);
      takenWorkflowIds.add(created.id);
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
    const input = workflowInputFromTemplate(template, pluginId, scriptMap, screenEventMap, screenCollectionMap);
    const steps = rewriteStepLiteral(input.steps, 'targetWorkflowId', workflowMap);
    await deps.workflowRepository.updateWorkflowSteps(tenantId, touched.id, steps);
  }

  const existingActions = await deps.actionRepository.getAll(tenantId);
  const actionMap = new Map<string, string>();
  const takenActionIds = new Set(existingActions.map((action) => action.id));
  for (const template of plugin.actions ?? []) {
    const existing = existingActions.find((a) => claimable(a, template.templateId, related));
    if (existing) {
      actionMap.set(template.templateId, existing.id);
      const owners = addOwner(ownerSet(existing), pluginId);
      if (shouldRewriteContent(template, existing)) {
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
        installedArtifactId(template.templateId, template.title, takenActionIds),
      );
      takenActionIds.add(created.id);
      actionMap.set(template.templateId, created.id);
    }
  }

  await materializeReports(deps, plugin, tenantId, userId, pluginId, screenKeyMap);

  return { actionMap, screenKeyMap };
};

/**
 * Materializa os relatórios do pacote.
 *
 * Roda DEPOIS de `buildScreenKeyMap` porque é dele que sai a reescrita de `dataset.table`: a chave de
 * uma tela do pacote pode ganhar sufixo no escritório de destino, e um relatório que continuasse
 * apontando para o nome declarado leria uma coleção vazia — sem erro e sem aviso.
 *
 * Dedupe por `sourceId`, como os irmãos. Mas a reescrita do CONTEÚDO é mais simples de propósito: um
 * `ReportSpec` não se mescla com a edição do escritório, então não há campo do usuário a preservar —
 * o que existe é o gesto de duplicar para editar, que produz uma cópia `design` sem `ownerPluginIds`
 * e por isso invisível para este laço.
 */
const materializeReports = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
  pluginId: string,
  screenKeyMap: Map<string, string>,
): Promise<void> => {
  if ((plugin.reports ?? []).length === 0) return;

  const existingReports = await deps.reportRepository.getAll(tenantId);
  const takenReportIds = new Set(existingReports.map((report) => report.id));

  for (const template of plugin.reports ?? []) {
    const sourceId = reportTemplateSourceId(template);
    const existing = existingReports.find((report) => claimable({ ...report, sourceId: report.sourceId ?? '' }, sourceId, relatedPlugins(plugin)));
    const input = reportInputFromTemplate(template, pluginId, screenKeyMap, userId);

    if (existing) {
      const owners = addOwner(ownerSet(existing), pluginId);
      if (shouldRewriteContent(template, existing)) {
        await deps.reportRepository.update(tenantId, existing.id, {
          ...input,
          ownerPluginIds: owners,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
        });
      } else if (owners.length !== ownerSet(existing).length) {
        await deps.reportRepository.update(tenantId, existing.id, {
          ownerPluginIds: owners,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
        });
      }
      continue;
    }

    const created = await deps.reportRepository.create(
      tenantId,
      input,
      installedArtifactId(template.templateId, template.title, takenReportIds),
    );
    takenReportIds.add(created.id);
  }
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
    // Tela que o tenant já tinha (Form Design/kernel) e a extensão passou a declarar: a origem
    // continua sendo dela — é o que garante a devolução na desinstalação, em vez da exclusão.
    //
    // Uma tela `builtin` que já é DESTE pacote não é dessas: baseline de coleção nasce sem dono, então
    // o par `builtin` + este plugin só existe onde a baseline foi gravada por cima da própria tela
    // (tela cuja chave É a coleção que ela descreve). Retomá-la como do pacote conserta o documento na
    // reinstalação — sem isso a tela some do Form Design e das listagens para sempre.
    const adopted = existing
      ? isAdoptedScreen(existing) && !(existing.origin === 'builtin' && ownerSet(existing).includes(pluginId))
      : false;
    const merged = existing
      ? {
          ...input,
          origin: adopted ? existing.origin : input.origin,
          managed: adopted ? (existing.managed ?? false) : input.managed,
          ownerPluginId: existing.ownerPluginId ?? pluginId,
          ownerPluginIds: addOwner(ownerSet(existing), pluginId),
          fields: [...input.fields, ...preservedUserFields(existing.fields, input.fields, pluginId)],
          // Ações do card/detalhe que o usuário configurou por cima (Form Design) são preservadas —
          // sem isso, reinstalar/atualizar as apagaria, já que o template não as traz.
          viewActionIds: unionIds(input.viewActionIds, existing.viewActionIds),
          cardActionIds: unionIds(input.cardActionIds, existing.cardActionIds),
          // A janela que o PACOTE declara vence; sem declaração, fica a que já valia — inclusive a que
          // o escritório pôs no Form Design. Retirar uma trava de prova é gesto de pessoa, com
          // `screens.edit-window`, nunca efeito colateral de atualizar uma extensão.
          editWindow: input.editWindow ?? existing.editWindow ?? null,
          // A restrição de leitura segue a mesma regra, e pelo mesmo motivo: uma versão que a retira
          // entregaria a todo membro com a coleção os registros que ela guardava — e isso é decisão de
          // quem tem `screens.member-visibility`, não de uma atualização.
          memberVisibility: input.memberVisibility ?? existing.memberVisibility ?? null,
        }
      : input;
    await deps.screenRepository.upsert(tenantId, screenKey, merged);
    await ensureTargetCollectionScreen(deps, tenantId, screenKey, input, userId, existingScreens);
  }
  return nextKeys;
};

/**
 * Uma tela que descreve OUTRA coleção (`dataCollection`) precisa que a coleção alvo tenha o próprio
 * documento em `screenDefinitions`: é ele que as Security Rules consultam para autorizar a escrita
 * (`isDeclaredScreen`) e para ler o que a tela declara sobre a gravação. Sem isso, a declaração
 * pela extensão não chegaria às rules, que não têm como procurar "a tela que aponta para esta
 * coleção".
 *
 * O documento existente é preservado — só a permissão é acertada. É a mesma baseline que o Form
 * Design grava no primeiro ajuste de uma tela do kernel.
 *
 * Quando a coleção alvo é a PRÓPRIA chave da tela, não há segundo documento a garantir: a tela do
 * pacote já É o documento que as rules leem, e com a declaração inteira. Gravar a baseline aqui a
 * rebaixaria a `builtin` sem campos — e uma tela `builtin` sai das listagens e do Form Design.
 */
const ensureTargetCollectionScreen = async (
  deps: ArtifactDeps,
  tenantId: string,
  screenKey: string,
  input: ScreenDefinitionInput,
  userId: string,
  existingScreens: ScreenDefinition[],
): Promise<void> => {
  const target = input.dataCollection?.trim();
  if (!target || target === screenKey) return;
  // Identidade do registro junto com a permissão: é por `titleFieldKey`/`subtitleFieldKey` que
  // qualquer tela resolve o rótulo de um registro desta coleção (um campo de referência, uma
  // menção, a busca). Só preenche o que está vazio — ajuste do escritório não é sobrescrito.
  const declared = {
    memberWritableFields: input.memberWritableFields ?? null,
    authorCanDelete: input.authorCanDelete ?? null,
    editWindow: input.editWindow ?? null,
    memberVisibility: input.memberVisibility ?? null,
    titleFieldKey: input.titleFieldKey,
    subtitleFieldKey: input.subtitleFieldKey ?? null,
    imageFieldKey: input.imageFieldKey ?? null,
  };
  const existing = existingScreens.find((screen) => screen.id === target);
  if (existing) {
    const merged = {
      ...screenToInput(existing),
      memberWritableFields: declared.memberWritableFields,
      authorCanDelete: declared.authorCanDelete,
      editWindow: declared.editWindow ?? existing.editWindow ?? null,
      memberVisibility: declared.memberVisibility ?? existing.memberVisibility ?? null,
      titleFieldKey: existing.titleFieldKey || declared.titleFieldKey,
      subtitleFieldKey: existing.subtitleFieldKey ?? declared.subtitleFieldKey,
      imageFieldKey: existing.imageFieldKey ?? declared.imageFieldKey,
    };
    if (JSON.stringify(merged) === JSON.stringify(screenToInput(existing))) return;
    await deps.screenRepository.upsert(tenantId, target, merged);
    return;
  }
  await deps.screenRepository.upsert(tenantId, target, {
    ...builtinScreenBaseline(target),
    ...declared,
    createdBy: userId,
  });
};

// --- Complementos: campos que o pacote acrescenta a telas que JÁ existem no escritório -----------

/**
 * Resolve o alvo de um complemento na tela real do tenant. Alvo por `sourceId` (tela de outra
 * extensão) só resolve se ela estiver instalada; alvo por coleção resolve na tela existente ou, para
 * uma tela do kernel ainda sem documento, na baseline — o mesmo que o Form Design grava no primeiro
 * ajuste de uma tela fixa. Alvo que não existe aqui é ignorado: o complemento não tem o que estender.
 */
const resolvePatchTarget = (
  patch: ScreenPatchTemplate,
  existingScreens: ScreenDefinition[],
): { screenKey: string; base: ScreenDefinitionInput } | null => {
  if ((patch.targetKind ?? 'collection') === 'sourceId') {
    const found = existingScreens.find((screen) => (screen.sourceId ?? screen.id) === patch.target);
    return found ? { screenKey: found.id, base: screenToInput(found) } : null;
  }
  const existing = existingScreens.find((screen) => screen.id === patch.target);
  if (existing) return { screenKey: existing.id, base: screenToInput(existing) };
  if (!CUSTOM_FIELD_ENABLED_ENTITIES.has(patch.target)) return null;
  return { screenKey: patch.target, base: builtinScreenBaseline(patch.target) as unknown as ScreenDefinitionInput };
};

/**
 * Aplica os complementos: acrescenta à tela alvo os campos declarados, carimbados com `origin`
 * `plugin` e o `ownerPluginId`. A extensão NÃO entra no conjunto de donos da TELA — a posse fica em
 * cada campo, e é isso que faz a desinstalação levar só os campos embora, sem tocar numa tela que é
 * do kernel ou de outra extensão. Devolve as chaves das telas complementadas.
 */
const applyScreenPatches = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
  existingScreens: ScreenDefinition[],
  actionMap: Map<string, string>,
): Promise<Set<string>> => {
  const pluginId = plugin.manifest.id;
  const patched = new Set<string>();
  /**
   * As ações do complemento ACRESCENTAM à lista da tela alvo, sem reordenar nem apagar o que o
   * escritório configurou: a lista é dele, e o complemento só pede um lugar nela. Reaplicar o mesmo
   * pacote não duplica (a chave já está lá), e uma ação que sumiu da versão nova sai pelo release.
   */
  const mergeActionIds = (current: string[] | undefined, templateIds: string[] | undefined): string[] => {
    const ids = (templateIds ?? []).map((id) => actionMap.get(id) ?? id);
    return [...(current ?? []), ...ids.filter((id) => !(current ?? []).includes(id))];
  };

  for (const patch of plugin.screenPatches ?? []) {
    const target = resolvePatchTarget(patch, existingScreens);
    if (!target) continue;
    // Complemento apontando para uma tela do PRÓPRIO pacote: quem manda na estrutura dela é o template
    // da tela, então aplicar o complemento por cima apagaria todos os campos que não estão nele.
    const own = existingScreens.find((screen) => screen.id === target.screenKey);
    if (own && ownerSet(own).includes(pluginId)) continue;
    const patchFields = patch.fields.map((field) => ({
      ...field,
      origin: 'plugin' as const,
      ownerPluginId: pluginId,
    })) as FieldDefinition[];
    const patchKeys = new Set(patchFields.map((field) => field.key));
    const kept = target.base.fields.filter(
      (field) => field.ownerPluginId !== pluginId && !patchKeys.has(field.key),
    );
    await deps.screenRepository.upsert(tenantId, target.screenKey, stripUndefined({
      ...target.base,
      fields: [...kept, ...patchFields],
      cardActionIds: mergeActionIds(target.base.cardActionIds, patch.cardActionIds),
      viewActionIds: mergeActionIds(target.base.viewActionIds, patch.viewActionIds),
      createdBy: target.base.createdBy || userId,
    }));
    patched.add(target.screenKey);
  }
  return patched;
};

/**
 * Retira das telas de TERCEIROS os campos que este plugin acrescentou. A tela e os registros ficam;
 * os valores já gravados no campo removido também — o renderizador ignora chave sem definição (ver
 * "Cascata de Exclusão"). Telas do próprio plugin não passam por aqui: quem cuida é `releaseScreen`.
 */
const releaseScreenPatches = async (
  deps: ArtifactDeps,
  tenantId: string,
  pluginId: string,
  screens: ScreenDefinition[],
): Promise<number> => {
  // As ações que ESTE plugin instalou. A tela alvo é de outro dono, então não dá para varrer por
  // posse da tela: o que sai são as entradas que apontam para ação dele — as demais ficam, mesmo
  // que o escritório as tenha acrescentado à mão depois.
  const ownActionIds = new Set(
    (await deps.actionRepository.getAll(tenantId))
      .filter((action) => ownerSet(action).includes(pluginId))
      .map((action) => action.id),
  );
  const withoutOwn = (ids: string[] | undefined): string[] => (ids ?? []).filter((id) => !ownActionIds.has(id));

  let removedFields = 0;
  for (const screen of screens) {
    if (ownerSet(screen).includes(pluginId)) continue;
    const fields = screen.fields.filter((field) => field.ownerPluginId !== pluginId);
    const cardActionIds = withoutOwn(screen.cardActionIds);
    const viewActionIds = withoutOwn(screen.viewActionIds);
    const touched = fields.length !== screen.fields.length
      || cardActionIds.length !== (screen.cardActionIds ?? []).length
      || viewActionIds.length !== (screen.viewActionIds ?? []).length;
    if (!touched) continue;
    removedFields += screen.fields.length - fields.length;
    await deps.screenRepository.upsert(tenantId, screen.id, {
      ...screenToInput(screen), fields, cardActionIds, viewActionIds,
    });
  }
  return removedFields;
};

/**
 * Declara as listas do pacote, acrescentando este plugin aos donos, e semeia as opções delas. Uma
 * lista do kernel já é declarada em código e não ganha documento — replicá-la transformaria cada
 * mudança do registro numa migração de dados —, mas recebe as opções que a extensão semeia.
 *
 * Devolve as chaves que esta extensão passa a ter entregue em cada lista, para o registro de
 * instalação dela guardar.
 */
const declarePluginLookups = async (
  deps: ArtifactDeps,
  plugin: MarketplacePlugin,
  tenantId: string,
  userId: string,
  seeded: SeededLookupOptions,
): Promise<SeededLookupOptions> => {
  const templates = plugin.lookups ?? [];
  if (templates.length === 0) return {};
  const pluginId = plugin.manifest.id;
  const declared = templates.filter((lookup) => !isLookupCollection(lookup.collection));
  const existing = declared.length > 0 ? await deps.lookupDefinitionRepository.getAll(tenantId) : [];
  for (const template of declared) {
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
  const delivered: SeededLookupOptions = {};
  for (const template of templates) {
    const keys = await seedLookupOptions(deps, tenantId, template, userId, seeded[template.collection] ?? []);
    if (keys.length > 0) delivered[template.collection] = keys;
  }
  return delivered;
};

/**
 * Semeia as opções de uma lista pela regra de `planLookupSeed`: tudo numa lista vazia; numa lista com
 * opções, nada (`when-empty`) ou o que falta e ainda não foi entregue por esta extensão (`required`).
 * O que o escritório renomeou ou apagou continua como ele deixou.
 */
const seedLookupOptions = async (
  deps: ArtifactDeps,
  tenantId: string,
  template: LookupModuleTemplate,
  userId: string,
  alreadyDelivered: readonly string[],
): Promise<string[]> => {
  if (!template.options?.length) return [...alreadyDelivered];
  const current = await deps.lookupRepository.getAll(tenantId, template.collection);
  const plan = planLookupSeed(template.options, template.seed ?? 'when-empty', current, alreadyDelivered);
  for (const option of plan.create) {
    await deps.lookupRepository.create(
      tenantId,
      template.collection,
      { key: option.key, label: option.label, ...(option.color ? { color: option.color } : {}) },
      userId,
    );
  }
  return plan.delivered;
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

/**
 * Devolve ao tenant uma tela ADOTADA: a extensão sai dos donos, a estrutura fica editável de novo e
 * os campos que a extensão trouxe passam a ser do Form Design. A tela NÃO é apagada — apagá-la
 * perderia a chave da coleção, e a reinstalação cairia numa chave nova, deixando os registros órfãos.
 */
const handBackScreen = async (deps: ArtifactDeps, tenantId: string, screen: ScreenDefinition, pluginId: string): Promise<void> => {
  await deps.screenRepository.upsert(tenantId, screen.id, {
    ...screenToInput(screen),
    fields: screen.fields.map((field) =>
      field.ownerPluginId === pluginId ? { ...field, origin: 'design' as const, ownerPluginId: null } : field,
    ),
    ownerPluginId: null,
    ownerPluginIds: [],
    managed: false,
  });
};

const releaseScreen = async (deps: ArtifactDeps, tenantId: string, screen: ScreenDefinition, pluginId: string, actor: LifecycleActor): Promise<boolean> => {
  const owners = removeOwner(ownerSet(screen), pluginId);
  if (owners.length === 0) {
    if (isAdoptedScreen(screen)) {
      await handBackScreen(deps, tenantId, screen, pluginId);
      return false;
    }
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

  for (const report of (await deps.reportRepository.getAll(tenantId)).filter((r) => ownerSet(r).includes(pluginId))) {
    const owners = removeOwner(ownerSet(report), pluginId);
    if (owners.length === 0) await deps.reportRepository.delete(tenantId, report.id);
    else await deps.reportRepository.update(tenantId, report.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
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
  const keepReports = new Set((plugin.reports ?? []).map((t) => reportTemplateSourceId(t)));

  for (const report of (await deps.reportRepository.getAll(tenantId))
    .filter((r) => ownerSet(r).includes(pluginId) && !keepReports.has(r.sourceId ?? ''))) {
    const owners = removeOwner(ownerSet(report), pluginId);
    if (owners.length === 0) await deps.reportRepository.delete(tenantId, report.id);
    else await deps.reportRepository.update(tenantId, report.id, { ownerPluginIds: owners, ownerPluginId: owners[0] });
  }

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
  seeded: SeededLookupOptions = {},
): Promise<{ seededLookupOptions: SeededLookupOptions }> => {
  const { tenantId, userId } = actor;
  const pluginId = plugin.manifest.id;
  const existingScreens = await deps.screenRepository.getAll(tenantId);
  const { actionMap, screenKeyMap } = await materializeArtifacts(deps, plugin, tenantId, userId, existingScreens);
  const seededLookupOptions = await declarePluginLookups(deps, plugin, tenantId, userId, seeded);
  await declarePluginTagLists(deps, plugin, tenantId, userId);
  const nextKeys = await upsertPluginScreens(deps, plugin, tenantId, userId, screenKeyMap, actionMap, existingScreens);
  for (const screen of existingScreens.filter((s) => ownerSet(s).includes(pluginId))) {
    if (!nextKeys.has(screen.id)) await releaseScreen(deps, tenantId, screen, pluginId, actor);
  }
  const patched = await applyScreenPatches(deps, plugin, tenantId, userId, await deps.screenRepository.getAll(tenantId), actionMap);
  // Complemento que sumiu da versão nova: os campos dele saem da tela que deixou de ser alvo.
  await releaseScreenPatches(
    deps, tenantId, pluginId,
    (await deps.screenRepository.getAll(tenantId)).filter((screen) => !patched.has(screen.id)),
  );
  await releaseVanishedGeneratedArtifacts(deps, plugin, tenantId, pluginId, actor);
  return { seededLookupOptions };
};

export interface UninstallCounts {
  removedScreens: number;
  removedActions: number;
  removedWorkflows: number;
  removedScripts: number;
  /** Campos retirados de telas de terceiros (complementos) — a tela em si continua de pé. */
  removedPatchFields: number;
}

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
  const screens = await deps.screenRepository.getAll(tenantId);
  let removedScreens = 0;
  for (const screen of screens.filter((s) => ownerSet(s).includes(pluginId))) {
    if (await releaseScreen(deps, tenantId, screen, pluginId, actor)) removedScreens += 1;
  }
  const removedPatchFields = await releaseScreenPatches(deps, tenantId, pluginId, screens);
  await releasePluginLookups(deps, tenantId, pluginId);
  await releasePluginTagLists(deps, tenantId, pluginId);
  const { removedActions, removedWorkflows, removedScripts } = await releaseGeneratedArtifacts(deps, tenantId, pluginId, actor);
  return { removedScreens, removedActions, removedWorkflows, removedScripts, removedPatchFields };
};
