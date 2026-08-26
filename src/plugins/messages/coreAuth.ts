/**
 * Os textos da ENTRADA no sistema. Namespace próprio porque o dono é próprio: `core.auth` declara o
 * ponto `auth.provider`, e o rótulo de um meio de entrada é dele — não da tela que o desenha.
 */
export const CORE_AUTH_MESSAGES: Record<string, string> = {
  'point.provider': 'Sign-in method',
  'point.provider.description':
    'Adds a way of signing in — a corporate SSO (OIDC or SAML), an identity provider, or the '
    + 'e-mail and password form itself. Declaration only: the protocol is configured in Firebase '
    + 'Authentication, and the package just names it.',
  'provider.password': 'E-mail and password',
  'provider.google': 'Continue with Google',
  'provider.facebook': 'Continue with Facebook',
  'provider.microsoft': 'Continue with Microsoft',
  'provider.apple': 'Continue with Apple',
  'provider.github': 'Continue with GitHub',
  'provider.sso': 'Continue with single sign-on',
  'error.no-provider': 'No sign-in method is available. Whoever installed the system needs to enable one.',
};
