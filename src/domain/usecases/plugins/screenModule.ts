import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import type { ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';

const slug = (value: string): string =>
  value.replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase();

/**
 * Chave real da tela instalada — namespaced pelo plugin para nunca colidir entre extensões nem com
 * telas do usuário. Determinística: não precisa de mapa de ids, e reinstalar/atualizar cai na mesma
 * chave (o `upsert` do repositório usa a chave como doc id).
 */
export const installedScreenKey = (pluginId: string, templateKey: string): string =>
  `${slug(pluginId)}__${slug(templateKey)}`;

/** Mapa `keyDeTemplate → chaveInstalada` de todas as telas do pacote, base da reescrita de refs. */
export const buildScreenKeyMap = (pluginId: string, screens: ScreenModuleTemplate[]): Map<string, string> =>
  new Map(screens.map((screen) => [screen.key, installedScreenKey(pluginId, screen.key)]));

const rewriteRef = (ref: string | null | undefined, keyMap: Map<string, string>): string | null | undefined =>
  ref && keyMap.has(ref) ? keyMap.get(ref) : ref;

/**
 * Remove `undefined` recursivamente — o Firestore o rejeita, inclusive dentro de `fields[]`. Espelha
 * `data/utils/pruneUndefined`, mas aqui na camada de domínio (que não pode importar `data`).
 */
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

export interface MaterializedScreen {
  screenKey: string;
  input: ScreenDefinitionInput;
}

/**
 * Materializa um template numa `ScreenDefinitionInput` pronta para `upsert`: chave namespaced,
 * `managed`, `ownerPluginId` na tela e em cada campo, e todas as referências entre telas do pacote
 * (refEntity de campo, `aggregation.from`, `parentEntity`) reescritas para as chaves instaladas.
 * Referência a coleção fixa (`persons`) ou a algo fora do pacote fica intacta.
 */
export const materializeScreen = (
  template: ScreenModuleTemplate,
  pluginId: string,
  keyMap: Map<string, string>,
  createdBy: string,
  actionMap: Map<string, string> = new Map(),
): MaterializedScreen => {
  const screenKey = keyMap.get(template.key) ?? installedScreenKey(pluginId, template.key);
  const mapActionIds = (ids: string[] | undefined): string[] =>
    (ids ?? []).map((id) => actionMap.get(id) ?? id);

  const fields = template.fields.map((field) => ({
    ...field,
    refEntity: rewriteRef(field.refEntity, keyMap),
    aggregation: field.aggregation
      ? { ...field.aggregation, from: rewriteRef(field.aggregation.from, keyMap) ?? field.aggregation.from }
      : field.aggregation,
    ownerPluginId: pluginId,
  }));

  const input: ScreenDefinitionInput = {
    builtin: false,
    titleSingular: template.titleSingular,
    titlePlural: template.titlePlural,
    icon: template.icon,
    fields,
    nativeFieldOverrides: null,
    fieldOrderUnified: true,
    titleFieldKey: template.titleFieldKey,
    hasNotes: template.hasNotes ?? false,
    hasDocuments: template.hasDocuments ?? false,
    hasTags: template.hasTags ?? false,
    listActions: template.listActions ?? [],
    viewActionIds: mapActionIds(template.viewActionIds),
    cardActionIds: mapActionIds(template.cardActionIds),
    parentEntity: rewriteRef(template.parentEntity, keyMap) ?? null,
    parentFieldKey: template.parentFieldKey ?? null,
    ownerPluginId: pluginId,
    managed: true,
    sidebarOrder: template.sidebarOrder ?? 0,
    enabled: template.enabled ?? true,
    createdBy,
  };

  return { screenKey, input: stripUndefined(input) };
};

/** Todas as telas do plugin, materializadas na ordem do pacote. */
export const materializePluginScreens = (
  plugin: MarketplacePlugin,
  createdBy: string,
): MaterializedScreen[] => {
  const screens = plugin.screens ?? [];
  const keyMap = buildScreenKeyMap(plugin.manifest.id, screens);
  return screens.map((template) => materializeScreen(template, plugin.manifest.id, keyMap, createdBy));
};
