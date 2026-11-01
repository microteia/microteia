// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/portalExtensionPoints.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

import type { Contribution } from './plugin/contribution';
import type { ExtensionPointDefinition } from './plugin/extensionPoint';
import { readPortalWidgetSpec, type PortalWidgetSpec } from './ui/portalWidget';

export const PORTAL_VIEW_POINT = 'portal.view';

export const PORTAL_API_VERSION = '1.3.0';

/**
 * Onde a view entra no portal:
 *
 * - `list` / `detail`: no lugar da lista ou do registro aberto genéricos de UMA coleção;
 * - `page`: uma página da extensão, com entrada no MENU do portal (blocos da home, abas no
 *   computador, barra no celular);
 * - `widget`: um cartão na home;
 * - `home`: a home inteira, no lugar da padrão;
 * - `layout`: a CASCA inteira — onde ficam a marca, o menu e o usuário. Recebe o conteúdo da página
 *   como `children` e lê o resto de `usePortalShell()`. Quem escolhe o layout é o escritório.
 */
export type PortalViewSurface = 'list' | 'detail' | 'page' | 'widget' | 'home' | 'layout';

export const PORTAL_VIEW_SURFACES: readonly PortalViewSurface[] = ['list', 'detail', 'page', 'widget', 'home', 'layout'];

/** As superfícies em que a implementação pode ser DECLARADA (`impl.kind: 'widget'`) em vez de código. */
export const PORTAL_DECLARED_SURFACES: readonly PortalViewSurface[] = ['widget', 'page'];

/** As superfícies que pertencem a UMA coleção — e por isso exigem `collection`. */
const COLLECTION_SURFACES: ReadonlySet<PortalViewSurface> = new Set(['list', 'detail']);
/** As que entram numa lista ordenável pelo escritório — e por isso exigem `key`. */
const KEYED_SURFACES: ReadonlySet<PortalViewSurface> = new Set(['page', 'widget', 'layout']);

export interface PortalViewMetadata {
  surface: PortalViewSurface;
  /** `list` e `detail`: a coleção cuja tela a view substitui. */
  collection?: string;
  /** `page` e `widget`: o id da entrada, único no pacote. */
  key?: string;
  /** `page` e `widget`: o rótulo — referência de mensagem (`@ns/chave`). */
  title?: string;
  /** `page`: o ícone do menu, do conjunto curado de ícones de tela. */
  icon?: string;
  /** `page` e `widget`: a posição SUGERIDA. Quem decide a ordem final é o escritório. */
  order?: number;
}

/**
 * A tela PRÓPRIA de uma extensão no portal.
 *
 * Código (`code`) só de extensão cujo código o escritório confia: a view roda no navegador do convidado,
 * e é o servidor que a entrega, conferindo a MESMA confiança que o escritório dá ao código dentro dele.
 * O convidado não lê `installed_extensions`. A view não alcança `@microteia/data`: o convidado não tem
 * os stores do escritório. Ela recebe `@microteia/portal`, que lê só as projeções.
 *
 * Declaração (`widget`), nas superfícies `widget` e `page`: o cartão da home e a página do menu em DSL
 * (`PortalWidgetSpec`). Não roda código, e por isso vale para toda extensão LIGADA, sem a confiança do
 * escritório — o servidor só deixa sair o que lê campo exposto, e só o conteúdo que tem texto
 * (`guestPortalWidgetSpec`).
 */
export const PORTAL_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: PORTAL_VIEW_POINT,
    apiVersion: PORTAL_API_VERSION,
    title: '@core.tenant/point.portal-view',
    description: '@core.tenant/point.portal-view.description',
    ownerPluginId: 'core.tenant',
    allowedImplKinds: ['code', 'widget'],
    implRequired: true,
    multiple: true,
  },
];

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/** A metadata lida com desconfiança. Malformada é ausente: a casca genérica continua valendo. */
export const asPortalViewMetadata = (metadata: unknown): PortalViewMetadata | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata as Record<string, unknown>;
  const surface = raw.surface as PortalViewSurface;
  if (!PORTAL_VIEW_SURFACES.includes(surface)) return null;

  const collection = text(raw.collection);
  const key = text(raw.key);
  if (COLLECTION_SURFACES.has(surface) && !collection) return null;
  if (KEYED_SURFACES.has(surface) && !key) return null;

  return {
    surface,
    ...(collection && COLLECTION_SURFACES.has(surface) ? { collection } : {}),
    ...(key && KEYED_SURFACES.has(surface) ? { key } : {}),
    ...(text(raw.title) ? { title: text(raw.title) } : {}),
    ...(text(raw.icon) ? { icon: text(raw.icon) } : {}),
    ...(typeof raw.order === 'number' && Number.isFinite(raw.order) ? { order: raw.order } : {}),
  };
};

