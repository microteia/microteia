import type { PluginRecord } from '../../kernel';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { coreMessage, CORE_ASSISTANT_MESSAGES } from '../coreMessages';

/**
 * O assistente de IA do workspace. É do NÚCLEO pelo mesmo motivo do acesso de agente: a coleção das
 * conversas é reservada e a conversa usa as ferramentas do agente. O que liga o recurso num
 * escritório é a extensão que reivindica as functions dele — sem ela, nada daqui aparece.
 */
export const coreAssistantPlugin: PluginRecord = {
  trusted: true,
  implementations: {},
  manifest: {
    id: 'core.assistant',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'AI Assistant',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.assistant', CORE_ASSISTANT_MESSAGES)),
    ],
  },
};
