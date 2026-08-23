import type { PluginRecord } from '../../kernel';
import {
  ACCESS_EXTENSION_POINTS,
  KERNEL_PERMISSIONS,
  KERNEL_PERMISSION_RESOURCES,
  accessPermissionContribution,
  accessResourceContribution,
} from '../../domain/schema/access';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_ACCESS_MESSAGES } from '../coreMessages';

/**
 * **O controle de acesso** — o ponto pelo qual todo o produto diz o que se pode fazer nele.
 *
 * Ele não conhece nenhum perfil, e é essa a inversão que o justifica: perfil é dado do escritório,
 * gravado em `tenants/{id}/roles`, e o núcleo nunca precisa saber quantos existem nem como se
 * chamam. O que o núcleo declara é a CAPACIDADE — "gerenciar telas", "executar automação" —, e a
 * aplicação inteira pergunta por ela, nunca por quem a tem.
 *
 * Ele também não traz Role nenhuma pronta. Um perfil semeado por nós seria vocabulário nosso dentro
 * do escritório, exatamente o que "Advogado" e "Secretária" eram quando moravam no tipo `TenantRole`.
 */
export const coreAccessPlugin: PluginRecord = {
  trusted: true,
  manifest: {
    id: 'core.access',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'Access Control',
    description:
      // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
      'Declares the permission catalog and the extension point through which every plugin contributes its own.',
    extensionPoints: ACCESS_EXTENSION_POINTS,
    contributes: [
      messageBundleContribution(coreMessage('core.access', CORE_ACCESS_MESSAGES)),
      ...KERNEL_PERMISSION_RESOURCES.map((resource) => accessResourceContribution(resource)),
      ...KERNEL_PERMISSIONS.map((permission) => accessPermissionContribution(permission)),
    ],
  },
};
