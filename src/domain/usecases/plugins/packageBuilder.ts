import type {
  ActionModuleTemplate,
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  ScriptModuleTemplate,
  ViewModuleTemplate,
  WorkflowModuleTemplate,
} from '../../entities/MarketplacePlugin';
import type { PluginManifest } from '../../schema/plugin/pluginManifest';
import type { ActionDefinition, ScreenDefinition } from '../../entities';
import type { Script } from '../../entities/Script';
import type { WorkflowDefinition } from '../../entities/Workflow';

export interface PackageSelection {
  screens: ScreenDefinition[];
  actions: ActionDefinition[];
  workflows: WorkflowDefinition[];
  scripts: Script[];
}

/** Templates JÁ prontos (ex.: os artefatos embarcados de uma extensão importada em edição). São
 *  preservados como estão e mesclados aos derivados da seleção de artefatos próprios. */
export interface CarriedTemplates {
  screens?: ScreenModuleTemplate[];
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
  /** Templates embarcados a preservar (extensão importada em edição). Mesclados por chave/templateId. */
  carried?: CarriedTemplates;
  /** Listas do tenant, para dar rótulo às que as telas exportadas referenciam. */
  availableLookups?: LookupModuleTemplate[];
  /** Idem para os conjuntos de etiquetas. */
  availableTagLists?: LookupModuleTemplate[];
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
    hasNotes: screen.hasNotes,
    hasDocuments: screen.hasDocuments,
    hasTags: screen.hasTags,
    tagCollection: screen.tagCollection ?? undefined,
    listActions: screen.listActions,
    sidebarOrder: screen.sidebarOrder,
    enabled: screen.enabled,
    hideFromSidebar: screen.hideFromSidebar ?? undefined,
    parentEntity: screen.parentEntity ?? undefined,
    parentFieldKey: screen.parentFieldKey ?? undefined,
    viewActionIds: screen.viewActionIds,
    cardActionIds: screen.cardActionIds,
  });

const actionToTemplate = (action: ActionDefinition): ActionModuleTemplate =>
  stripUndefined({
    templateId: action.id,
    ...omit(action, [
      'id', 'tenantId', 'ownerPluginId',
      'createdAt', 'createdBy', 'updatedAt', 'updatedBy', 'updatedByName', 'updatedByPhotoURL',
    ]),
    sourceRev: action.updatedAt.getTime(),
  }) as ActionModuleTemplate;

const workflowToTemplate = (workflow: WorkflowDefinition): WorkflowModuleTemplate =>
  stripUndefined({
    templateId: workflow.id,
    ...omit(workflow, ['id', 'tenantId', 'ownerPluginId', 'enabled', 'createdAt', 'updatedAt']),
    sourceRev: workflow.updatedAt.getTime(),
  }) as WorkflowModuleTemplate;

const scriptToTemplate = (script: Script): ScriptModuleTemplate =>
  stripUndefined({
    templateId: script.id,
    ...omit(script, ['id', 'tenantId', 'ownerPluginId', 'createdAt', 'updatedAt']),
    sourceRev: script.updatedAt.getTime(),
  }) as ScriptModuleTemplate;

/**
 * As listas referenciadas pelas telas exportadas. O rótulo vem da declaração do tenant quando ela
 * existe; para uma lista do kernel (`caseCourts`), cai no próprio nome — o pacote não precisa saber
 * a diferença, e a instalação também não.
 */
const collectLookups = (
  screens: ScreenDefinition[],
  available: LookupModuleTemplate[],
): LookupModuleTemplate[] => {
  const labels = new Map(available.map((lookup) => [lookup.collection, lookup.label]));
  const collections = new Set<string>();
  for (const screen of screens) {
    for (const field of screen.fields) {
      if (field.lookupCollection) collections.add(field.lookupCollection);
    }
  }
  return [...collections].map((collection) => ({ collection, label: labels.get(collection) ?? collection }));
};

/** Os conjuntos de etiquetas referenciados pelas telas exportadas. */
const collectTagLists = (
  screens: ScreenDefinition[],
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
  const screens = dedupeBy([...input.screens.map(screenToTemplate), ...(input.carried?.screens ?? [])], (s) => s.key);
  const lookups = collectLookups(input.screens, input.availableLookups ?? []);
  const tagLists = collectTagLists(input.screens, input.availableTagLists ?? []);
  const actions = dedupeBy([...input.actions.map(actionToTemplate), ...(input.carried?.actions ?? [])], (a) => a.templateId);
  const scripts = dedupeBy([...input.scripts.map(scriptToTemplate), ...(input.carried?.scripts ?? [])], (s) => s.templateId);
  const workflows = dedupeBy([...input.workflows.map(workflowToTemplate), ...(input.carried?.workflows ?? [])], (w) => w.templateId);
  return {
    manifest: input.manifest,
    summary: input.summary,
    ...(input.overview !== undefined ? { overview: input.overview } : {}),
    workflows,
    ...(screens.length > 0 ? { screens } : {}),
    ...(lookups.length > 0 ? { lookups } : {}),
    ...(tagLists.length > 0 ? { tagLists } : {}),
    ...(actions.length > 0 ? { actions } : {}),
    ...(scripts.length > 0 ? { scripts } : {}),
    ...((input.views?.length ?? 0) > 0 ? { views: input.views } : {}),
    ...(input.startup && input.startup.trim() !== '' ? { startup: input.startup } : {}),
  };
};
