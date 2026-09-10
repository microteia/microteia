import { messageBundleContribution } from '../../../../domain/schema/i18n';
import type { Contribution } from '../../../../domain/schema/plugin/contribution';
import { AUTH_NAMESPACE } from './authMessages';

/** **Portuguese (Brazil) for the Sign-in example** — the translation travels inside the package. */
const AUTH_PT_BR: Record<string, string> = {
  'package.name': 'Entrar no sistema, pelo exemplo',
  'package.category': 'Acesso',
  'package.description':
    'Um login único corporativo e o formulário de senha da casa, os dois declarados — mais um aviso no rodapé da tela de entrada.',
  'package.summary':
    'Como um escritório acrescenta o próprio jeito de entrar. Um login único cabe inteiro numa declaração, porque o Firebase Auth do projeto já sabe falar OIDC e SAML — o que faltava era um pacote dizer COM QUEM. O ponto não aceita implementação nenhuma, e é isso que o torna útil: aceitar código faria da entrada um privilégio de primeira parte, que é o oposto do que ela precisa ser.',

  'provider.sso': 'Entrar com o Acme ID',
  'provider.password': 'E-mail e senha',

  'slot.footer': 'Aviso da entrada',
  'slot.footer.description': 'Uma linha sob o formulário de entrada.',
  'footer.text': 'Problemas para entrar? Fale com quem administra esta instalação.',
};

export const authPtBrContribution = (): Contribution =>
  messageBundleContribution({
    locale: 'pt-BR',
    namespace: AUTH_NAMESPACE,
    messages: AUTH_PT_BR,
  });
