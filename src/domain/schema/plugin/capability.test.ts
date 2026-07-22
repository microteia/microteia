import { describe, it, expect } from 'vitest';
import {
  isValidCapabilityId,
  provisionPriority,
  selectProvider,
  validateProvisions,
  validateRequirements,
} from './capability';
import type { CapabilityProvision, ResolvedProvider } from './capability';

const provider = (pluginId: string, overrides: Partial<CapabilityProvision> = {}): ResolvedProvider => ({
  pluginId,
  provision: { capability: 'ai.completion', version: '1.0.0', ...overrides },
});

describe('isValidCapabilityId', () => {
  it.each(['ai.completion', 'messaging.whatsapp', 'lookup.postal-code', 'a.b.c'])(
    'aceita "%s"',
    (id) => expect(isValidCapabilityId(id)).toBe(true),
  );

  it.each(['ai', 'AI.completion', 'ai..completion', 'ai.', '.completion', '', 'ai.-x'])(
    'rejeita "%s"',
    (id) => expect(isValidCapabilityId(id)).toBe(false),
  );
});

describe('provisionPriority', () => {
  it('usa 0 como padrão', () => {
    expect(provisionPriority({ capability: 'ai.completion', version: '1.0.0' })).toBe(0);
  });

  it('ignora prioridade não-finita', () => {
    expect(provisionPriority({ capability: 'ai.completion', version: '1.0.0', priority: NaN })).toBe(0);
  });

  it('respeita prioridade negativa', () => {
    expect(provisionPriority({ capability: 'ai.completion', version: '1.0.0', priority: -5 })).toBe(-5);
  });
});

describe('selectProvider', () => {
  const requirement = { capability: 'ai.completion', range: '^1.0.0' };

  it('devolve null quando não há candidato', () => {
    expect(selectProvider([], requirement)).toBeNull();
  });

  it('ignora candidato de outra capability', () => {
    expect(selectProvider([provider('a', { capability: 'messaging.email' })], requirement)).toBeNull();
  });

  it('ignora candidato fora da faixa de versão', () => {
    expect(selectProvider([provider('a', { version: '2.0.0' })], requirement)).toBeNull();
  });

  it('escolhe a maior prioridade', () => {
    const chosen = selectProvider(
      [provider('a', { priority: 1 }), provider('b', { priority: 10 }), provider('c', { priority: 5 })],
      requirement,
    );
    expect(chosen?.pluginId).toBe('b');
  });

  it('desempata prioridade por pluginId alfabético, não por ordem de registro', () => {
    const registrationOrder = [provider('zeta'), provider('alpha'), provider('meta')];
    expect(selectProvider(registrationOrder, requirement)?.pluginId).toBe('alpha');
    expect(selectProvider([...registrationOrder].reverse(), requirement)?.pluginId).toBe('alpha');
  });

  it('a vinculação do escritório vence a prioridade', () => {
    const chosen = selectProvider(
      [provider('a', { priority: 100 }), provider('b', { priority: 1 })],
      requirement,
      'b',
    );
    expect(chosen?.pluginId).toBe('b');
  });

  it('devolve null quando o provedor vinculado não é compatível', () => {
    const chosen = selectProvider([provider('a'), provider('b', { version: '3.0.0' })], requirement, 'b');
    expect(chosen).toBeNull();
  });
});

describe('validateProvisions', () => {
  it('não reclama de lista ausente', () => {
    expect(validateProvisions(undefined, 'com.acme.x')).toEqual([]);
  });

  it('aceita provisão bem formada', () => {
    expect(validateProvisions([{ capability: 'ai.completion', version: '1.0.0' }], 'com.acme.x')).toEqual([]);
  });

  it('reporta id de capability inválido', () => {
    const diagnostics = validateProvisions([{ capability: 'ai', version: '1.0.0' }], 'com.acme.x');
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0]).toMatchObject({ code: 'capability.id.invalid', path: 'provides[0].capability' });
  });

  it('reporta versão inválida', () => {
    const diagnostics = validateProvisions([{ capability: 'ai.completion', version: '1.x' }], 'com.acme.x');
    expect(diagnostics[0]).toMatchObject({ code: 'manifest.version.invalid', path: 'provides[0].version' });
  });

  it('acumula os dois problemas da mesma provisão', () => {
    expect(validateProvisions([{ capability: 'ai', version: 'x' }], 'com.acme.x')).toHaveLength(2);
  });
});

describe('validateRequirements', () => {
  it('aceita requisito bem formado', () => {
    expect(validateRequirements([{ capability: 'ai.completion', range: '^1.0.0' }], 'com.acme.x')).toEqual([]);
  });

  it('reporta faixa inválida', () => {
    const diagnostics = validateRequirements([{ capability: 'ai.completion', range: '1.x' }], 'com.acme.x');
    expect(diagnostics[0]).toMatchObject({ code: 'capability.range.invalid', path: 'consumes[0].range' });
  });

  it('aceita a faixa aberta "*"', () => {
    expect(validateRequirements([{ capability: 'ai.completion', range: '*' }], 'com.acme.x')).toEqual([]);
  });
});
