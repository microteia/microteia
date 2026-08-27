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
  'documentTypes',
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

  /**
   * O escritório é a única entidade do registro que aceita campo do tenant: a tela dele virou plugin
   * justamente para que o Form Design a alcance. Ela não é referenciável porque não há lista de onde
   * escolher um escritório — o registro é UM só, o documento `tenants/{tenantId}`.
   */
  it('mantém os conjuntos de entidades com custom fields e referenciáveis', () => {
    expect([...CUSTOM_FIELD_ENABLED_ENTITIES]).toStrictEqual(['tenant']);
    expect([...BUILTIN_REF_ENTITIES].sort()).toStrictEqual(['members']);
  });

  /**
   * Nenhuma entidade do registro declara mais prefixo próprio: a última que o fazia era `pushes`
   * (`push.saved`), e ela saiu do kernel levando o prefixo para a declaração da TELA. O teste
   * continua para acusar o dia em que alguém reintroduzir um prefixo em código.
   */
  it('nenhuma entidade do registro declara prefixo de evento próprio', () => {
    expect(ENTITY_REGISTRY_LIST.filter((entity) => entity.eventPrefix)).toStrictEqual([]);
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

/**
 * Nenhuma entidade do registro pode ter o rótulo escrito em texto. `members` foi a última — `'Membro'`
 * e `'Membros'` — e não havia regra que a visse: não é JSX, e nenhuma das duas palavras tem acento.
 * O teste é a regra que faltava, e vale para a próxima entidade, não só para a que quebrou.
 */
describe('rótulo de entidade é referência, nunca texto', () => {
  it.each(Object.values(ENTITY_REGISTRY).map((entity) => [entity.key, entity] as const))(
    '%s',
    (_key, entity) => {
      expect(entity.labelSingular.startsWith('@')).toBe(true);
      expect(entity.labelPlural.startsWith('@')).toBe(true);
    },
  );
});

describe('helpers do registry', () => {
  it('resolve entidade por coleção', () => {
    // O rótulo é REFERÊNCIA, não texto: era a última entidade do registro escrita em português, e
    // quem a resolve é o ponto de render, como faz com o de qualquer tela de extensão.
    expect(getEntityByCollection('members')?.labelSingular).toBe('@core.data/member.singular');
    // Contrato, Financeiro, Prazo, Push e Notícia saíram do kernel: quem descreve as coleções são as extensões.
    expect(getEntityByCollection('news')).toBeUndefined();
    expect(getEntityByCollection('contracts')).toBeUndefined();
    expect(getEntityByCollection('financials')).toBeUndefined();
    expect(getEntityByCollection('deadlines')).toBeUndefined();
    expect(getEntityByCollection('pushes')).toBeUndefined();
    expect(getEntityByCollection('inexistente')).toBeUndefined();
  });

  it('resolve displayName pela ordem de fallback', () => {
    const members = ENTITY_REGISTRY.members;
    expect(getEntityDisplayName(members, { email: 'ana@escritorio.com' })).toBe('ana@escritorio.com');
    expect(getEntityDisplayName(members, { name: 'Ana', email: 'ana@escritorio.com' })).toBe('Ana');
    expect(getEntityDisplayName(members, {})).toBeUndefined();
  });
});
