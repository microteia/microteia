/** Os endereços do portal — fora do espaço de trabalho, e por isso fora da pilha de stores dele. */
export const PORTAL_PATH = '/portal';
export const PORTAL_SIGN_IN_PATH = '/portal/signin';

export const portalTenantPath = (tenantId: string): string => `${PORTAL_PATH}/${encodeURIComponent(tenantId)}`;

/** Para onde o link do e-mail devolve quem foi convidado. */
export const portalSignInUrl = (origin: string, tenantId: string): string =>
  `${origin}${PORTAL_SIGN_IN_PATH}?tenant=${encodeURIComponent(tenantId)}`;
