import { describe, expect, it } from 'vitest';
import type { BehaviorEffect } from './behaviorModel';
import { domainModelJsonSchema } from './jsonSchema';

const EFFECT_PROPERTIES: Record<keyof BehaviorEffect, true> = {
  kind: true,
  entity: true,
  field: true,
  value: true,
  aggregation: true,
  target: true,
  duration: true,
  template: true,
  output: true,
};

describe('domainModelJsonSchema — o esquema que o agente segue', () => {
  // O efeito `wait` entrou no modelo e não no esquema: com `additionalProperties: false`, o agente que
  // seguisse o esquema não tinha como escrever a duração. O `Record<keyof BehaviorEffect>` acima
  // reprova na compilação a propriedade nova que não passar por aqui.
  it('o efeito publica toda propriedade que o leitor do modelo aceita', () => {
    const defs = (domainModelJsonSchema() as { $defs: Record<string, { properties: Record<string, unknown> }> }).$defs;
    expect(Object.keys(defs.effect.properties).sort()).toEqual(Object.keys(EFFECT_PROPERTIES).sort());
  });
});
