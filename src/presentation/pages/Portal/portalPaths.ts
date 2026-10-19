/** Os endereços do portal — fora do espaço de trabalho, e por isso fora da pilha de stores dele. */
export const PORTAL_PATH = '/portal';
export const PORTAL_SIGN_IN_PATH = '/portal/signin';

export const portalTenantPath = (tenantId: string): string => `${PORTAL_PATH}/${encodeURIComponent(tenantId)}`;

/** Um item do menu: a tela (pelo nome da coleção) ou a página de extensão (`page.<plugin>.<chave>`). */
export const portalEntryPath = (tenantId: string, entryId: string): string =>
  `${portalTenantPath(tenantId)}/${encodeURIComponent(entryId)}`;

/**
 * Para onde o link do e-mail devolve quem foi convidado.
 *
 * Leva o E-MAIL porque o Firebase exige confirmá-lo quando o link abre num navegador diferente do que o
 * pediu — e quem pede é sempre o escritório, nunca o convidado. Sem ele, todo convidado tinha de
 * redigitar o próprio e-mail. E leva o IDIOMA de quem convidou (`locale`): a página abre antes de haver sessão
 * ou escritório, e sem ele falaria a língua do navegador.
 */
export const portalSignInUrl = (
  origin: string,
  tenantId: string,
  options: { email?: string; locale?: string } = {},
): string => {
  const query = new URLSearchParams({ tenant: tenantId });
  if (options.email) query.set('email', options.email);
  // `locale`, e não `lang`: o Firebase acrescenta o PRÓPRIO `lang` ao devolver para cá, e os dois
  // colidiam — a página lia o do Firebase.
  if (options.locale) query.set('locale', options.locale);
  return `${origin}${PORTAL_SIGN_IN_PATH}?${query.toString()}`;
};
