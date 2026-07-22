import { describe, it, expect } from 'vitest';
import { createCapabilityRegistry } from './CapabilityRegistry';

const aiCompletion = { capability: 'ai.completion', range: '^1.0.0' };

describe('createCapabilityRegistry', () => {
  it('começa vazio', () => {
    const registry = createCapabilityRegistry();
    expect(registry.capabilities()).toEqual([]);
    expect(registry.resolve(aiCompletion)).toBeNull();
    expect(registry.providersOf('ai.completion')).toEqual([]);
  });

  it('resolve o único provedor', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('com.acme.openai', { capability: 'ai.completion', version: '1.0.0' });

    expect(registry.resolve(aiCompletion)?.pluginId).toBe('com.acme.openai');
    expect(registry.capabilities()).toEqual(['ai.completion']);
  });

  it('aceita vários provedores para a mesma capability', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('com.acme.openai', { capability: 'ai.completion', version: '1.0.0' });
    registry.registerProvider('com.acme.anthropic', { capability: 'ai.completion', version: '1.2.0' });

    expect(registry.providersOf('ai.completion').map((p) => p.pluginId)).toEqual([
      'com.acme.anthropic',
      'com.acme.openai',
    ]);
  });

  it('escolhe pela prioridade e desempata alfabeticamente', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('zeta', { capability: 'ai.completion', version: '1.0.0' });
    registry.registerProvider('alpha', { capability: 'ai.completion', version: '1.0.0' });
    expect(registry.resolve(aiCompletion)?.pluginId).toBe('alpha');

    registry.registerProvider('omega', { capability: 'ai.completion', version: '1.0.0', priority: 5 });
    expect(registry.resolve(aiCompletion)?.pluginId).toBe('omega');
  });

  it('a vinculação do escritório vence a prioridade', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('a', { capability: 'ai.completion', version: '1.0.0', priority: 99 });
    registry.registerProvider('b', { capability: 'ai.completion', version: '1.0.0' });

    expect(registry.resolve(aiCompletion, 'b')?.pluginId).toBe('b');
  });

  it('ignora provedor fora da faixa exigida', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('a', { capability: 'ai.completion', version: '2.0.0' });
    expect(registry.resolve(aiCompletion)).toBeNull();
  });

  it('não mistura capabilities diferentes', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('a', { capability: 'messaging.email', version: '1.0.0' });
    expect(registry.resolve(aiCompletion)).toBeNull();
    expect(registry.providersOf('messaging.email')).toHaveLength(1);
  });

  it('removeByPlugin tira todos os provimentos do plugin', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('a', { capability: 'ai.completion', version: '1.0.0' });
    registry.registerProvider('a', { capability: 'messaging.email', version: '1.0.0' });
    registry.registerProvider('b', { capability: 'ai.completion', version: '1.0.0' });

    expect(registry.removeByPlugin('a')).toBe(2);
    expect(registry.capabilities()).toEqual(['ai.completion']);
    expect(registry.resolve(aiCompletion)?.pluginId).toBe('b');
    expect(registry.removeByPlugin('inexistente')).toBe(0);
  });

  it('clear zera tudo', () => {
    const registry = createCapabilityRegistry();
    registry.registerProvider('a', { capability: 'ai.completion', version: '1.0.0' });
    registry.clear();
    expect(registry.capabilities()).toEqual([]);
  });
});
