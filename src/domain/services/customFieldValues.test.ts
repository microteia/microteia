import { describe, expect, it } from 'vitest';
import { buildInitialFormValues, setValueByPath } from './customFieldValues';
import type { CustomFieldValue, FieldDefinition } from '../entities/entitySchemas';

type Values = Record<string, CustomFieldValue>;
const asValues = (obj: unknown): Values => obj as Values;

const dateField: FieldDefinition = {
  key: 'filedAt',
  label: 'Data de distribuição',
  type: 'date',
  required: false,
  order: 0,
  origin: 'design',
};

describe('buildInitialFormValues — campo de data', () => {
  it('traz a Date gravada de volta para o controle do formulário', () => {
    const form = buildInitialFormValues([dateField], { filedAt: new Date(2026, 6, 15) });
    expect(form.filedAt).toBe('2026-07-15');
  });

  it('aceita o Timestamp cru do Firestore', () => {
    const stored = { filedAt: { toDate: () => new Date(2026, 6, 15) } };
    expect(buildInitialFormValues([dateField], stored).filedAt).toBe('2026-07-15');
  });

  it('registro sem a data abre com o campo vazio', () => {
    expect(buildInitialFormValues([dateField], {}).filedAt).toBe('');
    expect(buildInitialFormValues([dateField], { filedAt: null }).filedAt).toBe('');
  });
});

describe('setValueByPath', () => {
  it('grava chave simples no topo (imutável)', () => {
    const before: Values = { name: 'Ana' };
    const after = setValueByPath(before, 'name', 'Bia');
    expect(after).toEqual({ name: 'Bia' });
    expect(before).toEqual({ name: 'Ana' });
  });

  it('cria o ramo aninhado quando ausente', () => {
    const after = setValueByPath({}, 'address.street', 'Rua A');
    expect(after).toEqual({ address: { street: 'Rua A' } });
  });

  it('mescla no ramo aninhado existente sem perder irmãos', () => {
    const before = asValues({ address: { street: 'Rua A', city: 'SP' } });
    const after = setValueByPath(before, 'address.city', 'RJ');
    expect(after).toEqual({ address: { street: 'Rua A', city: 'RJ' } });
    expect(before).toEqual({ address: { street: 'Rua A', city: 'SP' } });
  });

  it('preserva outras chaves de topo', () => {
    const before = asValues({ name: 'Ana', address: { street: 'Rua A' } });
    const after = setValueByPath(before, 'address.number', '10');
    expect(after).toEqual({ name: 'Ana', address: { street: 'Rua A', number: '10' } });
  });

  it('substitui um valor não-objeto por um ramo ao aprofundar', () => {
    const before = asValues({ address: 'x' });
    const after = setValueByPath(before, 'address.street', 'Rua A');
    expect(after).toEqual({ address: { street: 'Rua A' } });
  });
});
