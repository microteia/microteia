import type { AICredentials } from '../../../domain/entities/AICredentials';
import type {
  ChatEvent,
  ChatMessage,
  ChatRequest,
  ChatStopReason,
  IAIChatProviderService,
} from '../../../domain/repositories/IAIChatProviderService';
import { isOpenAIReasoningModel } from '../OpenAIService';
import { readJsonEvents } from './serverSentEvents';
import { ChatMessageBuilder, parseToolArguments, postForStream, streamError, textOf, usageOf } from './chatHttp';

/**
 * O formato do Chat Completions, que a OpenAI e a Mistral falam igual. Uma classe para os dois porque
 * a diferença cabe em três campos — e, mantidos separados, um conserto num deles não chegaria ao outro.
 */
interface CompatibleDialect {
  provider: string;
  url: string;
  /** Campos do corpo que dependem do provedor e do modelo (amostragem, limite, esforço, uso). */
  tune(body: Record<string, unknown>, credentials: AICredentials): void;
}

export const toChatCompletionsMessages = (system: string, messages: ChatMessage[]): Record<string, unknown>[] => {
  const out: Record<string, unknown>[] = [{ role: 'system', content: system }];
  for (const message of messages) {
    if (message.role === 'user') {
      // Os resultados de ferramenta viram mensagens `tool` próprias, uma por chamada, ANTES de
      // qualquer texto do usuário — o Chat Completions exige que respondam ao assistente anterior.
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
    if (!text && calls.length === 0) continue;
    out.push({ role: 'assistant', content: text || null, ...(calls.length > 0 ? { tool_calls: calls } : {}) });
  }
  return out;
};

const stopOf = (reason: unknown): ChatStopReason => {
  if (reason === 'tool_calls') return 'tool_use';
  if (reason === 'length' || reason === 'model_length') return 'max_tokens';
  if (reason === 'content_filter') return 'refused';
  return 'end';
};

interface PendingCall {
  id: string;
  name: string;
  args: string;
}

class OpenAICompatibleChatService implements IAIChatProviderService {
  constructor(private readonly dialect: CompatibleDialect) {}

  canHandle(provider: string): boolean {
    return provider === this.dialect.provider;
  }

  async *stream(credentials: AICredentials, request: ChatRequest, signal: AbortSignal): AsyncIterable<ChatEvent> {
    const body: Record<string, unknown> = {
      model: credentials.model,
      stream: true,
      messages: toChatCompletionsMessages(request.system, request.messages),
    };
    if (request.tools.length > 0) {
      body.tools = request.tools.map((tool) => ({
        type: 'function',
        function: { name: tool.name, description: tool.description, parameters: tool.inputSchema },
      }));
    }
    this.dialect.tune(body, credentials);

    const stream = await postForStream(this.dialect.url, { Authorization: `Bearer ${credentials.apiKey}` }, body, signal);
    const builder = new ChatMessageBuilder();
    // Por `index`: os pedaços de uma mesma chamada só trazem o id no primeiro. A Mistral às vezes
    // manda a chamada inteira sem `index` — aí cada uma é nova.
    const calls = new Map<number, PendingCall>();
    let stop: ChatStopReason = 'end';
    let usage: ReturnType<typeof usageOf> = null;

    for await (const { json } of readJsonEvents(stream)) {
      if (json.error) throw streamError(json);
      const rawUsage = json.usage as Record<string, unknown> | undefined;
      if (rawUsage) usage = usageOf(rawUsage.prompt_tokens, rawUsage.completion_tokens);

      const choice = (Array.isArray(json.choices) ? json.choices[0] : undefined) as Record<string, unknown> | undefined;
      if (!choice) continue;
      const delta = (choice.delta ?? {}) as Record<string, unknown>;
      if (typeof delta.content === 'string' && delta.content) {
        builder.text(delta.content);
        yield { type: 'text', delta: delta.content };
      }
      if (Array.isArray(delta.tool_calls)) {
        for (const raw of delta.tool_calls as Record<string, unknown>[]) {
          const index = typeof raw.index === 'number' ? raw.index : calls.size;
          const fn = (raw.function ?? {}) as Record<string, unknown>;
          const pending = calls.get(index) ?? { id: '', name: '', args: '' };
          if (typeof raw.id === 'string' && raw.id) pending.id = raw.id;
          if (typeof fn.name === 'string' && fn.name) pending.name = fn.name;
          if (typeof fn.arguments === 'string') pending.args += fn.arguments;
          else if (fn.arguments && typeof fn.arguments === 'object') pending.args = JSON.stringify(fn.arguments);
          calls.set(index, pending);
        }
      }
      if (choice.finish_reason) stop = stopOf(choice.finish_reason);
    }

    for (const [index, call] of [...calls.entries()].sort(([a], [b]) => a - b)) {
      if (!call.name) continue;
      builder.push({ type: 'tool_call', id: call.id || `call_${index}`, name: call.name, input: parseToolArguments(call.args) });
    }
    if (stop === 'tool_use' && !builder.hasToolCalls()) stop = 'end';
    if (stop === 'end' && builder.hasToolCalls()) stop = 'tool_use';
    yield { type: 'done', message: builder.build(), stop, usage };
  }
}

export class OpenAIChatService extends OpenAICompatibleChatService {
  constructor() {
    super({
      provider: 'openai',
      url: 'https://api.openai.com/v1/chat/completions',
      tune: (body, credentials) => {
        body.max_completion_tokens = credentials.maxTokens;
        body.stream_options = { include_usage: true };
        if (isOpenAIReasoningModel(credentials.model)) body.reasoning_effort = 'low';
        else body.temperature = credentials.temperature;
      },
    });
  }
}

export class MistralChatService extends OpenAICompatibleChatService {
  constructor() {
    super({
      provider: 'mistral',
      url: 'https://api.mistral.ai/v1/chat/completions',
      // A Mistral devolve o uso no último pedaço por conta própria e recusa `stream_options`.
      tune: (body, credentials) => {
        body.max_tokens = credentials.maxTokens;
        body.temperature = credentials.temperature;
      },
    });
  }
}
