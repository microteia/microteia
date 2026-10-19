import type { Contribution } from './plugin/contribution';
import type { ExtensionPointDefinition } from './plugin/extensionPoint';

export const PORTAL_VIEW_POINT = 'portal.view';

export const PORTAL_API_VERSION = '1.0.0';

/** Onde a view entra: a lista de uma tela no portal, ou o registro aberto dela. */
export type PortalViewSurface = 'list' | 'detail';

export interface PortalViewMetadata {
  /** A coleção cuja tela a view substitui no portal. */
  collection: string;
  surface: PortalViewSurface;
}

/**
 * A tela PRÓPRIA de uma extensão no portal — o que o convidado vê no lugar da lista ou do registro
 * genéricos de uma coleção.
 *
 * Só código (`code`), e só de extensão cujo código o escritório confia: a view roda no navegador do
 * convidado, e é o servidor que a entrega, conferindo a MESMA confiança que o escritório dá ao código
 * dentro dele. O convidado não lê `installed_extensions`.
 *
 * A view não alcança `@microteia/data`: o convidado não tem os stores do escritório. Ela recebe
 * `@microteia/portal`, que lê só as projeções — o mesmo que a casca genérica lê.
 */
export const PORTAL_EXTENSION_POINTS: ExtensionPointDefinition[] = [
  {
    id: PORTAL_VIEW_POINT,
    apiVersion: PORTAL_API_VERSION,
    title: '@core.tenant/point.portal-view',
    description: '@core.tenant/point.portal-view.description',
    ownerPluginId: 'core.tenant',
    allowedImplKinds: ['code'],
    implRequired: true,
    multiple: true,
  },
];

/** A metadata lida com desconfiança. Malformada é ausente: a casca genérica continua valendo. */
export const asPortalViewMetadata = (metadata: unknown): PortalViewMetadata | null => {
  if (!metadata || typeof metadata !== 'object') return null;
  const raw = metadata as Record<string, unknown>;
  if (typeof raw.collection !== 'string' || raw.collection.trim() === '') return null;
  if (raw.surface !== 'list' && raw.surface !== 'detail') return null;
  return { collection: raw.collection.trim(), surface: raw.surface };
};

/** Uma view de portal pronta para a casca: de quem é, onde entra e a fonte dela. */
export interface PortalViewDescriptor extends PortalViewMetadata {
  pluginId: string;
  key: string;
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
  const key = contribution.impl.key;
  const source = views.find((view) => view.key === key)?.source;
  return metadata && source ? [{ ...metadata, pluginId, key, source }] : [];
});
