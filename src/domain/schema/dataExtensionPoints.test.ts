import { describe, it, expect } from 'vitest';
import { createPluginHost } from '../../kernel';
import type { EntityMetadata } from './entityRegistry';
import { ENTITY_REGISTRY_LIST } from './entityRegistry';
import type { LookupMetadata } from './lookupRegistry';
import { LOOKUP_REGISTRY_LIST } from './lookupRegistry';
import {
  DATA_ENTITY_POINT,
  DATA_LOOKUP_POINT,
  ENTITY_CONTRIBUTIONS,
  LOOKUP_CONTRIBUTIONS,
} from './dataExtensionPoints';
import { coreDataPlugin } from '../../plugins/core.data/manifest';

describe('contribuições de dados — cobertura', () => {
  it('há uma contribuição de entidade para cada entidade do registro', () => {
    expect(ENTITY_CONTRIBUTIONS).toHaveLength(ENTITY_REGISTRY_LIST.length);
  });

  it('há uma contribuição de lookup para cada lookup do registro', () => {
    expect(LOOKUP_CONTRIBUTIONS).toHaveLength(LOOKUP_REGISTRY_LIST.length);
  });

  it('a metadata de cada contribuição é o próprio objeto do registro (fonte única)', () => {
    for (const contribution of ENTITY_CONTRIBUTIONS) {
      const metadata = contribution.metadata as unknown as EntityMetadata;
      const original = ENTITY_REGISTRY_LIST.find((e) => e.key === metadata.key);
      expect(original).toBeDefined();
      expect(metadata.collection).toBe(original?.collection);
      expect(metadata.fields).toBe(original?.fields);
    }
  });

  it('nenhuma contribuição carrega implementação (entidade é metadata pura)', () => {
    for (const contribution of [...ENTITY_CONTRIBUTIONS, ...LOOKUP_CONTRIBUTIONS]) {
      expect(contribution.impl).toBeUndefined();
    }
  });

  it('todo id de contribuição é um slug válido', () => {
    const ids = ENTITY_CONTRIBUTIONS.map((c) => c.id);
    expect(ids).toContain('pushes');
    for (const id of ids) expect(id).toMatch(/^[a-z0-9][a-z0-9-]*$/);
  });
});

describe('core.data — enumeração pelo Kernel', () => {
  const load = () => {
    const host = createPluginHost();
    const result = host.load([coreDataPlugin]);
    return { host, result };
  };

  it('carrega sem diagnóstico', () => {
    const { result } = load();
    expect(result.diagnostics).toEqual([]);
  });

  it('expõe todas as entidades por data.entity, com a mesma chave do registro', () => {
    const { host } = load();
    const keys = host.contributions
      .query(DATA_ENTITY_POINT)
      .map((c) => (c.metadata as unknown as EntityMetadata).key)
      .sort();

    expect(keys).toEqual(ENTITY_REGISTRY_LIST.map((e) => e.key).sort());
  });

  it('expõe todos os lookups por data.lookup, com a mesma coleção do registro', () => {
    const { host } = load();
    const collections = host.contributions
      .query(DATA_LOOKUP_POINT)
      .map((c) => (c.metadata as unknown as LookupMetadata).collection)
      .sort();

    expect(collections).toEqual(LOOKUP_REGISTRY_LIST.map((l) => l.collection).sort());
  });

  it('o plugin que declara o ponto pode contribuir para ele', () => {
    const { host } = load();
    expect(host.points.has(DATA_ENTITY_POINT)).toBe(true);
    expect(host.contributions.query(DATA_ENTITY_POINT).length).toBeGreaterThan(0);
  });
});
