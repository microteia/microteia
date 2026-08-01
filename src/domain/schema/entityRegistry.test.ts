import { describe, it, expect } from 'vitest';
import { ENTITY_REGISTRY, ENTITY_REGISTRY_LIST, getEntityByCollection, getEntityDisplayName } from './entityRegistry';
import { LOOKUP_REGISTRY } from './lookupRegistry';
import {
  ENTITY_FK_SCHEMA,
  CUSTOM_FIELD_ENABLED_ENTITIES,
  BUILTIN_REF_ENTITIES,
} from '../entities/entitySchemas';

const LEGACY_FK_SCHEMA = {
  deadlines: {
    caseId: { targetCollection: 'cases', denormalizedFields: ['caseNumber', 'title', 'area'] },
    responsibleLawyerId: { targetCollection: 'persons', denormalizedFields: ['name', 'type', 'email'] },
  },
};

// O que restou no kernel depois que Pessoa, Contrato, Processo e Financeiro saíram: as listas das
// entidades que ainda são de código. As demais vivem nas extensões que as declaram.
const LEGACY_LOOKUP_COLLECTIONS = [
  'documentTypes', 'newsCategories', 'deadlineTypes',
];

const LEGACY_DEFAULT_DENORM_FIELDS: Record<string, string[]> = {
  deadlines: ['type', 'dueDate', 'priority'],
  members: ['name', 'email'],
};

describe('entityRegistry — compatibilidade com o schema legado', () => {
  it('deriva ENTITY_FK_SCHEMA idêntico ao literal antigo', () => {
    expect(ENTITY_FK_SCHEMA).toStrictEqual(LEGACY_FK_SCHEMA);
  });

  it('mantém a convenção denormKey = key sem sufixo Id/Ids', () => {
    for (const entity of ENTITY_REGISTRY_LIST) {
      for (const fk of entity.fks) {
        expect(fk.denormKey).toBe(fk.key.replace(/Ids?$/, ''));
      }
    }
  });

  it('mantém os conjuntos de entidades com custom fields e referenciáveis', () => {
    expect([...CUSTOM_FIELD_ENABLED_ENTITIES].sort()).toStrictEqual(['deadlines']);
    expect([...BUILTIN_REF_ENTITIES].sort()).toStrictEqual(
      ['deadlines', 'members'].sort(),
    );
  });

  it('mantém os prefixos de evento das coleções flat', () => {
    const prefixes = Object.fromEntries(
      ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [entity.collection, entity.eventPrefix]),
    );
    expect(prefixes).toStrictEqual({
      deadlines: 'deadline',
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
    expect(getEntityByCollection('deadlines')?.labelSingular).toBe('Prazo');
    // Contrato e Financeiro saíram do kernel: quem descreve as coleções são as extensões.
    expect(getEntityByCollection('contracts')).toBeUndefined();
    expect(getEntityByCollection('financials')).toBeUndefined();
    expect(getEntityByCollection('inexistente')).toBeUndefined();
  });

  it('resolve displayName pela ordem de fallback', () => {
    const deadlines = ENTITY_REGISTRY.deadlines;
    expect(getEntityDisplayName(deadlines, { description: 'Audiência', type: 'Audiência' })).toBe('Audiência');
    expect(getEntityDisplayName(deadlines, {})).toBeUndefined();
  });
});