/** Uma view de portal pronta para a casca: de quem é, onde entra e a fonte dela. */
export interface PortalViewDescriptor extends PortalViewMetadata {
  pluginId: string;
  /** A chave da VIEW em `views` — o código. Não confundir com `key`, a da entrada no menu. */
  viewKey: string;
  source: string;
}

/**
 * As views de portal de UM pacote instalado: as contribuições `portal.view` com a fonte que cada uma
 * aponta em `views`. Contribuição sem fonte correspondente é descartada — não há o que rodar.
 */
export const portalViewsOf = (
  pluginId: string,
  contributions: readonly Contribution[],
  views: ReadonlyArray<{ key: string; source: string }>,
): PortalViewDescriptor[] => contributions.flatMap((contribution) => {
  if (contribution?.point !== PORTAL_VIEW_POINT || contribution.impl?.kind !== 'code') return [];
  const metadata = asPortalViewMetadata(contribution.metadata);
  const viewKey = contribution.impl.key;
  const source = views.find((view) => view.key === viewKey)?.source;
  return metadata && source ? [{ ...metadata, pluginId, viewKey, source }] : [];
});

/** Um cartão da home DECLARADO (`impl.kind: 'widget'`): de quem é, a entrada e a árvore. */
export interface PortalWidgetSpecDescriptor {
  pluginId: string;
  key: string;
  title?: string;
  order?: number;
  spec: PortalWidgetSpec;
}

/**
 * Os cartões declarados de UM pacote instalado: as contribuições `portal.view` de superfície `widget`
 * com implementação `widget`. A de outra superfície, e a árvore sem nada aproveitável, são descartadas.
 */
export const portalWidgetSpecsOf = (
  pluginId: string,
  contributions: readonly Contribution[],
): PortalWidgetSpecDescriptor[] => contributions.flatMap((contribution) => {
  if (contribution?.point !== PORTAL_VIEW_POINT || contribution.impl?.kind !== 'widget') return [];
  const metadata = asPortalViewMetadata(contribution.metadata);
  const spec = readPortalWidgetSpec(contribution.impl.spec);
  if (metadata?.surface !== 'widget' || !metadata.key || !spec) return [];
  return [{
    pluginId,
    key: metadata.key,
    ...(metadata.title ? { title: metadata.title } : {}),
    ...(metadata.order !== undefined ? { order: metadata.order } : {}),
    spec,
  }];
});

/** Uma página do menu DECLARADA (`impl.kind: 'widget'`): de quem é, a entrada e a árvore. */
export interface PortalPageSpecDescriptor {
  pluginId: string;
  key: string;
  title?: string;
  icon?: string;
  order?: number;
  spec: PortalWidgetSpec;
}

/**
 * As páginas declaradas de UM pacote instalado: as contribuições `portal.view` de superfície `page` com
 * implementação `widget`. A régua é a dos cartões: a árvore sem nada aproveitável é descartada.
 */
export const portalPageSpecsOf = (
  pluginId: string,
  contributions: readonly Contribution[],
): PortalPageSpecDescriptor[] => contributions.flatMap((contribution) => {
  if (contribution?.point !== PORTAL_VIEW_POINT || contribution.impl?.kind !== 'widget') return [];
  const metadata = asPortalViewMetadata(contribution.metadata);
  const spec = readPortalWidgetSpec(contribution.impl.spec);
  if (metadata?.surface !== 'page' || !metadata.key || !spec) return [];
  return [{
    pluginId,
    key: metadata.key,
    ...(metadata.title ? { title: metadata.title } : {}),
    ...(metadata.icon ? { icon: metadata.icon } : {}),
    ...(metadata.order !== undefined ? { order: metadata.order } : {}),
    spec,
  }];
});

