import type { PluginRecord } from '../../kernel';
import { authProvider } from '../contributionBuilders';
import { AUTH_EXTENSION_POINTS } from '../../domain/schema/auth';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_AUTH_MESSAGES } from '../coreMessages';
import { coreAuthPtBrContribution } from './messagesPtBr';

/**
 * **A entrada no sistema** — o ponto pelo qual se declara COMO se entra.
 *
 * Ele existe porque a tela de entrada era o último lugar do produto sem ponto de extensão: o
 * formulário de e-mail e senha e o botão do Google estavam escritos nela, e um escritório que
 * precisasse do SSO da própria casa não tinha caminho nenhum a não ser um commit no núcleo.
 *
 * As duas contribuições abaixo são as que já existiam — é a mesma tela, dita como dado. E o fato de
 * `password` ser uma delas é o que importa: uma instalação que exige login único simplesmente não a
 * declara, e o formulário desaparece sem uma linha de configuração.
 *
 * Ele vive no host BASE (`CORE_PLUGINS`), e não no do escritório, porque é chamado antes de haver
 * escritório: na rota `/login` não há tenant, não há configuração e não há permissão — o que se pode
 * ler ali é o que veio carimbado na instalação.
 */
export const coreAuthPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.auth',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Authentication',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the extension point through which every way of signing in is contributed.',
    extensionPoints: AUTH_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.auth', CORE_AUTH_MESSAGES)),
      coreAuthPtBrContribution(),
      authProvider({
        key: 'password',
        label: '@core.auth/provider.password',
        kind: 'password',
        order: 10,
      }),
      authProvider({
        key: 'google',
        label: '@core.auth/provider.google',
        kind: 'google',
        order: 20,
      }),
    ],
  },
};
