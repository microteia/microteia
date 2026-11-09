import { describe, expect, it } from 'vitest';
import type { FieldDefinition } from '../entities/entitySchemas';
import {
  findOptionsFilterViolations,
  formOptionsFilter,
  keepOptionsFilterValue,
  matchesOptionsFilter,
  optionsFilterCascade,
  optionsFilterSourceKeys,
  resolveOptionsFilter,
} from './optionsFilter';
import type { OptionsFilterCandidateOf } from './optionsFilter';
import { startsWithValue } from './predicateMatch';

const field = (overrides: Partial<FieldDefinition> & Pick<FieldDefinition, 'key'>): FieldDefinition => ({
  label: overrides.key,
  origin: 'design',
  type: 'text',
  required: false,
  order: 0,
  ...overrides,
});

const breeds: Record<string, Record<string, unknown>> = {
  labrador: { id: 'labrador', name: 'Labrador', petType: 'dog' },
  poodle: { id: 'poodle', name: 'Poodle', petType: 'dog' },
  siamese: { id: 'siamese', name: 'Siamese', petType: 'cat' },
};

const geo: Record<string, Record<string, unknown>> = {
  sp: { id: 'sp', name: 'São Paulo', country: 'br' },
  ny: { id: 'ny', name: 'New York', country: 'us' },
  campinas: { id: 'campinas', name: 'Campinas', stateId: 'sp' },
  buffalo: { id: 'buffalo', name: 'Buffalo', stateId: 'ny' },
};

const records: OptionsFilterCandidateOf = (target, value) => {
  if (target.type === 'select') return { key: value, label: value.toUpperCase() };
  const table = target.refEntity === 'breeds' ? breeds : geo;
  return table[value] ?? null;
};

const petType = field({ key: 'petType', type: 'select', options: [{ key: 'dog', label: 'Dog' }, { key: 'cat', label: 'Cat' }] });
const breed = field({
  key: 'breedId',
  type: 'reference',
  refEntity: 'breeds',
  optionsFilter: { where: [{ path: 'petType', op: 'eq', value: { field: 'petType' } }] },
});

const country = field({ key: 'country', type: 'select' });
const state = field({
  key: 'stateId',
  type: 'reference',
  refEntity: 'states',
  optionsFilter: { where: [{ path: 'country', op: 'eq', value: { field: 'country' } }] },
});
const city = field({
  key: 'cityId',
  type: 'reference',
  refEntity: 'cities',
  optionsFilter: { where: [{ path: 'stateId', op: 'eq', value: { field: 'stateId' } }] },
});

const identityScope = (values: Record<string, unknown>): Record<string, unknown> => values;

describe('optionsFilter — resolução', () => {
  it('sem declaração não há filtro, e tudo é oferecido como antes', () => {
    expect(resolveOptionsFilter(undefined, {})).toBeNull();
    expect(resolveOptionsFilter({ where: [] }, {})).toBeNull();
  });

  it('origem vazia bloqueia: nenhuma opção passa', () => {
    const filter = resolveOptionsFilter(breed.optionsFilter, { petType: '' });
    expect(filter).toEqual({ blocked: true, predicates: [] });
    expect(matchesOptionsFilter(breeds.labrador, filter!)).toBe(false);
  });

  it('filtra pelo valor do campo do formulário', () => {
    const filter = resolveOptionsFilter(breed.optionsFilter, { petType: 'dog' })!;
    const offered = Object.values(breeds).filter((one) => matchesOptionsFilter(one, filter)).map((one) => one.id);
    expect(offered).toEqual(['labrador', 'poodle']);
  });

  it('aceita valor fixo e caminho que atravessa a referência', () => {
    const fixed = resolveOptionsFilter({ where: [{ path: 'petType', op: 'neq', value: { literal: 'dog' } }] }, {})!;
    expect(matchesOptionsFilter(breeds.siamese, fixed)).toBe(true);
    const through = resolveOptionsFilter(
      { where: [{ path: 'country', op: 'eq', value: { field: 'client.country' } }] },
      { client: { id: 'c1', country: 'br' } },
    )!;
    expect(matchesOptionsFilter(geo.sp, through)).toBe(true);
    expect(matchesOptionsFilter(geo.ny, through)).toBe(false);
  });

  it('a origem que é referência compara pelo id do registro apontado', () => {
    const filter = resolveOptionsFilter(city.optionsFilter, { stateId: geo.sp })!;
    expect(matchesOptionsFilter(geo.campinas, filter)).toBe(true);
    expect(matchesOptionsFilter(geo.buffalo, filter)).toBe(false);
  });

  it('lista de opções: começa com e contém, sem diferenciar maiúscula', () => {
    const prefix = resolveOptionsFilter({ where: [{ path: 'key', op: 'startsWith', value: { field: 'region' } }] }, { region: 'br' })!;
    expect(matchesOptionsFilter({ key: 'BR-politics', label: 'Politics' }, prefix)).toBe(true);
    expect(matchesOptionsFilter({ key: 'us-politics', label: 'Politics' }, prefix)).toBe(false);
    const inside = resolveOptionsFilter({ where: [{ path: 'label', op: 'contains', value: { literal: 'sport' } }] }, {})!;
    expect(matchesOptionsFilter({ key: 'x', label: 'Motorsport' }, inside)).toBe(true);
  });

  it('as chaves de origem são as de topo, uma vez cada', () => {
    expect(optionsFilterSourceKeys({
      where: [
        { path: 'a', op: 'eq', value: { field: 'client.city' } },
        { path: 'b', op: 'eq', value: { field: 'client' } },
        { path: 'c', op: 'eq', value: { literal: 'x' } },
      ],
    })).toEqual(['client']);
  });
});

