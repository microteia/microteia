import type { AICredentials } from '../../../domain/entities/AICredentials';
import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ChatStopReason,
  IAIChatProviderService,
} from '../../../domain/repositories/IAIChatProviderService';
import { acceptsTemperature, reasoningEffortFor, supportsServerFallback } from '../AnthropicService';
import { readJsonEvents } from './serverSentEvents';
import { ChatMessageBuilder, parseToolArguments, postForStream, streamError, usageOf } from './chatHttp';

const PROVIDER = 'anthropic';

const toAnthropicMessages = (messages: ChatMessage[]): Record<string, unknown>[] =>
  messages
    .map((message) => ({
      role: message.role,
      content: message.parts.flatMap((part): Record<string, unknown>[] => {
        switch (part.type) {
          case 'text':
            return part.text ? [{ type: 'text', text: part.text }] : [];
          case 'tool_call':
            return [{ type: 'tool_use', id: part.id, name: part.name, input: part.input }];
          case 'tool_result':
            return [{ type: 'tool_result', tool_use_id: part.callId, content: part.content, is_error: part.isError }];
          case 'opaque':
            return part.provider === PROVIDER ? [part.block] : [];
        }
      }),
    }))
    .filter((message) => message.content.length > 0);

const stopOf = (reason: unknown): ChatStopReason => {
  if (reason === 'tool_use') return 'tool_use';
  if (reason === 'max_tokens') return 'max_tokens';
  if (reason === 'refusal') return 'refused';
  return 'end';
};

interface OpenBlock {
  type: string;
  id?: string;
  name?: string;
  json: string;
  thinking: string;
  signature: string;
  data?: string;
}

export class AnthropicChatService implements IAIChatProviderService {
  canHandle(provider: string): boolean {
    return provider === PROVIDER;
  }

  async *stream(credentials: AICredentials, request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
    const body: Record<string, unknown> = {
      model: credentials.model,
      max_tokens: credentials.maxTokens,
      stream: true,
      system: request.system,
      messages: toAnthropicMessages(request.messages),
      // O laço de ferramentas reenvia a conversa inteira a cada passo: o cache automático faz os
      // passos seguintes pagarem só o que é novo.
      cache_control: { type: 'ephemeral' },
    };
    if (request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.inputSchema,
      }));
    }
    if (acceptsTemperature(credentials.model)) body.temperature = credentials.temperature;
    const effort = reasoningEffortFor(credentials.model);
    if (effort) body.output_config = { effort };

    const headers: Record<string, string> = {
      'x-api-key': credentials.apiKey,
      'anthropic-version': '2023-06-01',
    };
    if (supportsServerFallback(credentials.model)) {
      headers['anthropic-beta'] = 'server-side-fallback-2026-07-01';
      body.fallbacks = 'default';
    }

    const stream = await postForStream('https://api.anthropic.com/v1/messages', headers, body, signal);
    const builder = new ChatMessageBuilder();
    const blocks = new Map<number, OpenBlock>();
    let stop: ChatStopReason = 'end';
    let inputTokens: number | null = null;
    let outputTokens: number | null = null;

    for await (const { json } of readJsonEvents(stream)) {
      switch (json.type) {
        case 'message_start': {
          const usage = ((json.message as Record<string, unknown> | undefined)?.usage ?? {}) as Record<string, unknown>;
          const count = (key: string): number => (typeof usage[key] === 'number' ? usage[key] as number : 0);
          inputTokens = count('input_tokens') + count('cache_read_input_tokens') + count('cache_creation_input_tokens');
          if (typeof usage.output_tokens === 'number') outputTokens = usage.output_tokens;
          break;
        }
        case 'content_block_start': {
          const block = (json.content_block ?? {}) as Record<string, unknown>;
          blocks.set(Number(json.index), {
            type: String(block.type),
            id: typeof block.id === 'string' ? block.id : undefined,
            name: typeof block.name === 'string' ? block.name : undefined,
            json: '',
            thinking: typeof block.thinking === 'string' ? block.thinking : '',
            signature: typeof block.signature === 'string' ? block.signature : '',
            data: typeof block.data === 'string' ? block.data : undefined,
          });
          break;
        }
        case 'content_block_delta': {
          const open = blocks.get(Number(json.index));
          const delta = (json.delta ?? {}) as Record<string, unknown>;
          if (delta.type === 'text_delta' && typeof delta.text === 'string') {
            builder.text(delta.text);
            yield { type: 'text', delta: delta.text };
          } else if (open && delta.type === 'input_json_delta' && typeof delta.partial_json === 'string') {
            open.json += delta.partial_json;
          } else if (open && delta.type === 'thinking_delta' && typeof delta.thinking === 'string') {
            open.thinking += delta.thinking;
          } else if (open && delta.type === 'signature_delta' && typeof delta.signature === 'string') {
            open.signature += delta.signature;
          }
          break;
        }
        case 'content_block_stop': {
          const index = Number(json.index);
          const open = blocks.get(index);
          blocks.delete(index);
          if (!open) break;
          if (open.type === 'tool_use' && open.id && open.name) {
            builder.push({ type: 'tool_call', id: open.id, name: open.name, input: parseToolArguments(open.json) });
          } else if (open.type === 'thinking') {
            builder.push({
              type: 'opaque',
              provider: PROVIDER,
              block: { type: 'thinking', thinking: open.thinking, signature: open.signature },
            });
          } else if (open.type === 'redacted_thinking' && open.data) {
            builder.push({ type: 'opaque', provider: PROVIDER, block: { type: 'redacted_thinking', data: open.data } });
          }
          break;
        }
        case 'message_delta': {
          const delta = (json.delta ?? {}) as Record<string, unknown>;
          if (delta.stop_reason) stop = stopOf(delta.stop_reason);
          const usage = (json.usage ?? {}) as Record<string, unknown>;
          if (typeof usage.output_tokens === 'number') outputTokens = usage.output_tokens;
          break;
        }
        case 'error':
          throw streamError(json);
      }
    }

    // Recusa pode cortar um `tool_use` no meio: nenhuma ferramenta daquela volta deve rodar.
    if (stop === 'tool_use' && !builder.hasToolCalls()) stop = 'end';
    yield { type: 'done', message: builder.build(), stop, usage: usageOf(inputTokens, outputTokens) };
  }
}
