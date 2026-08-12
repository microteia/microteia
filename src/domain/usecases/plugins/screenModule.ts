import type { MarketplacePlugin, ScreenModuleTemplate } from '../../entities/MarketplacePlugin';
import type { ScreenDefinition } from '../../entities';
import type { ScreenDefinitionInput } from '../../repositories/IScreenDefinitionRepository';
import { RESERVED_COLLECTIONS, screenIdIssue } from '../../schema/screenEntity';
import { ensureUniqueKey, slugifyFieldKey } from '../../services/customFieldValues';

/**
 * Chave real da tela instalada: a MESMA que o pacote declara. A chave É o nome da coleção no
 * Firestore (`tenants/{tenantId}/produtos`), então ela aparece no código da extensão, nos stores e nas
 * consultas — um nome curto e legível não é estética, é a interface da entidade.
 *
 * Só quando o nome já está OCUPADO no escritório de destino (outra tela, lista de opções ou conjunto
 * de etiquetas — as três disputam o mesmo espaço de nomes) ou é RESERVADO pelo sistema é que ganha
 * sufixo: `produtos` → `produtos_2`. É a mesma convenção que o Form Design aplica quando o usuário
 * cria duas telas de título parecido, e o resultado é sempre um nome de coleção válido.
 */
export const installedScreenKey = (templateKey: string, taken: ReadonlySet<string> = new Set()): string => {
  const declared = templateKey.trim();
  const base = (screenIdIssue(declared) === undefined ? declared : slugifyFieldKey(declared)) || 'tela';
  return ensureUniqueKey(base, new Set([...taken, ...RESERVED_COLLECTIONS]));
};

/** A coleção que a tela do pacote opera: a que ela declara descrever ou, no silêncio, a própria chave. */
export const templateCollection = (screen: Pick<ScreenModuleTemplate, 'key' | 'dataCollection'>): string =>
  screen.dataCollection?.trim() || screen.key;

/**
 * O prefixo dos eventos que a tela do pacote emite (`<prefixo>.saved` / `.deleted`).
 *
 * É o ponto único que traduz "tela" em "nome de evento" no empacotamento, e existe porque as duas
 * coisas deixaram de ser a mesma palavra: o evento nasce da CHAVE da tela, salvo quando ela descreve
 * outra coleção ou declara o prefixo — aí o nome é declarado, não derivado.
 *
 * A distinção importa na instalação: a chave pode mudar (ganhar sufixo, ou ser a de uma tela que já
 * existia no escritório), enquanto prefixo e coleção são nomes globais e atravessam intactos. Ver
 * `buildScreenEventMap`.
 */
export const screenEventPrefix = (
  screen: Pick<ScreenModuleTemplate, 'key' | 'dataCollection' | 'eventPrefix'>,
): string => screen.eventPrefix?.trim() || templateCollection(screen);

/** Id UNIVERSAL da tela: o `sourceId` do template; na falta (tela legada), a própria chave. */
export const templateSourceId = (screen: Pick<ScreenModuleTemplate, 'key' | 'sourceId'>): string =>
  screen.sourceId ?? screen.key;

/** Conjunto de extensões que declaram um artefato, tolerando o campo antigo `ownerPluginId`. */
export const ownerSet = (artifact: { ownerPluginId?: string | null; ownerPluginIds?: string[] | null }): string[] =>
  artifact.ownerPluginIds && artifact.ownerPluginIds.length
    ? artifact.ownerPluginIds
    : (artifact.ownerPluginId ? [artifact.ownerPluginId] : []);

/**
 * Tela ADOTADA: já existia no tenant (Form Design ou kernel) e passou a ser declarada por uma
 * extensão porque tem o mesmo `sourceId`. Ela continua sendo do tenant — a `origin` preservada é o
 * que faz a desinstalação DEVOLVÊ-LA em vez de apagá-la, mantendo a chave da coleção (e os registros).
 */
export const isAdoptedScreen = (screen: Pick<ScreenDefinition, 'origin'>): boolean =>
  screen.origin !== 'plugin';

