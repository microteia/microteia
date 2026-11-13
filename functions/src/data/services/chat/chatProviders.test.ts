import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AICredentials } from '../../../domain/entities/AICredentials';
import type { Provider } from '../../../domain/entities/Provider';
import type { ChatEvent, ChatRequest, IAIChatProviderService } from '../../../domain/repositories/IAIChatProviderService';
import { AnthropicChatService } from './AnthropicChatService';
import { MistralChatService, OpenAIChatService } from './OpenAICompatibleChatService';
import { GoogleChatService } from './GoogleChatService';
import { CohereChatService } from './CohereChatService';
import { ChatProviderError } from './chatHttp';
import { readServerSentEvents } from './serverSentEvents';

const credentials = (provider: Provider, model: string): AICredentials => ({
  provider,
  apiKey: 'test-key',
  model,
  temperature: 0.5,
  maxTokens: 1024,
});

/** Corta o corpo em pedaços de 7 bytes: o parser precisa juntar linhas partidas no meio. */
const chunked = (text: string): ReadableStream<Uint8Array> => {
  const bytes = new TextEncoder().encode(text);
  let offset = 0;
  return new ReadableStream({
    pull(controller) {
      if (offset >= bytes.length) {
        controller.close();
        return;
      }
      controller.enqueue(bytes.slice(offset, offset + 7));
      offset += 7;
    },
  });
};

const sse = (events: Array<Record<string, unknown> | string>, named = false): string =>
  events
    .map((event) => {
      if (typeof event === 'string') return `data: ${event}\n\n`;
      const prefix = named ? `event: ${String(event.type)}\n` : '';
      return `${prefix}data: ${JSON.stringify(event)}\n\n`;
    })
    .join('');

const stubStream = (body: string, status = 200) => {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      headers: init.headers as Record<string, string>,
    });
    return status === 200
      ? new Response(chunked(body), { status })
      : new Response(body, { status, headers: { 'Content-Type': 'application/json' } });
  });
  return calls;
};

const collect = async (service: IAIChatProviderService, creds: AICredentials, request: ChatRequest) => {
  const events: ChatEvent[] = [];
  for await (const event of service.stream(creds, request, new AbortController().signal)) events.push(event);
  const done = events.find((event): event is Extract<ChatEvent, { type: 'done' }> => event.type === 'done');
  const text = events.flatMap((event) => (event.type === 'text' ? [event.delta] : [])).join('');
  return { events, done: done!, text };
};

const tool = { name: 'search_records', description: 'Search', inputSchema: { type: 'object', additionalProperties: false } };

