import type { QualifiedContribution } from '../../../../domain/schema/plugin/contribution';
import { PORTAL_VIEW_POINT, asPortalViewMetadata } from '../../../../domain/schema/portalExtensionPoints';
import { portalWidgetMarkdownRefs, readPortalWidgetSpec } from '../../../../domain/schema/ui/portalWidget';
import { buildMessageCatalog, type MessageBundle } from '../../../../domain/schema/i18n/messages';
import { parseMessageRef } from '../../../../domain/schema/i18n/messageRef';
import { normalizeLocale } from '../../../../domain/schema/i18n/localeNegotiation';

/** Um texto que o escritório pode trocar: a referência e onde ela aparece no portal. */
export interface PortalTextEntry {
  ref: string;
  /** Os títulos das páginas e cartões que a citam, como a extensão os declara (`@ns/chave` ou literal). */
  titles: string[];
  pluginIds: string[];
}

/**
 * Os textos editáveis: o `content` de todo nó `markdown` das páginas e cartões DECLARADOS das extensões
 * ligadas. É a mesma régua do servidor — só esse conteúdo passa pelo texto do escritório —, e por isso a
 * lista não oferece o que a edição não alcançaria.
 */
export const portalTextEntries = (contributions: readonly QualifiedContribution[]): PortalTextEntry[] => {
  const byRef = new Map<string, PortalTextEntry>();
  for (const contribution of contributions) {
    if (contribution.point !== PORTAL_VIEW_POINT || contribution.impl?.kind !== 'widget') continue;
    const spec = readPortalWidgetSpec(contribution.impl.spec);
    const metadata = asPortalViewMetadata(contribution.metadata);
    if (!spec || !metadata) continue;
    const title = metadata.title ?? metadata.key ?? contribution.id;
    for (const ref of portalWidgetMarkdownRefs(spec.body)) {
      if (!parseMessageRef(ref)) continue;
      const entry = byRef.get(ref) ?? { ref, titles: [], pluginIds: [] };
      if (!entry.titles.includes(title)) entry.titles.push(title);
      if (!entry.pluginIds.includes(contribution.pluginId)) entry.pluginIds.push(contribution.pluginId);
      byRef.set(ref, entry);
    }
  }
  return [...byRef.values()];
};

/** Os idiomas em que algum pacote instalado traz a chave — normalizados, sem repetição. */
export const packageLocalesOf = (ref: string, bundles: readonly MessageBundle[]): string[] => {
  const parsed = parseMessageRef(ref);
  if (!parsed) return [];
  return [...new Set(bundles
    .filter((bundle) => bundle.namespace === parsed.namespace && bundle.messages[parsed.key] !== undefined)
    .map((bundle) => normalizeLocale(bundle.locale)))];
};

/**
 * O texto do PACOTE naquele idioma — a mesma fusão que o portal faz, sem a edição do escritório. `null`
 * quando nenhum pacote o traz, nem num idioma mais genérico.
 */
export const packageTextOf = (ref: string, locale: string, bundles: readonly MessageBundle[]): string | null => {
  const parsed = parseMessageRef(ref);
  if (!parsed) return null;
  return buildMessageCatalog([...bundles], locale).messages[parsed.full] ?? null;
};
