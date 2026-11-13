import type { PluginRecord } from '../../kernel';
import { capabilityProvider } from '../capabilityExtensionPoints';
import { OpenAIService } from '../../data/services/OpenAIService';
import { AnthropicService } from '../../data/services/AnthropicService';
import { GoogleAIService } from '../../data/services/GoogleAIService';
import { MistralService } from '../../data/services/MistralService';
import { CohereService } from '../../data/services/CohereService';
import { AnthropicChatService } from '../../data/services/chat/AnthropicChatService';
import { MistralChatService, OpenAIChatService } from '../../data/services/chat/OpenAICompatibleChatService';
import { GoogleChatService } from '../../data/services/chat/GoogleChatService';
import { CohereChatService } from '../../data/services/chat/CohereChatService';

const AI_COMPLETION = 'ai.completion';
/**
 * Conversa de vários turnos, com ferramentas e em streaming. É uma capacidade SEPARADA de
 * `ai.completion`, e não um método a mais nela, porque são contratos diferentes: um plugin de
 * terceiro pode completar texto sem saber conversar, e o assistente precisa saber, antes de abrir a
 * conversa, se a conexão do escritório dá conta.
 */
const AI_CHAT = 'ai.chat';
const VERSION = '1.0.0';

export const coreAiPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    OpenAIService: new OpenAIService(),
    AnthropicService: new AnthropicService(),
    GoogleAIService: new GoogleAIService(),
    MistralService: new MistralService(),
    CohereService: new CohereService(),
    OpenAIChatService: new OpenAIChatService(),
    AnthropicChatService: new AnthropicChatService(),
    GoogleChatService: new GoogleChatService(),
    MistralChatService: new MistralChatService(),
    CohereChatService: new CohereChatService(),
  },
  manifest: {
    id: 'core.ai',
    version: '1.1.0',
    kernel: '^2.0.0',
    // eslint-disable-next-line no-restricted-syntax -- metadado do plugin do NÚCLEO: não é renderizado.
    name: 'AI Providers',
    dependencies: { 'core.capabilities': '^1.0.0' },
    provides: [
      { capability: AI_COMPLETION, version: VERSION, label: '@core.marketplace/capability.ai-completion' },
      { capability: AI_CHAT, version: VERSION, label: '@core.marketplace/capability.ai-chat' },
    ],
    contributes: [
      // Nome de PRODUTO é marca: OpenAI, Anthropic e Gemini se escrevem igual em qualquer idioma.
      /* eslint-disable no-restricted-syntax */
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'openai', label: 'OpenAI' }, 'OpenAIService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'anthropic', label: 'Anthropic' }, 'AnthropicService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'google', label: 'Google' }, 'GoogleAIService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'mistral', label: 'Mistral' }, 'MistralService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'cohere', label: 'Cohere' }, 'CohereService'),
      capabilityProvider({ capability: AI_CHAT, version: VERSION, providerKey: 'openai', label: 'OpenAI' }, 'OpenAIChatService'),
      capabilityProvider({ capability: AI_CHAT, version: VERSION, providerKey: 'anthropic', label: 'Anthropic' }, 'AnthropicChatService'),
      capabilityProvider({ capability: AI_CHAT, version: VERSION, providerKey: 'google', label: 'Google' }, 'GoogleChatService'),
      capabilityProvider({ capability: AI_CHAT, version: VERSION, providerKey: 'mistral', label: 'Mistral' }, 'MistralChatService'),
      capabilityProvider({ capability: AI_CHAT, version: VERSION, providerKey: 'cohere', label: 'Cohere' }, 'CohereChatService'),
      /* eslint-enable no-restricted-syntax */
    ],
  },
};