const request: ChatRequest = {
  system: 'You are helpful.',
  tools: [tool],
  messages: [
    { role: 'user', parts: [{ type: 'text', text: 'How many?' }] },
    {
      role: 'assistant',
      parts: [
        { type: 'opaque', provider: 'anthropic', block: { type: 'thinking', thinking: '', signature: 'sig' } },
        { type: 'text', text: 'Searching.' },
        { type: 'tool_call', id: 'c1', name: 'search_records', input: { collection: 'x' }, meta: { thoughtSignature: 'ts' } },
      ],
    },
    { role: 'user', parts: [{ type: 'tool_result', callId: 'c1', content: '{"total":3}', isError: false }] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('readServerSentEvents', () => {
  it('junta linhas data consecutivas, ignora comentário e emite o último evento sem linha em branco final', async () => {
    const out = [];
    for await (const event of readServerSentEvents(chunked(': ping\nevent: a\ndata: 1\ndata: 2\n\ndata: fim'))) out.push(event);
    expect(out).toEqual([{ event: 'a', data: '1\n2' }, { event: null, data: 'fim' }]);
  });
});

describe('AnthropicChatService', () => {
  const body = sse([
    { type: 'message_start', message: { usage: { input_tokens: 10, cache_read_input_tokens: 90, output_tokens: 1 } } },
    { type: 'content_block_start', index: 0, content_block: { type: 'thinking', thinking: '' } },
    { type: 'content_block_delta', index: 0, delta: { type: 'signature_delta', signature: 'abc' } },
    { type: 'content_block_stop', index: 0 },
    { type: 'content_block_start', index: 1, content_block: { type: 'text', text: '' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'Vou ' } },
    { type: 'content_block_delta', index: 1, delta: { type: 'text_delta', text: 'buscar.' } },
    { type: 'content_block_stop', index: 1 },
    { type: 'content_block_start', index: 2, content_block: { type: 'tool_use', id: 't1', name: 'search_records', input: {} } },
    { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: '{"collec' } },
    { type: 'content_block_delta', index: 2, delta: { type: 'input_json_delta', partial_json: 'tion":"a"}' } },
    { type: 'content_block_stop', index: 2 },
    { type: 'message_delta', delta: { stop_reason: 'tool_use' }, usage: { output_tokens: 42 } },
    { type: 'message_stop' },
  ], true);

  it('emite o texto em pedaços e monta a mensagem na ordem, com o raciocínio assinado antes da ferramenta', async () => {
    stubStream(body);
    const { done, text } = await collect(new AnthropicChatService(), credentials('anthropic', 'claude-opus-5-5'), request);
    expect(text).toBe('Vou buscar.');
    expect(done.stop).toBe('tool_use');
    expect(done.usage).toEqual({ inputTokens: 100, outputTokens: 42 });
    expect(done.message.parts).toEqual([
      { type: 'opaque', provider: 'anthropic', block: { type: 'thinking', thinking: '', signature: 'abc' } },
      { type: 'text', text: 'Vou buscar.' },
      { type: 'tool_call', id: 't1', name: 'search_records', input: { collection: 'a' } },
    ]);
  });

  it('traduz a conversa: raciocínio de volta intacto, tool_result do usuário e cache automático', async () => {
    const calls = stubStream(body);
    await collect(new AnthropicChatService(), credentials('anthropic', 'claude-opus-5-5'), request);
    const sent = calls[0].body;
    expect(sent.stream).toBe(true);
    expect(sent.cache_control).toEqual({ type: 'ephemeral' });
    expect(sent.tools).toEqual([{ name: 'search_records', description: 'Search', input_schema: tool.inputSchema }]);
    expect(sent.messages).toEqual([
      { role: 'user', content: [{ type: 'text', text: 'How many?' }] },
      {
        role: 'assistant',
        content: [
          { type: 'thinking', thinking: '', signature: 'sig' },
          { type: 'text', text: 'Searching.' },
          { type: 'tool_use', id: 'c1', name: 'search_records', input: { collection: 'x' } },
        ],
      },
      { role: 'user', content: [{ type: 'tool_result', tool_use_id: 'c1', content: '{"total":3}', is_error: false }] },
    ]);
  });

  it('descarta bloco opaco de outro provedor', async () => {
    const calls = stubStream(body);
    await collect(new AnthropicChatService(), credentials('anthropic', 'claude-opus-5-5'), {
      ...request,
      messages: [{ role: 'assistant', parts: [{ type: 'opaque', provider: 'google', block: { x: 1 } }, { type: 'text', text: 'oi' }] }],
    });
    expect(calls[0].body.messages).toEqual([{ role: 'assistant', content: [{ type: 'text', text: 'oi' }] }]);
  });

  it('recusa no meio de uma ferramenta não deixa ferramenta rodar', async () => {
    stubStream(sse([
      { type: 'content_block_start', index: 0, content_block: { type: 'tool_use', id: 't1', name: 'x', input: {} } },
      { type: 'content_block_delta', index: 0, delta: { type: 'input_json_delta', partial_json: '{"a":' } },
      { type: 'message_delta', delta: { stop_reason: 'refusal' } },
    ]));
    const { done } = await collect(new AnthropicChatService(), credentials('anthropic', 'claude-opus-5-5'), request);
    expect(done.stop).toBe('refused');
    expect(done.message.parts).toEqual([]);
  });

  it('erro dentro do stream vira ChatProviderError com a mensagem do provedor', async () => {
    stubStream(sse([{ type: 'error', error: { type: 'overloaded_error', message: 'Overloaded' } }]));
    await expect(collect(new AnthropicChatService(), credentials('anthropic', 'claude-opus-5-5'), request))
      .rejects.toThrow(new ChatProviderError(200, 'Overloaded'));
  });

  it('erro HTTP antes do stream preserva o status e a mensagem', async () => {
    stubStream(JSON.stringify({ error: { message: 'invalid x-api-key' } }), 401);
    const failure = collect(new AnthropicChatService(), credentials('anthropic', 'claude-opus-5-5'), request);
    await expect(failure).rejects.toMatchObject({ status: 401, detail: 'invalid x-api-key' });
  });
});

describe('OpenAIChatService', () => {
  const body = sse([
    { choices: [{ delta: { role: 'assistant', content: 'Um ' } }] },
    { choices: [{ delta: { content: 'momento.' } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, id: 'call_a', function: { name: 'search_records', arguments: '{"col' } }] } }] },
    { choices: [{ delta: { tool_calls: [{ index: 0, function: { arguments: 'lection":"b"}' } }] } }] },
    { choices: [{ delta: {}, finish_reason: 'tool_calls' }] },
    { choices: [], usage: { prompt_tokens: 50, completion_tokens: 7 } },
    '[DONE]',
  ]);

  it('acumula a chamada por index e lê o uso do último pedaço', async () => {
    const calls = stubStream(body);
    const { done, text } = await collect(new OpenAIChatService(), credentials('openai', 'gpt-5.5'), request);
    expect(text).toBe('Um momento.');
    expect(done.stop).toBe('tool_use');
    expect(done.usage).toEqual({ inputTokens: 50, outputTokens: 7 });
    expect(done.message.parts).toEqual([
      { type: 'text', text: 'Um momento.' },
      { type: 'tool_call', id: 'call_a', name: 'search_records', input: { collection: 'b' } },
    ]);
    expect(calls[0].body.stream_options).toEqual({ include_usage: true });
    expect(calls[0].body.reasoning_effort).toBe('low');
  });

  it('traduz para mensagens system/assistant(tool_calls)/tool, sem bloco opaco', async () => {
    const calls = stubStream(body);
    await collect(new OpenAIChatService(), credentials('openai', 'gpt-4.1'), request);
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'How many?' },
      {
        role: 'assistant',
        content: 'Searching.',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_records', arguments: '{"collection":"x"}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', content: '{"total":3}' },
    ]);
    expect(calls[0].body.tools).toEqual([
      { type: 'function', function: { name: 'search_records', description: 'Search', parameters: tool.inputSchema } },
    ]);
    expect(calls[0].body.temperature).toBe(0.5);
  });

  it('length vira max_tokens', async () => {
    stubStream(sse([{ choices: [{ delta: { content: 'abc' }, finish_reason: 'length' }] }, '[DONE]']));
    const { done } = await collect(new OpenAIChatService(), credentials('openai', 'gpt-4.1'), request);
    expect(done.stop).toBe('max_tokens');
  });
});