describe('startsWithValue', () => {
  it('só responde sim entre textos, e item a item numa lista', () => {
    expect(startsWithValue('Labrador', 'lab')).toBe(true);
    expect(startsWithValue(['x', 'Labrador'], 'LAB')).toBe(true);
    expect(startsWithValue('Labrador', ['po', 'la'])).toBe(true);
    expect(startsWithValue(42, '4')).toBe(false);
  });
});

describe('optionsFilter — no formulário', () => {
  it('não aplica o filtro cuja origem não está no formulário', () => {
    expect(formOptionsFilter(breed, new Set(['breedId']), { petType: 'dog' })).toBeNull();
    expect(formOptionsFilter(breed, new Set(['breedId', 'petType']), { petType: 'dog' })).not.toBeNull();
  });

  it('não aplica o filtro num tipo de campo que não oferece opções', () => {
    const text = field({ key: 'note', optionsFilter: breed.optionsFilter });
    expect(formOptionsFilter(text, new Set(['note', 'petType']), { petType: 'dog' })).toBeNull();
  });

  it('mantém a opção desconhecida e descarta a que não passa', () => {
    const filter = resolveOptionsFilter(breed.optionsFilter, { petType: 'cat' })!;
    expect(keepOptionsFilterValue(breed, 'labrador', filter, records)).toBeNull();
    expect(keepOptionsFilterValue(breed, 'siamese', filter, records)).toBe('siamese');
    expect(keepOptionsFilterValue(breed, 'not-loaded', filter, records)).toBe('not-loaded');
    const multi = field({ ...breed, multi: true });
    expect(keepOptionsFilterValue(multi, ['labrador', 'siamese'], filter, records)).toEqual(['siamese']);
  });

  it('a validação aponta o campo cuja escolha o filtro não oferece', () => {
    const values = { petType: 'cat', breedId: 'poodle' };
    expect(findOptionsFilterViolations([petType, breed], values, values, records).map((one) => one.key)).toEqual(['breedId']);
    const fine = { petType: 'dog', breedId: 'poodle' };
    expect(findOptionsFilterViolations([petType, breed], fine, fine, records)).toEqual([]);
  });

  it('trocar o tipo limpa a raça', () => {
    const changes = optionsFilterCascade([petType, breed], 'petType', { petType: 'cat', breedId: 'poodle' }, identityScope, records);
    expect(changes).toEqual([{ key: 'breedId', value: null }]);
  });

  it('a limpeza segue a cadeia país → estado → cidade', () => {
    const fields = [country, state, city];
    const changes = optionsFilterCascade(
      fields,
      'country',
      { country: 'us', stateId: 'sp', cityId: 'campinas' },
      identityScope,
      records,
    );
    expect(changes).toEqual([{ key: 'stateId', value: null }, { key: 'cityId', value: null }]);
  });

  it('a alteração que mantém a escolha válida não limpa nada', () => {
    expect(optionsFilterCascade([petType, breed], 'petType', { petType: 'dog', breedId: 'poodle' }, identityScope, records)).toEqual([]);
    expect(optionsFilterCascade([petType, breed], 'breedId', { petType: 'cat', breedId: 'poodle' }, identityScope, records)).toEqual([]);
  });
});
