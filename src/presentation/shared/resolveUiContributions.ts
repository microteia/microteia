import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import type { UiNavMetadata, UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';

export const pageMetadataOf = (contribution: QualifiedContribution): UiPageMetadata =>
  contribution.metadata as unknown as UiPageMetadata;

export const navMetadataOf = (contribution: QualifiedContribution): UiNavMetadata =>
  contribution.metadata as unknown as UiNavMetadata;

/**
 * Casa uma chave de aba com a contribuição de tela responsável: primeiro por chave exata, depois
 * pelo prefixo mais longo. O prefixo mais longo importa porque `new-person:clone:` e
 * `new-person:` coexistiriam — sem esse critério, quem vencesse dependeria da ordem de registro.
 */
export const resolvePageContribution = (
  contributions: QualifiedContribution[],
  tabKey: string,
): QualifiedContribution | undefined => {
  const exact = contributions.find((contribution) => pageMetadataOf(contribution).key === tabKey);
  if (exact) return exact;

  let best: QualifiedContribution | undefined;
  let bestLength = -1;
  for (const contribution of contributions) {
    const prefix = pageMetadataOf(contribution).keyPrefix;
    if (!prefix || !tabKey.startsWith(prefix)) continue;
    if (prefix.length > bestLength) {
      best = contribution;
      bestLength = prefix.length;
    }
  }
  return best;
};

/**
 * O predicado de autorização que estas funções recebem — `canAny` do `useAuthorization`.
 *
 * Ele chega por parâmetro, e não por hook, porque estas funções são puras e testáveis sem React; e
 * chega como PERGUNTA, e não como conjunto de permissões, para que o curinga do dono do escritório e
 * o administrador global sejam decididos num lugar só.
 */
export type CanAny = (permissions: string[]) => boolean;

const isPermitted = (canAny: CanAny, required: string[] | undefined): boolean =>
  !required || required.length === 0 || canAny(required);

/** Telas abríveis pelo menu e pelo ⌘K: têm chave própria e não são abas paramétricas. */
export const navigablePages = (
  contributions: QualifiedContribution[],
  canAny: CanAny,
  isSystemAdmin: boolean,
): UiPageMetadata[] =>
  contributions
    .map(pageMetadataOf)
    .filter((metadata) => Boolean(metadata.key) && !metadata.keyPrefix)
    .filter((metadata) => !metadata.requiresSystemAdmin || isSystemAdmin)
    .filter((metadata) => isPermitted(canAny, metadata.requiredPermissions));

export const visibleNavItems = (
  contributions: QualifiedContribution[],
  canAny: CanAny,
): UiNavMetadata[] =>
  contributions
    .map(navMetadataOf)
    .filter((metadata) => isPermitted(canAny, metadata.requiredPermissions))
    .sort((a, b) => a.order - b.order);
