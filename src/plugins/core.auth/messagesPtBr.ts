import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import type { Contribution } from '../../domain/schema/plugin/contribution';

/**
 * **Português (Brasil) da entrada no sistema** — a tradução viaja DENTRO do plugin que a usa, como no
 * `core.tenant`. Quem declara o texto é quem melhor sabe traduzi-lo, e um plugin deve chegar legível
 * sem depender do pacote de idioma.
 */
const CORE_AUTH_PT_BR: Record<string, string> = {
  'point.provider': 'Meio de entrada',
  'point.provider.description':
    'Acrescenta um jeito de entrar — um SSO corporativo (OIDC ou SAML), um provedor de identidade, '
    + 'ou o próprio formulário de e-mail e senha. Só declaração: o protocolo é configurado no '
    + 'Firebase Authentication, e o pacote apenas o nomeia.',
  'provider.password': 'E-mail e senha',
  'provider.google': 'Continuar com o Google',
  'provider.facebook': 'Continuar com o Facebook',
  'provider.microsoft': 'Continuar com a Microsoft',
  'provider.apple': 'Continuar com a Apple',
  'provider.github': 'Continuar com o GitHub',
  'provider.sso': 'Continuar com o login único',
  'error.no-provider': 'Nenhum meio de entrada disponível. Quem instalou o sistema precisa habilitar um.',
};

export const coreAuthPtBrContribution = (): Contribution =>
  messageBundleContribution({ locale: 'pt-BR', namespace: 'core.auth', messages: CORE_AUTH_PT_BR });
