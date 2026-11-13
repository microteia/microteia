import { afterEach, describe, expect, it, vi } from 'vitest';
import { AnthropicService, acceptsTemperature, supportsServerFallback } from './AnthropicService';
import type { AICredentials } from '../../domain/entities/AICredentials';

const credentials = (model: string): AICredentials => ({
  provider: 'anthropic',
  apiKey: 'test-key',
  model,
  temperature: 0.7,
  maxTokens: 2048,
});

const stubFetch = (content: unknown[]) => {
  const calls: { url: string; body: Record<string, unknown>; headers: Record<string, string> }[] = [];
  vi.stubGlobal('fetch', async (url: string, init: RequestInit) => {
    calls.push({
      url,
      body: JSON.parse(String(init.body)) as Record<string, unknown>,
      headers: init.headers as Record<string, string>,
    });
    return new Response(JSON.stringify({ content }), { status: 200 });
  });
  return calls;
};

afterEach(() => vi.unstubAllGlobals());

describe('AnthropicService', () => {
  it('envia o prompt de sistema no campo system', async () => {
    const calls = stubFetch([{ type: 'text', text: '{"workflowIds":[]}' }]);
    await new AnthropicService().call(credentials('claude-sonnet-4-6'), 'doc', {
      systemPrompt: 'Responda só com JSON',
      expectJson: true,
    });
    expect(calls[0].body.system).toBe('Responda só com JSON');
    expect(calls[0].body.messages).toEqual([{ role: 'user', content: 'doc' }]);
  });

  it('omite system quando não há prompt de sistema', async () => {
    const calls = stubFetch([{ type: 'text', text: 'ok' }]);
    await new AnthropicService().call(credentials('claude-sonnet-4-6'), 'doc');
    expect(calls[0].body).not.toHaveProperty('system');
  });

  it('devolve só os blocos de texto, ignorando o raciocínio que vem antes', async () => {
    stubFetch([
      { type: 'thinking', thinking: '' },
      { type: 'text', text: '{"a":' },
      { type: 'text', text: '1}' },
    ]);
    const text = await new AnthropicService().call(credentials('claude-opus-5-5'), 'doc');
    expect(text).toBe('{"a":1}');
  });

  it('manda temperature só para modelo que a aceita', async () => {
    const calls = stubFetch([{ type: 'text', text: 'ok' }]);
    await new AnthropicService().call(credentials('claude-sonnet-4-6'), 'doc');
    await new AnthropicService().call(credentials('claude-opus-4-8'), 'doc');
    expect(calls[0].body.temperature).toBe(0.7);
    expect(calls[1].body).not.toHaveProperty('temperature');
  });

  it('pede esforço baixo aos modelos que raciocinam por padrão, e não aos anteriores', async () => {
    const calls = stubFetch([{ type: 'text', text: 'ok' }]);
    await new AnthropicService().call(credentials('claude-opus-5-5'), 'doc');
    await new AnthropicService().call(credentials('claude-sonnet-4-6'), 'doc');
    expect(calls[0].body.output_config).toEqual({ effort: 'low' });
    expect(calls[1].body).not.toHaveProperty('output_config');
  });

  it('liga o fallback do servidor só nos modelos que o oferecem', async () => {
    const calls = stubFetch([{ type: 'text', text: 'ok' }]);
    await new AnthropicService().call(credentials('claude-sonnet-5-5'), 'doc');
    await new AnthropicService().call(credentials('claude-haiku-5-5'), 'doc');
    expect(calls[0].body.fallbacks).toBe('default');
    expect(calls[0].headers['anthropic-beta']).toBe('server-side-fallback-2026-07-01');
    expect(calls[1].body).not.toHaveProperty('fallbacks');
    expect(calls[1].headers).not.toHaveProperty('anthropic-beta');
  });
});

describe('supportsServerFallback', () => {
  it.each(['claude-opus-5-5', 'claude-opus-5', 'claude-sonnet-5-5', 'claude-fable-5-2', 'claude-fable-5-1'])(
    'oferece em %s',
    (model) => expect(supportsServerFallback(model)).toBe(true),
  );
  it.each(['claude-haiku-5-5', 'claude-sonnet-5', 'claude-opus-4-8', 'claude-sonnet-4-6'])(
    'não oferece em %s',
    (model) => expect(supportsServerFallback(model)).toBe(false),
  );
});

describe('acceptsTemperature', () => {
  it.each([
    'claude-sonnet-4-6',
    'claude-haiku-4-5-20251001',
    'claude-opus-4-6',
    'claude-sonnet-4-20250514',
    'claude-3-5-haiku-20241022',
  ])('aceita %s', (model) => expect(acceptsTemperature(model)).toBe(true));

  it.each([
    'claude-opus-4-7',
    'claude-opus-4-8',
    'claude-sonnet-5',
    'claude-sonnet-5-5',
    'claude-opus-5-5',
    'claude-haiku-5-5',
    'claude-fable-5-2',
  ])('recusa %s', (model) => expect(acceptsTemperature(model)).toBe(false));
});
