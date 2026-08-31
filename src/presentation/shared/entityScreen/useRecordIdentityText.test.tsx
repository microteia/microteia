// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { renderHook } from '@testing-library/react';
import { useRecordIdentityText } from './useRecordIdentityText';
import type { FieldDefinition, ScreenDefinition } from '../../../domain/entities';
import type { CustomFieldListing } from '../../hooks/useCustomFieldListing';

const field = (overrides: Partial<FieldDefinition>): FieldDefinition => ({
  key: 'name',
  label: 'Nome',
  type: 'text',
  required: false,
  order: 0,
  origin: 'design',
  ...overrides,
});

const FIELDS = [
  field({}),
  field({ key: 'tutor', label: 'Tutor', type: 'reference', refEntity: 'tutores', order: 1 }),
  field({ key: 'especie', label: 'Espécie', type: 'select', order: 2 }),
];

/** O que a listagem faz: relação e seleção viram RÓTULO, e o valor ausente vira travessão. */
const displayValue: CustomFieldListing['displayValue'] = (values, target) => {
  const raw = (values as Record<string, unknown> | undefined)?.[target.key];
  if (raw === undefined || raw === '') return '—';
  if (target.key === 'tutor') return raw === 'BnUQ236xn6k16FTlcwfQ' ? 'Alex' : '—';
  if (target.key === 'especie') return raw === 'dog' ? 'Cachorro' : '—';
  return String(raw);
};

const screen = (overrides: Partial<ScreenDefinition>): ScreenDefinition => ({
  id: 'pets',
  titleFieldKey: 'name',
  fields: FIELDS,
  ...overrides,
}) as ScreenDefinition;

const identidade = (definition: ScreenDefinition) =>
  renderHook(() => useRecordIdentityText(definition, FIELDS, displayValue)).result.current;

/**
 * A relação guarda o ID do registro apontado e a seleção guarda a chave da opção — nenhum dos dois é
 * o que se lê. O cartão da listagem resolvia; o cabeçalho do detalhe e o rótulo da aba liam o valor
 * cru, e o mesmo pet aparecia como "Alex" na lista e como `BnUQ236xn6k16FTlcwfQ` no detalhe.
 */
describe('useRecordIdentityText', () => {
  const amora = { name: 'Amora', tutor: 'BnUQ236xn6k16FTlcwfQ', especie: 'dog' };

  it('o subtítulo de RELAÇÃO chega como o nome do registro apontado, não como o id', () => {
    expect(identidade(screen({ subtitleFieldKey: 'tutor' })).subtitleOf(amora)).toBe('Alex');
  });

  it('o subtítulo de SELEÇÃO chega como o rótulo da opção, não como a chave', () => {
    expect(identidade(screen({ subtitleFieldKey: 'especie' })).subtitleOf(amora)).toBe('Cachorro');
  });

  it('o título segue a MESMA regra, para as três portas concordarem', () => {
    expect(identidade(screen({ titleFieldKey: 'tutor' })).titleOf(amora)).toBe('Alex');
    expect(identidade(screen({ titleFieldKey: 'name' })).titleOf(amora)).toBe('Amora');
  });

  it('campo de texto vem cru, e o ausente vira vazio — nunca o travessão da listagem', () => {
    const vm = identidade(screen({ subtitleFieldKey: 'tutor' }));

    expect(vm.subtitleOf({ name: 'Amora' })).toBe('');
    expect(vm.titleOf({})).toBe('');
  });

  it('a tela que não declara subtítulo não inventa um', () => {
    expect(identidade(screen({})).subtitleOf(amora)).toBe('');
  });
});
