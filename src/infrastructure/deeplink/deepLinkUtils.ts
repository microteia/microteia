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

export const generateDeepLink = (tabKey: string): string => {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}#${HASH_PREFIX}${encodeURIComponent(tabKey)}`;
};

export const isMicroteiaLink = (href: string | undefined): href is string =>
  typeof href === 'string' && href.startsWith(MICROTEIA_PATH_PREFIX);

export const parseMicroteiaTabKey = (href: string): string =>
  href.slice(MICROTEIA_PATH_PREFIX.length);
