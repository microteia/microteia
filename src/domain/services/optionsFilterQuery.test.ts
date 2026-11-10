import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities';
import { resolveOptionsFilter } from '../schema/optionsFilter';
import type { OptionsFilterSpec } from '../schema/optionsFilter';
import { optionsFilterRecordQuery } from './optionsFilterQuery';
import { RECORD_LIST_FILTER_WINDOW } from './recordListQuery';

const reference = (refEntity: string, optionsFilter: OptionsFilterSpec): FieldDefinition => ({
  key: 'targetId',
  label: 'Target',
  type: 'reference',
  refEntity,
  required: false,
  order: 0,
  origin: 'design',
  optionsFilter,
});

describe('optionsFilterRecordQuery', () => {
  it('a igualdade sobre campo de topo vira consulta no servidor', () => {
    const field = reference('breeds', { where: [{ path: 'petType', op: 'eq', value: { field: 'petType' } }] });
    const spec = optionsFilterRecordQuery(field, resolveOptionsFilter(field.optionsFilter, { petType: 'dog' }));
    expect(spec).toEqual({
      collection: 'breeds',
      limit: RECORD_LIST_FILTER_WINDOW,
      anyOf: [],
      allOf: [{ field: 'petType', op: '==', value: 'dog' }],
      range: null,
      orderBy: null,
    });
  });

  it('a origem hidratada desce pelo id', () => {
    const field = reference('cities', { where: [{ path: 'stateId', op: 'eq', value: { field: 'stateId' } }] });
    const spec = optionsFilterRecordQuery(field, resolveOptionsFilter(field.optionsFilter, { stateId: { id: 'sp', name: 'SP' } }));
    expect(spec?.allOf).toEqual([{ field: 'stateId', op: '==', value: 'sp' }]);
  });

  it('nada a consultar: sem igualdade, caminho aninhado, origem vazia ou membros', () => {
    const prefix = reference('breeds', { where: [{ path: 'name', op: 'startsWith', value: { literal: 'L' } }] });
    expect(optionsFilterRecordQuery(prefix, resolveOptionsFilter(prefix.optionsFilter, {}))).toBeNull();
    const nested = reference('breeds', { where: [{ path: 'group.kind', op: 'eq', value: { literal: 'x' } }] });
    expect(optionsFilterRecordQuery(nested, resolveOptionsFilter(nested.optionsFilter, {}))).toBeNull();
    const empty = reference('breeds', { where: [{ path: 'petType', op: 'eq', value: { field: 'petType' } }] });
    expect(optionsFilterRecordQuery(empty, resolveOptionsFilter(empty.optionsFilter, {}))).toBeNull();
    const members = reference('members', { where: [{ path: 'team', op: 'eq', value: { literal: 'a' } }] });
    expect(optionsFilterRecordQuery(members, resolveOptionsFilter(members.optionsFilter, {}))).toBeNull();
  });
});
