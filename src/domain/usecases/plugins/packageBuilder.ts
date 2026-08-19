import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScreenPatchTemplate,
  ScriptModuleTemplate,
  ViewModuleTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { PluginMigration } from '../../schema/plugin/migration';
import type { PluginManifest } from '../../schema/plugin/pluginManifest';
import type { ActionDefinition, ScreenDefinition } from '../../entities';
import type { Script } from '../../entities/Script';
import type { WorkflowDefinition } from '../../entities/Workflow';
import { parameterLookupCollections } from '../../schema/workflowParameters';

export interface PackageSelection {
  screens: ScreenDefinition[];
  /** Telas de TERCEIROS (kernel ou outra extensão) das quais só os campos do autor são empacotados. */
  patchedScreens?: ScreenDefinition[];
  actions: ActionDefinition[];
  workflows: WorkflowDefinition[];
  scripts: Script[];
}

/** Templates JÁ prontos (ex.: os artefatos embarcados de uma extensão importada em edição). São
 *  preservados como estão e mesclados aos derivados da seleção de artefatos próprios. */
export interface CarriedTemplates {
  screens?: ScreenModuleTemplate[];
  screenPatches?: ScreenPatchTemplate[];
  actions?: ActionModuleTemplate[];
  workflows?: WorkflowModuleTemplate[];
  scripts?: ScriptModuleTemplate[];
}

export interface BuildPackageInput extends PackageSelection {
  manifest: PluginManifest;
  summary: string;
  overview?: unknown;
  /** Views de código (extensão trusted). As contribuições `ui.page`/`ui.nav` são geradas na autoria. */
  views?: ViewModuleTemplate[];
  /** Código de inicialização (trusted) que registra serviços ao carregar. Vazio → omitido. */
  startup?: string;
  /**
   * Migrações de dados a PRESERVAR. Não são artefatos do escritório e por isso não têm de onde ser
   * derivadas: quem as tem é o pacote em edição. Sem carregá-las aqui, reexportar uma extensão as
   * perderia em silêncio — e os escritórios que instalassem o pacote reexportado ficariam sem o
   * conserto de dado que a versão anterior deles exige.
   */
  migrations?: PluginMigration[];
  /** Templates embarcados a preservar (extensão importada em edição). Mesclados por chave/templateId. */
  carried?: CarriedTemplates;
  /** Listas do tenant, para dar rótulo às que as telas exportadas referenciam. */
  availableLookups?: LookupModuleTemplate[];
  /** Idem para os conjuntos de etiquetas. */
  availableTagLists?: LookupModuleTemplate[];
  /**
   * Telas e actions VIVAS do escritório. Servem para reancorar os templates carregados de uma extensão
   * em edição na versão que existe aqui — quem edita a extensão edita a tela instalada, no Form Design.
   */
  installedScreens?: ScreenDefinition[];
  installedActions?: ActionDefinition[];
}

