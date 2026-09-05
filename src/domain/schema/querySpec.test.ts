import { describe, it, expect } from 'vitest';
import { createSchemaContext } from './pathResolver';
import type { SchemaScreen } from './pathResolver';
import { resolveQueryTable, validateQuerySpec } from './querySpec';
import type { QuerySpec } from './querySpec';

const personsScreen: SchemaScreen = {
  id: 'persons',
  titleSingular: 'Pessoa',
  titleFieldKey: 'name',
  fields: [{ key: 'apelido', label: 'Apelido', type: 'text', required: false, order: 0, origin: 'design' }],
};

/**
 * Contrato vem de extensão: a coleção `contracts` é descrita por uma tela, com as relações que a
 * consulta navega (`client.name`) e os campos que ela projeta.
 */
const contractsScreen: SchemaScreen = {
  id: 'contratos',
  collection: 'contracts',
  eventPrefix: 'contract',
  titleSingular: 'Contrato',
  titleFieldKey: 'title',
  fields: [
    { key: 'number', label: 'Número', type: 'text', required: false, order: 0, origin: 'plugin' },
    { key: 'title', label: 'Título', type: 'text', required: false, order: 1, origin: 'plugin' },
    { key: 'status', label: 'Status', type: 'text', required: false, order: 2, origin: 'plugin' },
    { key: 'clientId', label: 'Cliente', type: 'reference', refEntity: 'persons', refDenormKey: 'client', required: false, order: 3, origin: 'plugin' },
    { key: 'contractorIds', label: 'Contratantes', type: 'reference', refEntity: 'persons', refDenormKey: 'contractor', multi: true, required: false, order: 4, origin: 'plugin' },
  ],
};

const dynamicScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'titulo',
  fields: [{ key: 'prioridade', label: 'Prioridade', type: 'text', required: false, order: 0, origin: 'design' }],
};

const ctx = createSchemaContext([personsScreen, contractsScreen, dynamicScreen], [
  { collection: 'contractTypes', label: 'Contrato: Tipo' },
]);

const spec = (overrides: Partial<QuerySpec>): QuerySpec => ({
  table: 'contracts',
  where: [],
  orderBy: [],
  limit: 20,
  projections: [],
  ...overrides,
});

describe('resolveQueryTable', () => {
  it('resolve tabela fixa para a própria coleção', () => {
    expect(resolveQueryTable('contracts', ctx)).toMatchObject({ physicalCollection: 'contracts', root: { kind: 'entity' } });
  });

  it('resolve tela do Form Design para a coleção de mesmo nome', () => {
    expect(resolveQueryTable('processos', ctx)).toMatchObject({
      physicalCollection: 'processos',
      root: { kind: 'entity', entityKey: 'processos' },
    });
  });

  it('resolve lookup para a própria coleção', () => {
    expect(resolveQueryTable('contractTypes', ctx)).toMatchObject({ physicalCollection: 'contractTypes', root: { kind: 'fields' } });
  });

  it('retorna null para tabela inexistente', () => {
    expect(resolveQueryTable('naoexiste', ctx)).toBeNull();
  });
});

describe('validateQuerySpec', () => {
  it('aceita projeções por FK e por campo customizado', () => {
    const issues = validateQuerySpec(
      spec({
        where: [{ path: 'status', op: 'eq', value: { kind: 'Literal', value: 'ativo' } }],
        projections: ['title', 'client.name', 'client.customValues.apelido'],
        orderBy: [{ path: 'title', dir: 'asc' }],
      }),
      ctx,
    );
    expect(issues).toEqual([]);
  });

  it('aceita projeção de campos de tela dinâmica', () => {
    const issues = validateQuerySpec(spec({ table: 'processos', projections: ['values.prioridade', 'title'] }), ctx);
    expect(issues).toEqual([]);
  });

  it('reprova tabela inexistente', () => {
    const issues = validateQuerySpec(spec({ table: 'inexistente' }), ctx);
    expect(issues).toHaveLength(1);
    expect(issues[0].field).toBe('table');
  });

  it('reprova subcampo de valor simples', () => {
    const issues = validateQuerySpec(spec({ projections: ['title.foo'] }), ctx);
    expect(issues.some((issue) => issue.field === 'projections[0]')).toBe(true);
  });

  it('aceita o campo de cada apontado numa FK múltipla, sem exigir a posição', () => {
    // O caminho atravessa a lista e colhe um valor por apontado — a pergunta que um agrupamento ou
    // um filtro de relatório faz sobre uma referência de vários.
    expect(validateQuerySpec(spec({ projections: ['contractor.name'] }), ctx)).toEqual([]);
    expect(validateQuerySpec(spec({ projections: ['contractor.0.name'] }), ctx)).toEqual([]);
  });

  it('exige valor em filtros que precisam de valor', () => {
    const issues = validateQuerySpec(spec({ where: [{ path: 'status', op: 'eq' }] }), ctx);
    expect(issues.some((issue) => issue.field === 'where[0].value')).toBe(true);
  });

  it('reprova limite não positivo', () => {
    const issues = validateQuerySpec(spec({ limit: 0 }), ctx);
    expect(issues.some((issue) => issue.field === 'limit')).toBe(true);
  });
});
