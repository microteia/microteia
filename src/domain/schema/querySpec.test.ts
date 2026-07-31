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

const dynamicScreen: SchemaScreen = {
  id: 'processos',
  titleSingular: 'Processo',
  titleFieldKey: 'titulo',
  fields: [{ key: 'prioridade', label: 'Prioridade', type: 'text', required: false, order: 0, origin: 'design' }],
};

const ctx = createSchemaContext([personsScreen, dynamicScreen]);

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

  it('reprova FK múltipla sem índice', () => {
    const issues = validateQuerySpec(spec({ projections: ['contractor.name'] }), ctx);
    expect(issues.some((issue) => issue.field === 'projections[0]')).toBe(true);
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
