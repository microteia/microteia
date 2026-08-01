import { describe, expect, it } from 'vitest';
import {
  createSchemaContext,
  derivedLookupCollection,
  derivedTagCollection,
  isLookupTable,
  lookupIdIssue,
  resolveEntity,
  screenIdIssue,
  tagListIdIssue,
} from './screenEntity';

const ctx = createSchemaContext(
  [{ id: 'medico', titleSingular: 'Médico', titleFieldKey: 'nome', fields: [] }],
  [{ collection: 'medico_especialidade', label: 'Especialidade' }],
  [{ collection: 'medico_tags', label: 'Etiquetas: Médicos' }],
);

describe('SchemaContext — as listas do kernel e do tenant num conjunto só', () => {
  it('resolve as duas origens pelo mesmo caminho', () => {
    expect(isLookupTable(ctx, 'deadlineTypes')).toBe(true);
    expect(isLookupTable(ctx, 'medico_especialidade')).toBe(true);
    expect(isLookupTable(ctx, 'inexistente')).toBe(false);
  });

  it('a lista do kernel entra mesmo sem declaração no tenant', () => {
    expect(isLookupTable(createSchemaContext(), 'financialCategories')).toBe(true);
  });
});

describe('nome de lista', () => {
  it('recusa vazio, malformado e reservado', () => {
    expect(lookupIdIssue('')).toBeTruthy();
    expect(lookupIdIssue('minha-lista')).toBeTruthy();
    expect(lookupIdIssue('1lista')).toBeTruthy();
    expect(lookupIdIssue('deadlineTypes')).toBeTruthy();
    expect(lookupIdIssue('lookupDefinitions')).toBeTruthy();
  });

  it('aceita um nome livre', () => {
    expect(lookupIdIssue('medico_especialidade')).toBeUndefined();
  });

  /**
   * Lista e tela viram coleção sob o mesmo tenant e passam pelo MESMO `match` curinga das rules.
   * Deixar as duas reivindicarem um nome faria uma herdar a autorização da outra.
   */
  it('lista e tela disputam o mesmo espaço de nomes, nos dois sentidos', () => {
    expect(lookupIdIssue('medico', ctx)).toBe('"medico" já é o nome de uma tela');
    expect(screenIdIssue('medico_especialidade', ctx)).toBe('"medico_especialidade" já é o nome de uma lista de opções');
  });

  it('o nome sugerido junta tela e campo, sem colidir com o camelCase do kernel', () => {
    expect(derivedLookupCollection('medico', 'especialidade')).toBe('medico_especialidade');
    expect(derivedLookupCollection('persons', 'address.city')).toBe('persons_address_city');
    expect(derivedTagCollection('medico')).toBe('medico_tags');
  });
});

describe('conjuntos de etiquetas', () => {
  it('os do kernel entram no contexto mesmo sem declaração do tenant', () => {
    const semTenant = createSchemaContext();
    // Só `financialTags` resta em código: as etiquetas de Pessoa, Processo e Contrato saíram com
    // as entidades e agora são declaradas pelas extensões.
    expect(semTenant.tagLists.has('financialTags')).toBe(true);
    expect(semTenant.tagLists.has('contractTags')).toBe(false);
  });

  it('a tela do tenant pode redirecionar as etiquetas de uma entidade fixa', () => {
    const compartilhado = createSchemaContext(
      [{ id: 'financials', titleSingular: 'Financeiro', titleFieldKey: 'category', fields: [], tagCollection: 'medico_tags' }],
      [],
      [{ collection: 'medico_tags', label: 'Etiquetas: Médicos' }],
    );
    expect(resolveEntity(compartilhado, 'financials')?.tagCollection).toBe('medico_tags');
    // Sem redirecionamento, vale a declarada em código.
    expect(resolveEntity(createSchemaContext(), 'financials')?.tagCollection).toBe('financialTags');
  });

  /** Tela, lista e etiquetas caem no MESMO curinga das rules: um nome só pode ter um dono. */
  it('o espaço de nomes é único entre tela, lista e etiquetas', () => {
    expect(tagListIdIssue('medico', ctx)).toBe('"medico" já é o nome de uma tela');
    expect(tagListIdIssue('medico_especialidade', ctx)).toBe('"medico_especialidade" já é o nome de uma lista de opções');
    expect(screenIdIssue('medico_tags', ctx)).toBe('"medico_tags" já é o nome de um conjunto de etiquetas');
    expect(lookupIdIssue('medico_tags', ctx)).toBe('"medico_tags" já é o nome de um conjunto de etiquetas');
    expect(tagListIdIssue('financialTags')).toBeTruthy();
    expect(tagListIdIssue('medico_tags')).toBeUndefined();
  });
});
