import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import { buildHydratedFieldScope } from './referenceScope';
import type { RecordResolver } from './referenceScope';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key' | 'label'>): FieldDefinition => ({
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const fields: FieldDefinition[] = [
  field({ key: 'descricao', label: 'Descrição' }),
  field({ key: 'produto', label: 'Produto', type: 'reference', refEntity: 'produtos' }),
  field({ key: 'tags', label: 'Tags', type: 'reference', refEntity: 'produtos', multi: true }),
];

const catalogo: Record<string, Record<string, unknown>> = {
  p1: { nome: 'Teclado', preco: 49.9 },
  p2: { nome: 'Mouse', preco: 30 },
};

const resolve: RecordResolver = (refEntity, id) =>
  refEntity === 'produtos' ? (catalogo[id] ?? null) : null;

describe('buildHydratedFieldScope', () => {
  it('troca o id pelo registro, preservando o id acessível', () => {
    const scope = buildHydratedFieldScope(fields, { produto: 'p1' }, resolve);
    expect(scope.produto).toEqual({ id: 'p1', nome: 'Teclado', preco: 49.9 });
  });

  it('hidrata cada item de uma referência múltipla', () => {
    const scope = buildHydratedFieldScope(fields, { tags: ['p1', 'p2'] }, resolve);
    expect(scope.tags).toEqual([
      { id: 'p1', nome: 'Teclado', preco: 49.9 },
      { id: 'p2', nome: 'Mouse', preco: 30 },
    ]);
  });

  it('mantém o id cru quando o registro não está carregado', () => {
    const scope = buildHydratedFieldScope(fields, { produto: 'desconhecido' }, resolve);
    expect(scope.produto).toBe('desconhecido');
  });

  it('referência vazia continua vazia — isEmpty/isNull seguem corretos', () => {
    expect(buildHydratedFieldScope(fields, { produto: '' }, resolve).produto).toBe('');
    expect(buildHydratedFieldScope(fields, { produto: null }, resolve).produto).toBe(null);
    expect(buildHydratedFieldScope(fields, {}, resolve).produto).toBeUndefined();
  });

  it('campos que não são referência passam intactos', () => {
    const scope = buildHydratedFieldScope(fields, { descricao: 'abc', produto: 'p1' }, resolve);
    expect(scope.descricao).toBe('abc');
  });

  it('sem campos de referência, devolve o objeto original', () => {
    const values = { a: 1 };
    expect(buildHydratedFieldScope([field({ key: 'a', label: 'A' })], values, resolve)).toBe(values);
  });
});
