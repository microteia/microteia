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
  financials: {
    caseId: { targetCollection: 'cases', denormalizedFields: ['caseNumber', 'title'] },
    personId: { targetCollection: 'persons', denormalizedFields: ['name', 'type'] },
    contractId: { targetCollection: 'contracts', denormalizedFields: ['number', 'title'] },
    tagIds: { targetCollection: 'financialTags', multi: true },
  },
};

// `contractCostCenters` sobrevive à saída de Contrato do kernel porque o campo "Centro de custo"
// do Financeiro aponta para a mesma lista — as nove outras foram junto com a entidade.
const LEGACY_LOOKUP_COLLECTIONS = [
  'documentTypes', 'newsCategories', 'contractCostCenters',
  'deadlineTypes',
  'financialCategories', 'financialStatuses',
];

const LEGACY_DEFAULT_DENORM_FIELDS: Record<string, string[]> = {
  deadlines: ['type', 'dueDate', 'priority'],
  financials: ['type', 'amount', 'dueDate'],
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
    expect([...CUSTOM_FIELD_ENABLED_ENTITIES].sort()).toStrictEqual(
      ['deadlines', 'financials'].sort(),
    );
    expect([...BUILTIN_REF_ENTITIES].sort()).toStrictEqual(
      ['deadlines', 'financials', 'members'].sort(),
    );
  });

  it('mantém os prefixos de evento das coleções flat', () => {
    const prefixes = Object.fromEntries(
      ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [entity.collection, entity.eventPrefix]),
    );
    expect(prefixes).toStrictEqual({
      deadlines: 'deadline',
      financials: 'financial',
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
    expect(getEntityByCollection('financials')?.labelSingular).toBe('Financeiro');
    // Contrato saiu do kernel: quem descreve a coleção é a extensão, e o registro não a conhece.
    expect(getEntityByCollection('contracts')).toBeUndefined();
    expect(getEntityByCollection('inexistente')).toBeUndefined();
  });

  it('resolve displayName pela ordem de fallback', () => {
    const deadlines = ENTITY_REGISTRY.deadlines;
    expect(getEntityDisplayName(deadlines, { description: 'Audiência', type: 'Audiência' })).toBe('Audiência');
    expect(getEntityDisplayName(deadlines, {})).toBeUndefined();
  });
});