const screenSourceId = (screen: Pick<ScreenDefinition, 'id' | 'sourceId'>): string =>
  screen.sourceId ?? screen.id;

/**
 * Mapa `keyDeTemplate → chaveInstalada`, na ordem do pacote.
 *
 * (1) Deduplica por `sourceId`: se uma tela com o mesmo id universal já existe no tenant (trazida por
 * outra extensão, criada no Form Design ou instalada antes), reusa a chave DELA — instala uma vez só,
 * sem órfão de dados, e uma instalação antiga na chave longa continua onde está.
 * (2) Senão, reivindica a chave declarada, com sufixo se o nome estiver ocupado. `taken` traz as
 * coleções não-tela do escritório (listas e etiquetas); as telas existentes e as chaves já
 * reivindicadas por telas anteriores DESTE pacote entram aqui também.
 */
export const buildScreenKeyMap = (
  screens: ScreenModuleTemplate[],
  existingScreens: ScreenDefinition[] = [],
  taken: ReadonlySet<string> = new Set(),
): Map<string, string> => {
  const bySourceId = new Map(existingScreens.map((s) => [screenSourceId(s), s.id]));
  const claimed = new Set<string>([...taken, ...existingScreens.map((s) => s.id)]);
  const keyMap = new Map<string, string>();
  for (const screen of screens) {
    const key = bySourceId.get(templateSourceId(screen)) ?? installedScreenKey(screen.key, claimed);
    claimed.add(key);
    keyMap.set(screen.key, key);
  }
  return keyMap;
};

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
 * Materializa um template numa `ScreenDefinitionInput` pronta para `upsert`: chave instalada,
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
  const screenKey = keyMap.get(template.key) ?? installedScreenKey(template.key);
  const mapActionIds = (ids: string[] | undefined): string[] =>
    (ids ?? []).map((id) => actionMap.get(id) ?? id);

  const fields = template.fields.map((field) => ({
    ...field,
    refEntity: rewriteRef(field.refEntity, keyMap),
    aggregation: field.aggregation
      ? { ...field.aggregation, from: rewriteRef(field.aggregation.from, keyMap) ?? field.aggregation.from }
      : field.aggregation,
    origin: 'plugin' as const,
    ownerPluginId: pluginId,
  }));

  const input: ScreenDefinitionInput = {
    origin: 'plugin',
    titleSingular: template.titleSingular,
    titlePlural: template.titlePlural,
    icon: template.icon,
    fields,
    titleFieldKey: template.titleFieldKey,
    subtitleFieldKey: template.subtitleFieldKey ?? null,
    hasNotes: template.hasNotes ?? false,
    hasDocuments: template.hasDocuments ?? false,
    hasTags: template.hasTags ?? false,
    tagCollection: template.tagCollection ?? null,
    // Nome universal da coleção alvo: NÃO passa por `keyMap` (não é tela do pacote) nem por
    // desambiguação — é a entidade que já existe no escritório.
    dataCollection: template.dataCollection ?? null,
    eventPrefix: template.eventPrefix ?? null,
    recordTabPrefix: template.recordTabPrefix ?? null,
    writeRoles: template.writeRoles ?? null,
    authorCanDelete: template.authorCanDelete ?? null,
    listActions: template.listActions ?? [],
    viewActionIds: mapActionIds(template.viewActionIds),
    cardActionIds: mapActionIds(template.cardActionIds),
    parentEntity: rewriteRef(template.parentEntity, keyMap) ?? null,
    parentFieldKey: template.parentFieldKey ?? null,
    parentRelation: template.parentRelation ?? null,
    hideFromSidebar: template.hideFromSidebar ?? false,
    hideFromParentTabs: template.hideFromParentTabs ?? false,
    ownerPluginId: pluginId,
    ownerPluginIds: [pluginId],
    sourceId: templateSourceId(template),
    sourceRev: template.sourceRev ?? null,
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
  const keyMap = buildScreenKeyMap(screens);
  return screens.map((template) => materializeScreen(template, plugin.manifest.id, keyMap, createdBy));
};
