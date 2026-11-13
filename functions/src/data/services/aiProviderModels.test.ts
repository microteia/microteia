import { afterEach, describe, expect, it, vi } from 'vitest';
import { OpenAIService, isOpenAIReasoningModel } from './OpenAIService';
import { GoogleAIService, usesThinkingLevel } from './GoogleAIService';
import { MistralService } from './MistralService';
import { CohereService } from './CohereService';
import type { AICredentials } from '../../domain/entities/AICredentials';
import type { Provider } from '../../domain/entities/Provider';

const credentials = (provider: Provider, model: string): AICredentials => ({
  provider,
  apiKey: 'test-key',
  model,
  temperature: 0.7,
  maxTokens: 2048,
});

const stubFetch = (response: unknown) => {
  const bodies: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', async (_url: string, init: RequestInit) => {
    bodies.push(JSON.parse(String(init.body)) as Record<string, unknown>);
    return new Response(JSON.stringify(response), { status: 200 });
  });
  return bodies;
};

afterEach(() => vi.unstubAllGlobals());

const OPENAI_OK = { choices: [{ message: { content: '{}' } }] };

describe('OpenAIService', () => {
  it('modelo de raciocínio: esforço baixo, sem temperature, com max_completion_tokens', async () => {
    const bodies = stubFetch(OPENAI_OK);
    await new OpenAIService().call(credentials('openai', 'gpt-6.1-terra'), 'doc');
    expect(bodies[0]).toMatchObject({ reasoning_effort: 'low', max_completion_tokens: 2048 });
    expect(bodies[0]).not.toHaveProperty('temperature');
    expect(bodies[0]).not.toHaveProperty('max_tokens');
  });

  it('modelo sem raciocínio mantém a temperature e não recebe reasoning_effort', async () => {
    const bodies = stubFetch(OPENAI_OK);
    await new OpenAIService().call(credentials('openai', 'gpt-4o'), 'doc');
    expect(bodies[0]).toMatchObject({ temperature: 0.7, max_completion_tokens: 2048 });
    expect(bodies[0]).not.toHaveProperty('reasoning_effort');
  });

  it.each(['gpt-6-astra', 'gpt-6.1-sol', 'gpt-6-luna', 'gpt-5.5', 'o3', 'o4-mini'])(
    'reconhece %s como raciocínio',
    (model) => expect(isOpenAIReasoningModel(model)).toBe(true),
  );
  it.each(['gpt-4o', 'gpt-4o-mini', 'gpt-4.1'])('não trata %s como raciocínio', (model) =>
    expect(isOpenAIReasoningModel(model)).toBe(false),
  );
});

describe('GoogleAIService', () => {
  const GEMINI_OK = { candidates: [{ content: { parts: [{ text: '{}' }] } }] };

  it('Gemini 3+ recebe nível de raciocínio baixo; 2.5 não', async () => {
    const bodies = stubFetch(GEMINI_OK);
    await new GoogleAIService().call(credentials('google', 'gemini-4-carbon'), 'doc');
    await new GoogleAIService().call(credentials('google', 'gemini-2.5-flash-lite'), 'doc');
    const config = (i: number) => bodies[i].generationConfig as Record<string, unknown>;
    expect(config(0).thinkingConfig).toEqual({ thinkingLevel: 'low' });
    expect(config(1)).not.toHaveProperty('thinkingConfig');
  });

  it.each(['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-4-hydrogen'])('%s usa thinkingLevel', (model) =>
    expect(usesThinkingLevel(model)).toBe(true),
  );
});

describe('Mistral e Cohere', () => {
  it('Mistral envia o prompt de sistema e pede JSON', async () => {
    const bodies = stubFetch(OPENAI_OK);
    await new MistralService().call(credentials('mistral', 'mistral-large-4'), 'doc', {
      systemPrompt: 'sys',
      expectJson: true,
    });
    expect(bodies[0].messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'doc' },
    ]);
    expect(bodies[0].response_format).toEqual({ type: 'json_object' });
  });

  it('Cohere envia o prompt de sistema e pede JSON', async () => {
    const bodies = stubFetch({ message: { content: [{ text: '{}' }] } });
    await new CohereService().call(credentials('cohere', 'command-a-03-2025'), 'doc', {
      systemPrompt: 'sys',
      expectJson: true,
    });
    expect(bodies[0].messages).toEqual([
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'doc' },
    ]);
    expect(bodies[0].response_format).toEqual({ type: 'json_object' });
  });
});
