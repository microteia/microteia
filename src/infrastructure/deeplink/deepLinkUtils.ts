import { appDeepLinkPath } from '../../domain/schema/recordLink';

const HASH_PREFIX = 'tab=';
const MICROTEIA_PATH_PREFIX = '/microteia/';

export const parseDeepLink = (): string | null => {
  const hash = window.location.hash.slice(1);
  if (!hash.startsWith(HASH_PREFIX)) return null;
  return decodeURIComponent(hash.slice(HASH_PREFIX.length));
};

export const parseDeepLinkFromPath = (): string | null => {
  const { pathname } = window.location;
  if (!pathname.startsWith(MICROTEIA_PATH_PREFIX)) return null;
  return decodeURIComponent(pathname.slice(MICROTEIA_PATH_PREFIX.length));
};

/**
 * O escritório ATUAL, para o link copiado levá-lo junto. Quem o informa é o `TenantStore`, a cada
 * troca: o link de um escritório colado por quem está noutro abriria o registro no lugar errado.
 */
let linkTenantId = '';

export const setDeepLinkTenant = (tenantId: string): void => {
  linkTenantId = tenantId;
};

/**
 * O link UNIVERSAL do app — o mesmo do e-mail e do push: `/microteia/<aba>?tenant=<id>`. Para um
 * registro, a aba é `record:<coleção>:<id>` (`recordLinkTabKey`), que abre pela tela que descrever a
 * coleção no dia do clique. O formato antigo (`#tab=`) continua sendo lido: link já colado não morre.
 */
export const generateDeepLink = (tabKey: string, tenantId: string = linkTenantId): string =>
  `${window.location.origin}${appDeepLinkPath(tabKey, tenantId)}`;

/** O caminho de um link do app — relativo, ou absoluto DESTE endereço (o que o "Copiar link" dá). */
const appPathOf = (href: string): string | null => {
  if (href.startsWith(MICROTEIA_PATH_PREFIX)) return href;
  const origin = typeof window === 'undefined' ? '' : window.location.origin;
  return origin && href.startsWith(`${origin}${MICROTEIA_PATH_PREFIX}`) ? href.slice(origin.length) : null;
};

export const isMicroteiaLink = (href: string | undefined): href is string =>
  typeof href === 'string' && appPathOf(href) !== null;

/** A aba do link, decodificada e sem a consulta (`?tenant=`) — que o shell lê da URL, não daqui. */
export const parseMicroteiaTabKey = (href: string): string => {
  const path = appPathOf(href) ?? href;
  const raw = path.slice(MICROTEIA_PATH_PREFIX.length).split('?')[0];
  try {
    return decodeURIComponent(raw);
  } catch {
    return raw;
  }
};
