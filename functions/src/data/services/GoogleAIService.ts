import type { AICallOptions, IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

/**
 * Do Gemini 3 em diante o raciocínio vem ligado (até `high` por padrão) e os tokens dele contam no
 * `maxOutputTokens`. Estourando o limite, a resposta volta vazia ou cortada. `low` é o nível que
 * todas as famílias 3 e 4 aceitam.
 */
const THINKING_LEVEL_MODEL = /^gemini-([3-9]|\d{2})/;

export const usesThinkingLevel = (model: string): boolean => THINKING_LEVEL_MODEL.test(model);

export class GoogleAIService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'google';
  }

  async call(credentials: AICredentials, prompt: string, options?: AICallOptions): Promise<string> {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${credentials.model}:generateContent?key=${credentials.apiKey}`;

    const generationConfig: Record<string, unknown> = {
      temperature: credentials.temperature,
      maxOutputTokens: credentials.maxTokens,
    };
    if (options?.expectJson || options?.jsonSchema) {
      generationConfig.responseMimeType = 'application/json';
    }
    if (usesThinkingLevel(credentials.model)) {
      generationConfig.thinkingConfig = { thinkingLevel: 'low' };
    }

    const body: Record<string, unknown> = {
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig,
    };
    if (options?.systemPrompt) {
      body.systemInstruction = { parts: [{ text: options.systemPrompt }] };
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
      throw new Error(msg ?? `Erro ${response.status}`);
    }

    const data = await response.json() as {
      candidates: Array<{ content: { parts: Array<{ text: string }> } }>;
    };
    return data.candidates[0].content.parts[0].text;
  }
}
