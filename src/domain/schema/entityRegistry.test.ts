import { describe, it, expect } from 'vitest';
import { ENTITY_REGISTRY, ENTITY_REGISTRY_LIST, getEntityByCollection, getEntityDisplayName } from './entityRegistry';
import { LOOKUP_REGISTRY } from './lookupRegistry';
import {
  ENTITY_FK_SCHEMA,
  CUSTOM_FIELD_ENABLED_ENTITIES,
  BUILTIN_REF_ENTITIES,
} from '../entities/entitySchemas';

const LEGACY_FK_SCHEMA = {
  persons: {
    tagIds: { targetCollection: 'personTags', multi: true },
  },
  cases: {
    contractId: { targetCollection: 'contracts', denormalizedFields: ['number', 'title', 'type', 'status'] },
    responsibleLawyerId: { targetCollection: 'persons', denormalizedFields: ['name', 'type', 'email'] },
    activePoleIds: { targetCollection: 'persons', multi: true },
    passivePoleIds: { targetCollection: 'persons', multi: true },
    tagIds: { targetCollection: 'caseTags', multi: true },
  },
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
  contracts: {
    clientId: { targetCollection: 'persons', denormalizedFields: ['name', 'type', 'email'] },
    responsibleId: { targetCollection: 'persons', denormalizedFields: ['name', 'type', 'email'] },
    contractorIds: { targetCollection: 'persons', multi: true },
    contracteeIds: { targetCollection: 'persons', multi: true },
    witnessIds: { targetCollection: 'persons', multi: true },
    contractorLawyerIds: { targetCollection: 'persons', multi: true },
    contracteeLawyerIds: { targetCollection: 'persons', multi: true },
    tagIds: { targetCollection: 'contractTags', multi: true },
  },
};

const LEGACY_LOOKUP_COLLECTIONS = [
  'personTypes', 'personOccupations', 'personNationalities', 'personMaritalStatuses',
  'personCities', 'personRelationships', 'personGenders',
  'caseAreas', 'casePhases', 'caseStatuses', 'caseInstances', 'caseActionTypes',
  'caseCourts', 'caseDistricts', 'caseJudges',
  'documentTypes', 'newsCategories',
  'contractTypes', 'contractCategories', 'contractStatuses', 'contractObjects',
  'contractAdjustmentIndexes', 'contractAdjustmentPeriodicities', 'contractCurrencies',
  'contractPaymentMethods', 'contractBanks', 'contractCostCenters',
  'deadlineTypes',
  'financialCategories', 'financialStatuses',
];

const LEGACY_DEFAULT_DENORM_FIELDS: Record<string, string[]> = {
  persons: ['name', 'type', 'email'],
  cases: ['caseNumber', 'title', 'area'],
  contracts: ['number', 'title', 'type'],
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
      ['persons', 'cases', 'deadlines', 'financials', 'contracts'].sort(),
    );
    expect([...BUILTIN_REF_ENTITIES].sort()).toStrictEqual(
      ['persons', 'cases', 'contracts', 'deadlines', 'financials', 'members'].sort(),
    );
  });

  it('mantém os prefixos de evento das coleções flat', () => {
    const prefixes = Object.fromEntries(
      ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix).map((entity) => [entity.collection, entity.eventPrefix]),
    );
    expect(prefixes).toStrictEqual({
      persons: 'person',
      contracts: 'contract',
      cases: 'case',
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
    expect(getEntityByCollection('cases')?.labelSingular).toBe('Processo');
    expect(getEntityByCollection('inexistente')).toBeUndefined();
  });

  it('resolve displayName pela ordem de fallback', () => {
    const cases = ENTITY_REGISTRY.cases;
    expect(getEntityDisplayName(cases, { title: 'Ação X', caseNumber: '001' })).toBe('Ação X');
    expect(getEntityDisplayName(cases, { caseNumber: '001' })).toBe('001');
    expect(getEntityDisplayName(cases, {})).toBeUndefined();
  });
});
