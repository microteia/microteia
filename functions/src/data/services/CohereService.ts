import type { AICallOptions, IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

export class CohereService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'cohere';
  }

  async call(credentials: AICredentials, prompt: string, options?: AICallOptions): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (options?.systemPrompt) messages.push({ role: 'system', content: options.systemPrompt });
    messages.push({ role: 'user', content: prompt });

    const body: Record<string, unknown> = {
      model: credentials.model,
      messages,
      temperature: credentials.temperature,
      max_tokens: credentials.maxTokens,
    };
    if (options?.expectJson || options?.jsonSchema) body.response_format = { type: 'json_object' };

    const response = await fetch('https://api.cohere.ai/v2/chat', {
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

    const data = await response.json() as {
      message: { content: Array<{ text: string }> };
    };
    return data.message.content[0].text;
  }
}
