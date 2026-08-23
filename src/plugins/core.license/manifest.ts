import type { PluginRecord } from '../../kernel';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_LICENSE_MESSAGES } from '../coreMessages';

/**
 * O dono dos Termos de Uso e da Política de Privacidade — e nada mais.
 *
 * Ele existe para que o documento jurídico tenha NAMESPACE PRÓPRIO. Como `namespace` é o id do
 * plugin dono do texto, separar o contrato do resto da interface exigia um dono separado; a
 * alternativa seria quebrar essa regra e deixar um namespace órfão.
 *
 * O ganho é para quem traduz: um pacote de idioma do sistema cobre `core.ui`, `core.admin` e os
 * demais sem arrastar páginas de texto legal, e traduzir o contrato vira um pacote à parte —
 * opcional, revisável por outra pessoa e publicável em outro ritmo.
 *
 * Ele não contribui tela: `/license` é rota pública em `App.tsx`, fora do workspace, porque precisa
 * ser lida por quem ainda não entrou. O que ele contribui é o texto.
 */
export const coreLicensePlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.license',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Terms and Privacy',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    description: 'Owns the text of the Terms of Use and the Privacy Policy, in its own namespace.',
    dependencies: { 'core.i18n': '^1.0.0' },
    contributes: [messageBundleContribution(coreMessage('core.license', CORE_LICENSE_MESSAGES))],
  },
};
