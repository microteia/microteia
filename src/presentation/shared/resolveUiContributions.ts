import type { QualifiedContribution } from '../../domain/schema/plugin/contribution';
import type { SettingsSection } from '../../domain/schema/settings';
import type { UiNavGroupMetadata, UiNavMetadata, UiPageMetadata } from '../../domain/schema/ui/uiExtensionPoints';

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

/** A chave da tela inicial que esta pessoa pode abrir — ver `UiPageMetadata.home`. */
export const homePageKey = (
  contributions: QualifiedContribution[],
  canAny: CanAny,
  isSystemAdmin: boolean,
): string | undefined =>
  navigablePages(contributions, canAny, isSystemAdmin).find((metadata) => metadata.home)?.key;

export const visibleNavItems = (
  contributions: QualifiedContribution[],
  canAny: CanAny,
): UiNavMetadata[] =>
  contributions
    .map(navMetadataOf)
    .filter((metadata) => isPermitted(canAny, metadata.requiredPermissions))
    .sort((a, b) => a.order - b.order);

/**
 * Os grupos declarados, um por `key`. Duas extensões que declaram a mesma `key` falam do mesmo grupo,
 * e vale a primeira na ordem de carga — a mesma regra de `home`. A declaração sem `key` não forma
 * grupo: o item que a apontasse não teria como encontrá-la.
 */
export const declaredNavGroups = (contributions: QualifiedContribution[]): UiNavGroupMetadata[] => {
  const byKey = new Map<string, UiNavGroupMetadata>();
  for (const contribution of contributions) {
    const metadata = contribution.metadata as unknown as UiNavGroupMetadata;
    if (typeof metadata.key !== 'string' || metadata.key === '' || byKey.has(metadata.key)) continue;
    byKey.set(metadata.key, metadata);
  }
  return [...byKey.values()];
};

/** Um trecho da barra lateral: um grupo com título, ou itens soltos (`group: null`). */
export interface NavSection<T> {
  group: UiNavGroupMetadata | null;
  items: T[];
}

/**
 * Reparte os itens de menu em seções. Recebe os itens já filtrados por permissão e por alvo — é o que
 * faz um grupo sem nenhum item visível simplesmente não aparecer.
 *
 * - O item sem `group`, ou com um `group` que ninguém declarou, fica solto: nunca some.
 * - O grupo ocupa a posição do `order` DELE, na mesma régua dos itens soltos; dentro dele, os itens
 *   seguem o `order` de cada um.
 * - O grupo com um item só não ganha título: um cabeçalho para uma linha gasta espaço e esconde o item
 *   atrás de um clique a mais. O item fica solto, na posição do grupo.
 * - Itens soltos vizinhos formam uma seção só.
 */
export const groupNavSections = <T extends { order: number; group?: string }>(
  items: T[],
  groups: UiNavGroupMetadata[],
): NavSection<T>[] => {
  const declared = new Map(groups.map((group) => [group.key, group]));
  const members = new Map<string, T[]>();
  const blocks: { order: number; section: NavSection<T> }[] = [];

  for (const item of items) {
    const group = item.group ? declared.get(item.group) : undefined;
    if (!group) {
      blocks.push({ order: item.order, section: { group: null, items: [item] } });
      continue;
    }
    const existing = members.get(group.key);
    if (existing) existing.push(item);
    else members.set(group.key, [item]);
  }

  for (const [key, grouped] of members) {
    const group = declared.get(key)!;
    const sorted = [...grouped].sort((a, b) => a.order - b.order);
    blocks.push({ order: group.order, section: { group: sorted.length > 1 ? group : null, items: sorted } });
  }

  const sections: NavSection<T>[] = [];
  for (const { section } of blocks.sort((a, b) => a.order - b.order)) {
    const previous = sections[sections.length - 1];
    if (section.group === null && previous?.group === null) previous.items.push(...section.items);
    else sections.push(section);
  }
  return sections;
};

/**
 * As seções de Configurações que esta pessoa VÊ. Mesmo predicado de `visibleNavItems`, e é o ponto:
 * uma seção era a única contribuição de UI sem `requiredPermissions`, então o que uma extensão
 * expunha ali ficava sob a permissão de configurar o escritório inteiro ou sob nenhuma.
 *
 * O que ela NÃO faz é filtrar o catálogo. Quem consome esta lista é a tela; quem resolve o valor de
 * uma propriedade continua vendo tudo, porque é do catálogo que sai o padrão declarado — esconder a
 * seção de quem não a configura não pode mudar o comportamento que ela configura.
 */
export const visibleSettingsSections = <T extends SettingsSection>(
  sections: T[],
  canAny: CanAny,
): T[] => sections.filter((section) => isPermitted(canAny, section.requiredPermissions));
