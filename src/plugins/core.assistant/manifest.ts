import type { PluginRecord } from '../../kernel';
import { lazyView, surfaceSlot } from '../contributionBuilders';
import { messageBundleContribution } from '../../domain/schema/i18n/extensionPoints';
import { WORKSPACE_SLOT_SURFACES } from '../../domain/schema/ui/uiExtensionPoints';
import { ASSISTANT_USE_PERMISSION } from '../../domain/schema/assistant/assistantConversation';
import { ASSISTANT_CHAT_FUNCTION } from '../../domain/schema/assistant/assistantBackend';
import { coreMessage, CORE_ASSISTANT_MESSAGES } from '../coreMessages';

/**
 * O assistente de IA do workspace. É do NÚCLEO pelo mesmo motivo do acesso de agente: a coleção das
 * conversas é reservada e a conversa usa as ferramentas do agente. O que liga o recurso num
 * escritório é a extensão que reivindica as functions dele — sem ela, nada daqui aparece: o painel
 * declara `requiresFunction`, e o dock só o mostra com a function no ar.
 */
export const coreAssistantPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    AssistantPanelView: lazyView(
      () => import('../../presentation/components/assistant/AssistantPanel/AssistantPanel.view'),
      'AssistantPanelView',
    ),
  },
  manifest: {
    id: 'core.assistant',
    version: '1.0.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'AI Assistant',
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      messageBundleContribution(coreMessage('core.assistant', CORE_ASSISTANT_MESSAGES)),
      surfaceSlot({
        surface: WORKSPACE_SLOT_SURFACES.dockRight,
        key: 'assistant',
        title: '@core.assistant/panel.title',
        icon: 'sparkling',
        order: 10,
        requiredPermissions: [ASSISTANT_USE_PERMISSION],
        requiresFunction: ASSISTANT_CHAT_FUNCTION,
      }, 'AssistantPanelView'),
    ],
  },
};
