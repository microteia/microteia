import type { AICredentials } from '../../../domain/entities/AICredentials';
import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ChatStopReason,
  IAIChatProviderService,
} from '../../../domain/repositories/IAIChatProviderService';
import { usesThinkingLevel } from '../GoogleAIService';
import { readJsonEvents } from './serverSentEvents';
import { ChatMessageBuilder, postForStream, streamError, toolNamesById, usageOf } from './chatHttp';

/**
 * O resultado volta como OBJETO (`functionResponse.response`), não texto. O conteúdo da ferramenta
 * já é JSON na maioria das vezes; quando não é, vai embrulhado — o Gemini recusa um valor solto.
 */
const responseObject = (content: string, isError: boolean): Record<string, unknown> => {
  if (!isError) {
    try {
      const parsed: unknown = JSON.parse(content);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed as Record<string, unknown>;
    } catch {
      /* não é JSON: segue embrulhado */
    }
  }
  return isError ? { error: content } : { content };
};

export const toGeminiContents = (messages: ChatMessage[]): Record<string, unknown>[] => {
  const names = toolNamesById(messages);
  return messages
    .map((message) => ({
      role: message.role === 'assistant' ? 'model' : 'user',
      parts: message.parts.flatMap((part): Record<string, unknown>[] => {
        switch (part.type) {
          case 'text':
            return part.text ? [{ text: part.text }] : [];
          case 'tool_call':
            // A assinatura de pensamento precisa voltar na MESMA parte da chamada: o Gemini 3
            // recusa a continuação de uma chamada de função que perdeu a dela.
            return [{
              functionCall: { name: part.name, args: part.input },
              ...(typeof part.meta?.thoughtSignature === 'string' ? { thoughtSignature: part.meta.thoughtSignature } : {}),
            }];
          case 'tool_result':
            return [{
              functionResponse: {
                name: names.get(part.callId) ?? 'tool',
                response: responseObject(part.content, part.isError),
              },
            }];
          case 'opaque':
            return [];
        }
      }),
    }))
    .filter((content) => content.parts.length > 0);
};

const stopOf = (reason: unknown): ChatStopReason | null => {
  if (typeof reason !== 'string') return null;
  if (reason === 'MAX_TOKENS') return 'max_tokens';
  if (['SAFETY', 'RECITATION', 'BLOCKLIST', 'PROHIBITED_CONTENT', 'SPII'].includes(reason)) return 'refused';
  return 'end';
};

export class GoogleChatService implements IAIChatProviderService {
  canHandle(provider: string): boolean {
    return provider === 'google';
  }

  async *stream(credentials: AICredentials, request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
    const generationConfig: Record<string, unknown> = {
      temperature: credentials.temperature,
      maxOutputTokens: credentials.maxTokens,
    };
    if (usesThinkingLevel(credentials.model)) generationConfig.thinkingConfig = { thinkingLevel: 'low' };

    const body: Record<string, unknown> = {
      systemInstruction: { parts: [{ text: request.system }] },
      contents: toGeminiContents(request.messages),
      generationConfig,
    };
    if (request.tools.length > 0) {
      // `parametersJsonSchema` aceita o JSON Schema como ele é; `parameters` (o subconjunto OpenAPI)
      // recusaria o `additionalProperties` que toda ferramenta do agente declara.
      body.tools = [{
        functionDeclarations: request.tools.map((tool) => ({
          name: tool.name,
          description: tool.description,
          parametersJsonSchema: tool.inputSchema,
        })),
      }];
    }

    // A chave no cabeçalho, e não na query como o `GoogleAIService`: URL vai para log de proxy.
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(credentials.model)}:streamGenerateContent?alt=sse`;
    const stream = await postForStream(url, { 'x-goog-api-key': credentials.apiKey }, body, signal);
    const builder = new ChatMessageBuilder();
    let stop: ChatStopReason = 'end';
    let usage: ReturnType<typeof usageOf> = null;
    let callCount = 0;

    for await (const { json } of readJsonEvents(stream)) {
      if (json.error) throw streamError(json);
      const meta = json.usageMetadata as Record<string, unknown> | undefined;
      if (meta) usage = usageOf(meta.promptTokenCount, meta.candidatesTokenCount);
      const feedback = json.promptFeedback as Record<string, unknown> | undefined;
      if (feedback?.blockReason) stop = 'refused';

      const candidate = (Array.isArray(json.candidates) ? json.candidates[0] : undefined) as Record<string, unknown> | undefined;
      if (!candidate) continue;
      const parts = ((candidate.content as Record<string, unknown> | undefined)?.parts ?? []) as Record<string, unknown>[];
      for (const part of parts) {
        const call = part.functionCall as Record<string, unknown> | undefined;
        if (call && typeof call.name === 'string') {
          callCount += 1;
          const args = call.args && typeof call.args === 'object' ? call.args as Record<string, unknown> : {};
          builder.push({
            type: 'tool_call',
            id: typeof call.id === 'string' && call.id ? call.id : `call_${callCount}`,
            name: call.name,
            input: args,
            ...(typeof part.thoughtSignature === 'string' ? { meta: { thoughtSignature: part.thoughtSignature } } : {}),
          });
        } else if (typeof part.text === 'string' && part.text && part.thought !== true) {
          builder.text(part.text);
          yield { type: 'text', delta: part.text };
        }
      }
      const reason = stopOf(candidate.finishReason);
      if (reason) stop = reason;
    }

    // O Gemini termina com STOP também quando pediu ferramentas: quem diz é a presença da chamada.
    if (stop === 'end' && builder.hasToolCalls()) stop = 'tool_use';
    yield { type: 'done', message: builder.build(), stop, usage };
  }
}
