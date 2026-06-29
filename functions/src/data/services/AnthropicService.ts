import type { IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

export class AnthropicService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'anthropic';
  }

  async call(credentials: AICredentials, prompt: string): Promise<string> {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': credentials.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: credentials.model,
        max_tokens: credentials.maxTokens,
        messages: [{ role: 'user', content: prompt }],
        temperature: credentials.temperature,
      }),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
      throw new Error(msg ?? `Erro ${response.status}`);
    }

    const data = await response.json() as { content: Array<{ text: string }> };
    return data.content[0].text;
  }
}
