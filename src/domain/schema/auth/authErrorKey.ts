/**
 * O erro do provedor de identidade vira CHAVE de mensagem, nunca frase: quem exibe é que traduz.
 *
 * Mora no domínio, e não na tela de entrada onde nasceu, porque tem DOIS leitores desde que existe
 * fluxo de `redirect`: a tela, no clique, e o boot, na volta do provedor. Duas cópias garantiriam que
 * um código novo fosse tratado em uma delas.
 */
const ERROR_KEY_BY_CODE: Record<string, string> = {
  'auth/invalid-credential': 'login.error.invalid-credentials',
  'auth/user-not-found': 'login.error.invalid-credentials',
  'auth/wrong-password': 'login.error.invalid-credentials',
  'auth/email-already-in-use': 'login.error.email-in-use',
  'auth/weak-password': 'login.error.weak-password',
  'auth/invalid-email': 'login.error.invalid-email',
  'auth/too-many-requests': 'login.error.too-many-requests',
  'auth/user-disabled': 'login.error.user-disabled',
  'auth/account-exists-with-different-credential': 'login.error.account-exists',
  'auth/popup-blocked': 'login.error.popup-blocked',
  'auth/popup-closed-by-user': 'login.error.popup-closed',
  'auth/operation-not-allowed': 'login.error.provider-not-enabled',
};

export const GENERIC_AUTH_ERROR_KEY = 'login.error.generic';

export const authErrorCodeOf = (error: unknown): string | null =>
  error && typeof error === 'object' && 'code' in error && typeof (error as { code: unknown }).code === 'string'
    ? (error as { code: string }).code
    : null;

export const authErrorKey = (error: unknown): string => {
  const code = authErrorCodeOf(error);
  return (code && ERROR_KEY_BY_CODE[code]) ?? GENERIC_AUTH_ERROR_KEY;
};