describe('MistralChatService', () => {
  it('aceita a chamada inteira sem index, não manda stream_options e usa max_tokens', async () => {
    const calls = stubStream(sse([
      { choices: [{ delta: { tool_calls: [{ id: 'm1', function: { name: 'search_records', arguments: '{"q":1}' } }] }, finish_reason: 'tool_calls' }], usage: { prompt_tokens: 5, completion_tokens: 2 } },
      '[DONE]',
    ]));
    const { done } = await collect(new MistralChatService(), credentials('mistral', 'mistral-large-latest'), request);
    expect(done.message.parts).toEqual([{ type: 'tool_call', id: 'm1', name: 'search_records', input: { q: 1 } }]);
    expect(done.usage).toEqual({ inputTokens: 5, outputTokens: 2 });
    expect(calls[0].url).toBe('https://api.mistral.ai/v1/chat/completions');
    expect(calls[0].body).not.toHaveProperty('stream_options');
    expect(calls[0].body.max_tokens).toBe(1024);
  });
});

describe('GoogleChatService', () => {
  const body = sse([
    { candidates: [{ content: { role: 'model', parts: [{ text: 'pensando', thought: true }, { text: 'Olá, ' }] } }] },
    { candidates: [{ content: { role: 'model', parts: [{ text: 'vou buscar.' }] } }] },
    {
      candidates: [{
        content: { role: 'model', parts: [{ functionCall: { name: 'search_records', args: { collection: 'c' } }, thoughtSignature: 'sig-1' }] },
        finishReason: 'STOP',
      }],
      usageMetadata: { promptTokenCount: 30, candidatesTokenCount: 9 },
    },
  ]);

  it('pula o texto de pensamento, sintetiza o id e guarda a assinatura na chamada', async () => {
    const calls = stubStream(body);
    const { done, text } = await collect(new GoogleChatService(), credentials('google', 'gemini-3-pro'), request);
    expect(text).toBe('Olá, vou buscar.');
    expect(done.stop).toBe('tool_use');
    expect(done.usage).toEqual({ inputTokens: 30, outputTokens: 9 });
    expect(done.message.parts).toEqual([
      { type: 'text', text: 'Olá, vou buscar.' },
      { type: 'tool_call', id: 'call_1', name: 'search_records', input: { collection: 'c' }, meta: { thoughtSignature: 'sig-1' } },
    ]);
    expect(calls[0].url).toContain(':streamGenerateContent?alt=sse');
    expect(calls[0].url).not.toContain('test-key');
    expect(calls[0].headers['x-goog-api-key']).toBe('test-key');
  });

  it('devolve a assinatura na mesma parte e o resultado como objeto com o nome da ferramenta', async () => {
    const calls = stubStream(body);
    await collect(new GoogleChatService(), credentials('google', 'gemini-3-pro'), request);
    expect(calls[0].body.contents).toEqual([
      { role: 'user', parts: [{ text: 'How many?' }] },
      {
        role: 'model',
        parts: [
          { text: 'Searching.' },
          { functionCall: { name: 'search_records', args: { collection: 'x' } }, thoughtSignature: 'ts' },
        ],
      },
      { role: 'user', parts: [{ functionResponse: { name: 'search_records', response: { total: 3 } } }] },
    ]);
    expect(calls[0].body.tools).toEqual([
      { functionDeclarations: [{ name: 'search_records', description: 'Search', parametersJsonSchema: tool.inputSchema }] },
    ]);
  });

  it('bloqueio por segurança vira recusa', async () => {
    stubStream(sse([{ candidates: [{ content: { parts: [] }, finishReason: 'SAFETY' }] }]));
    const { done } = await collect(new GoogleChatService(), credentials('google', 'gemini-3-pro'), request);
    expect(done.stop).toBe('refused');
  });
});

