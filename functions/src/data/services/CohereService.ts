import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

export class CohereService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'cohere';
  }

  async call(credentials: AICredentials, prompt: string): Promise<string> {
    const response = await fetch('https://api.cohere.ai/v2/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${credentials.apiKey}`,
      },
      body: JSON.stringify({
        model: credentials.model,
        messages: [{ role: 'user', content: prompt }],
        temperature: credentials.temperature,
        max_tokens: credentials.maxTokens,
      }),
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
