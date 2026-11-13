import type { AICallOptions, IAIProviderService } from '../../domain/repositories/IAIProviderService';
import type { AICredentials } from '../../domain/entities/AICredentials';

/**
 * Só as famílias anteriores ao Opus 4.7 aceitam `temperature`: do Opus 4.7 em diante (e em toda a
 * linha 5) o parâmetro é RECUSADO com 400, não ignorado. Por isso a lista é de quem aceita — um
 * modelo novo que ninguém conferiu cai no lado que não quebra.
 */
const LEGACY_SAMPLING_MODEL = /^claude-(3[-.]|haiku-4-5|(opus|sonnet)-4-[0-6](\D|$)|(opus|sonnet)-4-\d{8})/;

export const acceptsTemperature = (model: string): boolean => LEGACY_SAMPLING_MODEL.test(model);

/**
 * Os modelos posteriores raciocinam por padrão, e o raciocínio sai do MESMO `max_tokens` que o
 * escritório configurou na conexão (2048 por padrão). No esforço padrão, ele podia consumir o
 * orçamento e o JSON chegava cortado. Classificar e extrair são as tarefas para as quais o
 * esforço baixo foi feito.
 */
export const reasoningEffortFor = (model: string): 'low' | undefined =>
  acceptsTemperature(model) ? undefined : 'low';

/**
 * Nestes, uma recusa dos classificadores de segurança volta como HTTP 200 sem texto, e ela some na
 * mensagem genérica de formato inválido. Documento jurídico sobre crime é um falso positivo
 * plausível, e o fallback do servidor responde com outro modelo na mesma chamada.
 */
const SERVER_FALLBACK_MODEL = /^claude-(fable-5-[12]|opus-5(-5)?|sonnet-5-5)$/;

export const supportsServerFallback = (model: string): boolean => SERVER_FALLBACK_MODEL.test(model);

interface AnthropicResponse {
  content?: Array<{ type: string; text?: string }>;
}

export class AnthropicService implements IAIProviderService {
  canHandle(provider: string): boolean {
    return provider === 'anthropic';
  }

  async call(credentials: AICredentials, prompt: string, options?: AICallOptions): Promise<string> {
    const body: Record<string, unknown> = {
      model: credentials.model,
      max_tokens: credentials.maxTokens,
      messages: [{ role: 'user', content: prompt }],
    };
    // Sem o `system`, a detecção de automação chegava ao Claude sem a instrução "responda só com
    // JSON" — ele respondia em prosa e o parse falhava, enquanto a OpenAI (que recebia) funcionava.
    if (options?.systemPrompt) body.system = options.systemPrompt;
    if (acceptsTemperature(credentials.model)) body.temperature = credentials.temperature;
    const effort = reasoningEffortFor(credentials.model);
    if (effort) body.output_config = { effort };

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'x-api-key': credentials.apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (supportsServerFallback(credentials.model)) {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({})) as Record<string, unknown>;
      const msg = (err?.error as Record<string, unknown>)?.message as string | undefined;
      throw new Error(msg ?? `Erro ${response.status}`);
    }

    // O primeiro bloco nem sempre é texto: modelos com raciocínio devolvem `thinking` antes.
    const data = await response.json() as AnthropicResponse;
    return (data.content ?? [])
      .filter((block) => block.type === 'text' && typeof block.text === 'string')
      .map((block) => block.text)
      .join('');
  }
}