describe('CohereChatService', () => {
  const body = sse([
    { type: 'message-start', id: 'x' },
    { type: 'tool-plan-delta', delta: { message: { tool_plan: 'Vou buscar' } } },
    { type: 'tool-call-start', index: 0, delta: { message: { tool_calls: { id: 'k1', type: 'function', function: { name: 'search_records', arguments: '' } } } } },
    { type: 'tool-call-delta', index: 0, delta: { message: { tool_calls: { function: { arguments: '{"a":' } } } } },
    { type: 'tool-call-delta', index: 0, delta: { message: { tool_calls: { function: { arguments: '2}' } } } } },
    { type: 'tool-call-end', index: 0 },
    { type: 'message-end', delta: { finish_reason: 'TOOL_CALL', usage: { tokens: { input_tokens: 12, output_tokens: 4 } } } },
  ], true);

  it('acumula os argumentos e lê o uso do message-end', async () => {
    const calls = stubStream(body);
    const { done } = await collect(new CohereChatService(), credentials('cohere', 'command-a'), request);
    expect(done.stop).toBe('tool_use');
    expect(done.usage).toEqual({ inputTokens: 12, outputTokens: 4 });
    expect(done.message.parts).toEqual([{ type: 'tool_call', id: 'k1', name: 'search_records', input: { a: 2 } }]);
    expect(calls[0].body.messages).toEqual([
      { role: 'system', content: 'You are helpful.' },
      { role: 'user', content: 'How many?' },
      {
        role: 'assistant',
        tool_plan: 'Searching.',
        tool_calls: [{ id: 'c1', type: 'function', function: { name: 'search_records', arguments: '{"collection":"x"}' } }],
      },
      { role: 'tool', tool_call_id: 'c1', content: '{"total":3}' },
    ]);
  });

  it('texto em content-delta chega em pedaços', async () => {
    stubStream(sse([
      { type: 'content-delta', index: 0, delta: { message: { content: { text: 'Olá' } } } },
      { type: 'content-delta', index: 0, delta: { message: { content: { text: '!' } } } },
      { type: 'message-end', delta: { finish_reason: 'COMPLETE' } },
    ]));
    const { done, text } = await collect(new CohereChatService(), credentials('cohere', 'command-a'), request);
    expect(text).toBe('Olá!');
    expect(done.stop).toBe('end');
  });
});

describe('aborto', () => {
  it('o sinal de quem chamou chega ao fetch', async () => {
    let received: AbortSignal | undefined;
    vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
      received = init.signal ?? undefined;
      throw new DOMException('aborted', 'AbortError');
    });
    const controller = new AbortController();
    controller.abort();
    const iterator = new OpenAIChatService().stream(credentials('openai', 'gpt-4.1'), request, controller.signal);
    await expect((async () => { for await (const event of iterator) void event; })()).rejects.toThrow('aborted');
    expect(received?.aborted).toBe(true);
  });
});
