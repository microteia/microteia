import type { AICallOptions, IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

/**
 * Modelos de raciocínio (série o, GPT-5 e GPT-6) recusam `temperature` e gastam o mesmo limite de
 * saída raciocinando. No esforço padrão (`medium`), um limite de 2048 podia acabar antes da resposta.
 */
const REASONING_MODEL = /^(o\d|gpt-[5-9]|gpt-\d{2})/;

export const isOpenAIReasoningModel = (model: string): boolean => REASONING_MODEL.test(model);

export class OpenAIService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'openai';
  }

  async call(credentials: AICredentials, prompt: string, options?: AICallOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) {
      messages.push({ role: 'system', content: options.systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    // `max_completion_tokens` é aceito por todos os modelos do Chat Completions; `max_tokens`, os de
    // raciocínio recusam.
    const body: Record<string, unknown> = {
      model: credentials.model,
      messages,
      max_completion_tokens: credentials.maxTokens,
    };
    if (isOpenAIReasoningModel(credentials.model)) {
      body.reasoning_effort = 'low';
    } else {
      body.temperature = credentials.temperature;
    }

    if (options?.jsonSchema) {
      body.response_format = {
        type: 'json_schema',
        json_schema: {
          name: options.jsonSchema.name,
          strict: true,
          schema: options.jsonSchema.schema,
        },
      };
    } else if (options?.expectJson) {
      body.response_format = { type: 'json_object' };
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
      throw new Error(msg ?? `Erro ${response.status}`);
    }

    const data = await response.json() as { choices: Array<{ message: { content: string } }> };
    return data.choices[0].message.content;
  }
}