// ─── O menu e a home ─────────────────────────────────────────────────────────

/** A entrada de uma TELA do portal no menu: o nome da coleção, que não tem ponto. */
export const portalScreenEntryId = (collection: string): string => collection;

/**
 * A entrada de uma PÁGINA de extensão no menu. O prefixo `page.` não colide com coleção nenhuma —
 * nome de coleção não leva ponto —, e o id do plugin desfaz a colisão entre duas extensões.
 */
export const portalPageEntryId = (pluginId: string, key: string): string => `page.${pluginId}.${key}`;

export const portalWidgetEntryId = (pluginId: string, key: string): string => `${pluginId}.${key}`;

/**
 * Os layouts do kernel. `sidebar`: o menu numa coluna à esquerda; `top`: o menu numa faixa no topo.
 * Os dois viram gaveta no celular. O de uma extensão é `layout.<plugin>.<chave>`.
 */
export const PORTAL_BUILTIN_LAYOUTS = ['sidebar', 'top'] as const;

export type PortalBuiltinLayout = (typeof PORTAL_BUILTIN_LAYOUTS)[number];

export const DEFAULT_PORTAL_LAYOUT: PortalBuiltinLayout = 'sidebar';

export const portalLayoutId = (pluginId: string, key: string): string => `layout.${pluginId}.${key}`;

export const isBuiltinPortalLayout = (id: string): id is PortalBuiltinLayout =>
  (PORTAL_BUILTIN_LAYOUTS as readonly string[]).includes(id);

/** Ordem e visibilidade de uma lista do portal, como o escritório gravou. */
export interface PortalListPreference {
  order: string[];
  hidden: string[];
}

/** O que o escritório configura na home do portal (`tenants/{t}/settings/portal`). */
export interface PortalHomeSettings {
  /** As boas-vindas — texto do escritório, que não passa por tradução. */
  welcome: string;
  menu: PortalListPreference;
  widgets: PortalListPreference;
  /** O layout escolhido: `sidebar`, `top`, ou `layout.<plugin>.<chave>`. Vazio = o padrão. */
  layout: string;
}

export const PORTAL_SETTINGS_DOC = 'portal';

const asIdList = (value: unknown): string[] =>
  Array.isArray(value) ? [...new Set(value.filter((item): item is string => typeof item === 'string' && item !== ''))] : [];

const asPreference = (value: unknown): PortalListPreference => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return { order: asIdList(raw.order), hidden: asIdList(raw.hidden) };
};

export const asPortalHomeSettings = (value: unknown): PortalHomeSettings => {
  const raw = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  return {
    welcome: typeof raw.welcome === 'string' ? raw.welcome : '',
    menu: asPreference(raw.menu),
    widgets: asPreference(raw.widgets),
    layout: typeof raw.layout === 'string' ? raw.layout : '',
  };
};

/**
 * Aplica a preferência do escritório a uma lista de entradas: primeiro as que ele ordenou, na ordem
 * dele; depois as que ele ainda não viu (uma extensão instalada ontem), na ordem sugerida. As que ele
 * escondeu saem. Entrada nova aparece — esconder é gesto, não padrão.
 */
export const applyPortalPreference = <T extends { id: string; order?: number }>(
  entries: readonly T[],
  preference: PortalListPreference,
): T[] => {
  const hidden = new Set(preference.hidden);
  const byId = new Map(entries.map((entry) => [entry.id, entry]));
  const ordered = preference.order.map((id) => byId.get(id)).filter((entry): entry is T => !!entry);
  const placed = new Set(ordered.map((entry) => entry.id));
  const rest = entries
    .filter((entry) => !placed.has(entry.id))
    .map((entry, index) => ({ entry, index }))
    .sort((a, b) => (a.entry.order ?? Number.MAX_SAFE_INTEGER) - (b.entry.order ?? Number.MAX_SAFE_INTEGER) || a.index - b.index)
    .map(({ entry }) => entry);
  return [...ordered, ...rest].filter((entry) => !hidden.has(entry.id));
};
