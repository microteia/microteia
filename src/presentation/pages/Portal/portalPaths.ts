import { PORTAL_BASE_PATH } from '../../../domain/schema/portal';

/** Os endereços do portal — fora do espaço de trabalho, e por isso fora da pilha de stores dele. */
export const PORTAL_PATH = PORTAL_BASE_PATH;
export const PORTAL_SIGN_IN_PATH = `${PORTAL_BASE_PATH}/signin`;

/** O parâmetro do acesso que diz para onde voltar depois de entrar — o registro de um aviso. */
export const PORTAL_NEXT_PARAM = 'next';

/**
 * Se o endereço pode ser o destino depois do acesso: só um caminho DENTRO do portal, e nunca a
 * própria página de acesso. Um destino livre faria do link de acesso um redirecionamento aberto.
 */
export const isPortalReturnPath = (value: string | null | undefined): value is string =>
  typeof value === 'string'
  && value.startsWith(`${PORTAL_PATH}/`)
  && !value.includes('\\')
  && !value.startsWith(PORTAL_SIGN_IN_PATH);

export const portalTenantPath = (tenantId: string): string => `${PORTAL_PATH}/${encodeURIComponent(tenantId)}`;

/** Um item do menu: a tela (pelo nome da coleção) ou a página de extensão (`page.<plugin>.<chave>`). */
export const portalEntryPath = (tenantId: string, entryId: string): string =>
  `${portalTenantPath(tenantId)}/${encodeURIComponent(entryId)}`;

/**
 * O perfil do convidado, no lugar de um item do menu. Item de menu é nome de coleção (sem ponto) ou
 * `page.<plugin>.<chave>` — este não colide com nenhum dos dois.
 */
export const PORTAL_PROFILE_ENTRY = 'account.profile';

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
  options: { email?: string; locale?: string; next?: string } = {},
): string => {
  const query = new URLSearchParams({ tenant: tenantId });
  if (options.email) query.set('email', options.email);
  if (isPortalReturnPath(options.next)) query.set(PORTAL_NEXT_PARAM, options.next);
  // `locale`, e não `lang`: o Firebase acrescenta o PRÓPRIO `lang` ao devolver para cá, e os dois
  // colidiam — a página lia o do Firebase.
  if (options.locale) query.set('locale', options.locale);
  return `${origin}${PORTAL_SIGN_IN_PATH}?${query.toString()}`;
};
