import type { PluginRecord } from '../../kernel';
import { capabilityProvider } from '../capabilityExtensionPoints';
import { OpenAIService } from '../../data/services/OpenAIService';
import { AnthropicService } from '../../data/services/AnthropicService';
import { GoogleAIService } from '../../data/services/GoogleAIService';
import { MistralService } from '../../data/services/MistralService';
import { CohereService } from '../../data/services/CohereService';

const AI_COMPLETION = 'ai.completion';
const VERSION = '1.0.0';

export const coreAiPlugin: PluginRecord = {
  trusted: true,
  implementations: {
    OpenAIService: new OpenAIService(),
    AnthropicService: new AnthropicService(),
    GoogleAIService: new GoogleAIService(),
    MistralService: new MistralService(),
    CohereService: new CohereService(),
  },
  manifest: {
    id: 'core.ai',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Provedores de IA',
    dependencies: { 'core.capabilities': '^1.0.0' },
    provides: [{ capability: AI_COMPLETION, version: VERSION, label: 'Geração de texto por IA' }],
    contributes: [
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'openai', label: 'OpenAI' }, 'OpenAIService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'anthropic', label: 'Anthropic' }, 'AnthropicService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'google', label: 'Google' }, 'GoogleAIService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'mistral', label: 'Mistral' }, 'MistralService'),
      capabilityProvider({ capability: AI_COMPLETION, version: VERSION, providerKey: 'cohere', label: 'Cohere' }, 'CohereService'),
    ],
  },
};
