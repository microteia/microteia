import { describe, expect, it } from 'vitest';
import { setValueByPath } from './customFieldValues';
import type { CustomFieldValue } from '../entities/entitySchemas';

type Values = Record<string, CustomFieldValue>;
const asValues = (obj: unknown): Values => obj as Values;

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
