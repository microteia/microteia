import type { AICredentials } from '../../../domain/entities/AICredentials';
import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ChatStopReason,
  IAIChatProviderService,
} from '../../../domain/repositories/IAIChatProviderService';
import { readJsonEvents } from './serverSentEvents';
import { ChatMessageBuilder, parseToolArguments, postForStream, streamError, textOf, usageOf } from './chatHttp';

export const toCohereMessages = (system: string, messages: ChatMessage[]): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }];
  for (const message of messages) {
    if (message.role === 'user') {
      for (const part of message.parts) {
        if (part.type === 'tool_result') out.push({ role: 'tool', tool_call_id: part.callId, content: part.content });
      }
      const text = textOf(message.parts);
      if (text) out.push({ role: 'user', content: text });
      continue;
    }
    const calls = message.parts.flatMap((part) =>
      part.type === 'tool_call'
        ? [{ id: part.id, type: 'function', function: { name: part.name, arguments: JSON.stringify(part.input) } }]
        : [],
    );
    const text = textOf(message.parts);
    if (calls.length > 0) {
      // Na v2, o texto que acompanha uma chamada é o `tool_plan`; `content` junto com `tool_calls` é recusado.
      out.push({ role: 'assistant', tool_calls: calls, ...(text ? { tool_plan: text } : {}) });
    } else if (text) {
      out.push({ role: 'assistant', content: text });
    }
  }
  return out;
};

const stopOf = (reason: unknown): ChatStopReason => {
  if (reason === 'TOOL_CALL') return 'tool_use';
  if (reason === 'MAX_TOKENS') return 'max_tokens';
  return 'end';
};

interface PendingCall {
  id: string;
  name: string;
  args: string;
}

const messageDelta = (json: Record<string, unknown>): Record<string, unknown> =>
  (((json.delta ?? {}) as Record<string, unknown>).message ?? {}) as Record<string, unknown>;

export class CohereChatService implements IAIChatProviderService {
  canHandle(provider: string): boolean {
    return provider === 'cohere';
  }

  async *stream(credentials: AICredentials, request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
    const body: Record<string, unknown> = {
      model: credentials.model,
      stream: true,
      messages: toCohereMessages(request.system, request.messages),
      temperature: credentials.temperature,
      max_tokens: credentials.maxTokens,
    };
    if (request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
      }));
    }

    const stream = await postForStream('https://api.cohere.ai/v2/chat', { Authorization: `Bearer ${credentials.apiKey}` }, body, signal);
    const builder = new ChatMessageBuilder();
    const calls = new Map<number, PendingCall>();
    let stop: ChatStopReason = 'end';
    let usage: ReturnType<typeof usageOf> = null;

    for await (const { json } of readJsonEvents(stream)) {
      const index = typeof json.index === 'number' ? json.index : 0;
      switch (json.type) {
        case 'content-delta': {
          const content = (messageDelta(json).content ?? {}) as Record<string, unknown>;
          if (typeof content.text === 'string' && content.text) {
            builder.text(content.text);
            yield { type: 'text', delta: content.text };
          }
          break;
        }
        case 'tool-call-start': {
          const call = (messageDelta(json).tool_calls ?? {}) as Record<string, unknown>;
          const fn = (call.function ?? {}) as Record<string, unknown>;
          calls.set(index, {
            id: typeof call.id === 'string' ? call.id : `call_${index}`,
            name: typeof fn.name === 'string' ? fn.name : '',
            args: typeof fn.arguments === 'string' ? fn.arguments : '',
          });
          break;
        }
        case 'tool-call-delta': {
          const call = (messageDelta(json).tool_calls ?? {}) as Record<string, unknown>;
          const fn = (call.function ?? {}) as Record<string, unknown>;
          const pending = calls.get(index);
          if (pending && typeof fn.arguments === 'string') pending.args += fn.arguments;
          break;
        }
        case 'message-end': {
          const delta = (json.delta ?? {}) as Record<string, unknown>;
          stop = stopOf(delta.finish_reason);
          if (delta.finish_reason === 'ERROR') throw streamError({ message: String(delta.error ?? 'ERROR') });
          const rawUsage = (delta.usage ?? {}) as Record<string, unknown>;
          const tokens = (rawUsage.tokens ?? rawUsage.billed_units ?? {}) as Record<string, unknown>;
          usage = usageOf(tokens.input_tokens, tokens.output_tokens);
          break;
        }
        default:
          if (json.type === undefined && (json.message || json.error)) throw streamError(json);
      }
    }

    for (const [, call] of [...calls.entries()].sort(([a], [b]) => a - b)) {
      if (call.name) builder.push({ type: 'tool_call', id: call.id, name: call.name, input: parseToolArguments(call.args) });
    }
    if (stop === 'tool_use' && !builder.hasToolCalls()) stop = 'end';
    if (stop === 'end' && builder.hasToolCalls()) stop = 'tool_use';
    yield { type: 'done', message: builder.build(), stop, usage };
  }
}