const dedupeBy = <T>(items: T[], keyOf: (item: T) => string): T[] => {
  const seen = new Set<string>();
  return items.filter((item) => {
    const key = keyOf(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

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

const omit = <T extends object>(obj: T, keys: readonly string[]): Record<string, unknown> => {
  const clone = { ...obj } as Record<string, unknown>;
  for (const key of keys) delete clone[key];
  return clone;
};

/**
 * O inverso da instalação: converte um artefato REAL do tenant num template de pacote. O id real
 * (GUID estável) vira o `templateId` e a `key` real da tela vira a `key` de template — assim as
 * referências internas do pacote (viewActionIds, workflowId, scriptId, refEntity…) já apontam para
 * os ids/keys de template sem precisar reescrever nada. Só os campos de sistema (id, tenantId,
 * timestamps, autoria, `ownerPluginId`) e denormalizados são removidos.
 */
const screenToTemplate = (screen: ScreenDefinition): ScreenModuleTemplate =>
  stripUndefined({
    key: screen.id,
    sourceId: screen.sourceId ?? screen.id,
    sourceRev: screen.updatedAt.getTime(),
    titleSingular: screen.titleSingular,
    titlePlural: screen.titlePlural,
    icon: screen.icon,
    fields: screen.fields.map((field) => omit(field, ['ownerPluginId'])) as unknown as ScreenModuleTemplate['fields'],
    titleFieldKey: screen.titleFieldKey,
    subtitleFieldKey: screen.subtitleFieldKey ?? undefined,
    hasNotes: screen.hasNotes,
    hasDocuments: screen.hasDocuments,
    hasTags: screen.hasTags,
    tagCollection: screen.tagCollection ?? undefined,
    dataCollection: screen.dataCollection ?? undefined,
    eventPrefix: screen.eventPrefix ?? undefined,
    recordTabPrefix: screen.recordTabPrefix ?? undefined,
    writeRoles: screen.writeRoles ?? undefined,
    memberWritableFields: screen.memberWritableFields ?? undefined,
    authorCanDelete: screen.authorCanDelete ?? undefined,
    listActions: screen.listActions,
    sidebarOrder: screen.sidebarOrder,
    enabled: screen.enabled,
    hideFromSidebar: screen.hideFromSidebar ?? undefined,
    hideFromParentTabs: screen.hideFromParentTabs ?? undefined,
    parentEntity: screen.parentEntity ?? undefined,
    parentFieldKey: screen.parentFieldKey ?? undefined,
    parentRelation: screen.parentRelation ?? undefined,
    viewActionIds: screen.viewActionIds,
    cardActionIds: screen.cardActionIds,
  });

const templateSourceOf = (template: ScreenModuleTemplate): string => template.sourceId ?? template.key;

/**
 * Atualiza um template CARREGADO (extensão em edição) a partir da tela viva que o materializou no
 * escritório: é ela que o autor acabou de mexer no Form Design. Sem isso, reexportar reemitiria o
 * template velho e o trabalho novo se perderia — foi o que fez um campo acrescentado à tela da própria
 * extensão só voltar como complemento, apagando os demais na atualização.
 *
 * `key` e `sourceId` continuam sendo os do TEMPLATE (a identidade do pacote não muda porque a
 * instalação local desambiguou a chave), e campos de OUTRA extensão não viajam: não são do autor.
 */
const refreshedFromInstalled = (
  template: ScreenModuleTemplate,
  live: ScreenDefinition,
  pluginId: string,
): ScreenModuleTemplate => ({
  ...screenToTemplate({
    ...live,
    fields: live.fields.filter((field) => !field.ownerPluginId || field.ownerPluginId === pluginId),
  }),
  key: template.key,
  sourceId: templateSourceOf(template),
});

/**
 * Traduz as referências de uma tela viva de volta para o vocabulário do pacote: a chave INSTALADA de
 * outra tela do pacote vira a `key` de template dela, e o id REAL de uma action instalada vira o
 * `templateId`. Sem isso, o template reexportado apontaria para ids que só existem neste escritório.
 */
const toTemplateRefs = (
  template: ScreenModuleTemplate,
  screenKeys: ReadonlyMap<string, string>,
  actionIds: ReadonlyMap<string, string>,
): ScreenModuleTemplate => {
  const screenRef = (ref: string | null | undefined): string | null | undefined =>
    ref && screenKeys.has(ref) ? screenKeys.get(ref) : ref;
  const actionRef = (ids: string[] | undefined): string[] | undefined =>
    ids?.map((id) => actionIds.get(id) ?? id);
  return stripUndefined({
    ...template,
    parentEntity: screenRef(template.parentEntity),
    viewActionIds: actionRef(template.viewActionIds),
    cardActionIds: actionRef(template.cardActionIds),
    fields: template.fields.map((field) => ({
      ...field,
      refEntity: screenRef(field.refEntity),
      aggregation: field.aggregation
        ? { ...field.aggregation, from: screenRef(field.aggregation.from) ?? field.aggregation.from }
        : field.aggregation,
    })),
  });
};

/**
 * O inverso da instalação para uma tela de TERCEIROS: empacota o que é DO PACOTE naquela tela — os
 * campos que o autor acrescentou (os do kernel e os de outra extensão não são dele para distribuir)
 * e as ações do pacote que estão penduradas nela.
 *
 * As ações seguem exatamente o mesmo critério dos campos, e é isso que dispensa uma escolha nova na
 * autoria: assim como um campo viaja por ser `origin: 'design'`, uma ação viaja por já estar no
 * pacote — `pertence` responde as duas perguntas com a mesma regra. Uma tela onde o autor pendurou só
 * uma ação, sem campo nenhum, também vira complemento; antes ela não viajava, e o gesto se perdia.
 *
 * O alvo viaja pelo nome quando é coleção fixa (universal em todo escritório) e pelo `sourceId`
 * quando é tela de outra extensão, cuja chave instalada varia.
 */
const screenToPatch = (
  screen: ScreenDefinition,
  /** Ação instalada → `templateId`, restrita às que VÃO no pacote. Fora dela, nada viaja. */
  pertence: ReadonlyMap<string, string>,
): ScreenPatchTemplate | null => {
  const own = screen.fields.filter((field) => field.origin === 'design');
  const ownActions = (ids: string[] | undefined): string[] =>
    (ids ?? []).map((id) => pertence.get(id)).filter((id): id is string => id !== undefined);

  const cardActionIds = ownActions(screen.cardActionIds);
  const viewActionIds = ownActions(screen.viewActionIds);
  if (own.length === 0 && cardActionIds.length === 0 && viewActionIds.length === 0) return null;

  const byCollection = screen.origin === 'builtin';
  return stripUndefined({
    target: byCollection ? screen.id : (screen.sourceId ?? screen.id),
    targetKind: byCollection ? ('collection' as const) : ('sourceId' as const),
    fields: own.map((field) => omit(field, ['origin', 'ownerPluginId'])) as unknown as ScreenPatchTemplate['fields'],
    cardActionIds: cardActionIds.length > 0 ? cardActionIds : undefined,
    viewActionIds: viewActionIds.length > 0 ? viewActionIds : undefined,
    sourceRev: screen.updatedAt.getTime(),
  });
};

/**
 * O `templateId` é o IDENTIFICADOR de origem, não o id local. Para o artefato que veio de um pacote,
 * é o `sourceId` — reexportar preserva a identidade em vez de trocá-la pela do escritório que
 * reexportou. Para o criado aqui, os dois já são a mesma coisa.
 */
const templateIdOf = (artifact: { id: string; sourceId?: string | null }): string =>
  artifact.sourceId ?? artifact.id;

const actionToTemplate = (action: ActionDefinition): ActionModuleTemplate =>
  stripUndefined({
    templateId: templateIdOf(action),
    ...omit(action, [
      'id', 'tenantId', 'ownerPluginId',
      'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'updatedByName', 'updatedByPhotoURL',
    ]),
    sourceRev: action.updatedAt.getTime(),
  }) as ActionModuleTemplate;

const workflowToTemplate = (workflow: WorkflowDefinition): WorkflowModuleTemplate =>
  stripUndefined({
    templateId: templateIdOf(workflow),
    ...omit(workflow, ['id', 'tenantId', 'ownerPluginId', 'enabled', 'createdAt', 'updatedAt']),
    sourceRev: workflow.updatedAt.getTime(),
  }) as WorkflowModuleTemplate;

const scriptToTemplate = (script: Script): ScriptModuleTemplate =>
  stripUndefined({
    templateId: templateIdOf(script),
    ...omit(script, ['id', 'tenantId', 'ownerPluginId', 'createdAt', 'updatedAt']),
    sourceRev: script.updatedAt.getTime(),
  }) as ScriptModuleTemplate;

/**
 * As listas referenciadas pelo que VAI no pacote — telas e complementos, já materializados como
 * template. Varrer o resultado final (e não a seleção de origem) é o que mantém as declarações de uma
 * extensão em edição: sem isso, reexportar uma extensão importada perderia as listas dela.
 *
 * O rótulo vem da declaração do tenant quando ela existe; para uma lista do kernel (`caseCourts`),
 * cai no próprio nome — o pacote não precisa saber a diferença, e a instalação também não.
 */
/** Os parâmetros vistos como um campo qualquer: só o que `collectLookups` precisa enxergar. */
const parameterLookupHost = (
  parameters: Parameters<typeof parameterLookupCollections>[0],
): { fields: { lookupCollection?: string | null }[] } => ({
  fields: parameterLookupCollections(parameters).map((collection) => ({ lookupCollection: collection })),
});

const collectLookups = (
  fieldHosts: { fields: { lookupCollection?: string | null }[] }[],
  available: LookupModuleTemplate[],
): LookupModuleTemplate[] => {
  const labels = new Map(available.map((lookup) => [lookup.collection, lookup.label]));
  const collections = new Set<string>();
  for (const host of fieldHosts) {
    for (const field of host.fields) {
      if (field.lookupCollection) collections.add(field.lookupCollection);
    }
  }
  return [...collections].map((collection) => ({ collection, label: labels.get(collection) ?? collection }));
};

/** Os conjuntos de etiquetas referenciados pelas telas do pacote, pelo mesmo critério. */
const collectTagLists = (
  screens: { tagCollection?: string | null }[],
  available: LookupModuleTemplate[],
): LookupModuleTemplate[] => {
  const labels = new Map(available.map((tagList) => [tagList.collection, tagList.label]));
  const collections = new Set<string>();
  for (const screen of screens) {
    if (screen.tagCollection) collections.add(screen.tagCollection);
  }
  return [...collections].map((collection) => ({ collection, label: labels.get(collection) ?? collection }));
};

/**
 * Monta um `MarketplacePlugin` a partir dos artefatos selecionados. Arrays vazias das partes
 * opcionais são omitidas para um JSON limpo. A integridade referencial (dependências não incluídas)
 * é conferida à parte por `validatePackage` — a MESMA checagem que roda na importação.
 */
export const buildPackage = (input: BuildPackageInput): MarketplacePlugin => {
  // Extensão em edição: cada template carregado é reancorado na tela viva que ele materializou aqui,
  // para que o que o autor mexeu no Form Design entre no pacote novo.
  const liveOfTemplate = new Map<string, ScreenDefinition>();
  for (const template of input.carried?.screens ?? []) {
    const live = (input.installedScreens ?? []).find(
      (screen) => (screen.sourceId ?? screen.id) === templateSourceOf(template),
    );
    if (live) liveOfTemplate.set(template.key, live);
  }
  const installedScreenKeys = new Map([...liveOfTemplate].map(([key, live]) => [live.id, key]));
  const installedActionIds = new Map(
    (input.installedActions ?? [])
      .filter((action) => !!action.sourceId)
      .map((action) => [action.id, action.sourceId as string]),
  );
  const carriedScreens = (input.carried?.screens ?? []).map((template) => {
    const live = liveOfTemplate.get(template.key);
    return live
      ? toTemplateRefs(refreshedFromInstalled(template, live, input.manifest.id), installedScreenKeys, installedActionIds)
      : template;
  });

  const screens = dedupeBy([...input.screens.map(screenToTemplate), ...carriedScreens], (s) => s.key);
  const actions = dedupeBy([...input.actions.map(actionToTemplate), ...(input.carried?.actions ?? [])], (a) => a.templateId);

  /**
   * Ação INSTALADA → `templateId`, só para as que este pacote leva. É o mesmo par de mapas que
   * `toTemplateRefs` usa nas telas próprias; aqui ele também FILTRA, porque um complemento que
   * apontasse para ação de outra extensão viraria referência a artefato que o pacote não inclui — o
   * `validatePackage` recusaria, e com razão.
   */
  const noPacote = new Set(actions.map((action) => action.templateId));
  const acaoDoPacote = new Map(
    [...(input.installedActions ?? []), ...input.actions]
      .map((action) => [action.id, templateIdOf(action)] as const)
      .filter(([, templateId]) => noPacote.has(templateId)),
  );

  const screenPatches = dedupeBy(
    [
      ...(input.patchedScreens ?? [])
        .map((screen) => screenToPatch(screen, acaoDoPacote))
        .filter((patch): patch is ScreenPatchTemplate => patch !== null),
      ...(input.carried?.screenPatches ?? []),
    ],
    (patch) => patch.target,
  );
  const tagLists = collectTagLists(screens, input.availableTagLists ?? []);
  const scripts = dedupeBy([...input.scripts.map(scriptToTemplate), ...(input.carried?.scripts ?? [])], (s) => s.templateId);
  const workflows = dedupeBy([...input.workflows.map(workflowToTemplate), ...(input.carried?.workflows ?? [])], (w) => w.templateId);
  // As listas e etiquetas que o pacote referencia — os campos do complemento junto com os das telas,
  // porque um campo de seleção acrescentado a `persons` precisa da lista dele declarada igual, e os
  // PARÂMETROS de fluxos e scripts, porque um fluxo que pede "Situação" precisa chegar com a lista
  // que ele oferece para escolher.
  const lookups = collectLookups(
    [
      ...screens,
      ...screenPatches,
      ...workflows.map((workflow) => parameterLookupHost(workflow.parameters)),
      ...scripts.flatMap((script) => [parameterLookupHost(script.inputParams), parameterLookupHost(script.outputParams)]),
    ],
    input.availableLookups ?? [],
  );
  return {
    manifest: input.manifest,
    summary: input.summary,
    ...(input.overview !== undefined ? { overview: input.overview } : {}),
    workflows,
    ...(screens.length > 0 ? { screens } : {}),
    ...(screenPatches.length > 0 ? { screenPatches } : {}),
    ...(lookups.length > 0 ? { lookups } : {}),
    ...(tagLists.length > 0 ? { tagLists } : {}),
    ...(actions.length > 0 ? { actions } : {}),
    ...(scripts.length > 0 ? { scripts } : {}),
    ...((input.views?.length ?? 0) > 0 ? { views: input.views } : {}),
    ...(input.startup && input.startup.trim() !== '' ? { startup: input.startup } : {}),
    ...((input.migrations?.length ?? 0) > 0 ? { migrations: input.migrations } : {}),
  };
};
