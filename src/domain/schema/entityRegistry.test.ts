import { describe, it, expect } from 'vitest';
import { ENTITY_REGISTRY, ENTITY_REGISTRY_LIST, getEntityByCollection, getEntityDisplayName } from './entityRegistry';
import { LOOKUP_REGISTRY } from './lookupRegistry';
import {
  ENTITY_FK_SCHEMA,
  CUSTOM_FIELD_ENABLED_ENTITIES,
  BUILTIN_REF_ENTITIES,
} from '../entities/entitySchemas';

// O que restou no kernel depois que Pessoa, Contrato, Processo, Financeiro e Prazo saíram: as listas
// das entidades que ainda são de código. As demais vivem nas extensões que as declaram.
const LEGACY_LOOKUP_COLLECTIONS = [
  'documentTypes', 'newsCategories',
];

const LEGACY_DEFAULT_DENORM_FIELDS: Record<string, string[]> = {
  members: ['name', 'email'],
};

describe('entityRegistry — compatibilidade com o schema legado', () => {
  /**
   * Nenhuma entidade do kernel tem mais relação declarada em código: as que tinham saíram para as
   * extensões, onde a relação é um campo `reference` da tela. O esquema derivado é o vazio — e é
   * ele que precisa continuar sendo gerado sem estourar.
   */
  it('sem entidade com relação no kernel, o esquema derivado é vazio', () => {
    expect(ENTITY_FK_SCHEMA).toStrictEqual({});
  });

  it('mantém a convenção denormKey = key sem sufixo Id/Ids', () => {
    for (const entity of ENTITY_REGISTRY_LIST) {
      for (const fk of entity.fks) {
        expect(fk.denormKey).toBe(fk.key.replace(/Ids?$/, ''));
      }
    }
  });

  it('mantém os conjuntos de entidades com custom fields e referenciáveis', () => {
    expect([...CUSTOM_FIELD_ENABLED_ENTITIES]).toStrictEqual([]);
    expect([...BUILTIN_REF_ENTITIES].sort()).toStrictEqual(['members']);
  });

  it('mantém os prefixos de evento das coleções flat', () => {
    const prefixes = Object.fromEntries(
      ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [entity.collection, entity.eventPrefix]),
    );
    expect(prefixes).toStrictEqual({
      pushes: 'push',
    });
  });

  it('mantém os campos de denormalização padrão das entidades referenciáveis', () => {
    for (const [collection, fields] of Object.entries(LEGACY_DEFAULT_DENORM_FIELDS)) {
      expect(ENTITY_REGISTRY[collection as keyof typeof ENTITY_REGISTRY].referenceDenormFields).toStrictEqual(fields);
    }
  });
});

describe('lookupRegistry — compatibilidade com LOOKUP_COLLECTIONS legado', () => {
  it('cobre exatamente as coleções de lookup antigas', () => {
    expect(Object.keys(LOOKUP_REGISTRY).sort()).toStrictEqual([...LEGACY_LOOKUP_COLLECTIONS].sort());
  });
});

describe('helpers do registry', () => {
  it('resolve entidade por coleção', () => {
    expect(getEntityByCollection('pushes')?.labelSingular).toBe('Push');
    // Contrato, Financeiro e Prazo saíram do kernel: quem descreve as coleções são as extensões.
    expect(getEntityByCollection('contracts')).toBeUndefined();
    expect(getEntityByCollection('financials')).toBeUndefined();
    expect(getEntityByCollection('deadlines')).toBeUndefined();
    expect(getEntityByCollection('inexistente')).toBeUndefined();
  });

  it('resolve displayName pela ordem de fallback', () => {
    const pushes = ENTITY_REGISTRY.pushes;
    expect(getEntityDisplayName(pushes, { processNumber: '938333' })).toBe('938333');
    expect(getEntityDisplayName(pushes, { subject: 'Intimação', processNumber: '938333' })).toBe('Intimação');
    expect(getEntityDisplayName(pushes, {})).toBeUndefined();
  });
});
