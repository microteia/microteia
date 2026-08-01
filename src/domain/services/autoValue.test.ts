import { describe, expect, it } from 'vitest';
import { autoValueFields, generateAutoValue, hasGeneratedSymbol } from './autoValue';
import type { FieldDefinition } from '../entities';

const field = (key: string, pattern?: string): FieldDefinition => ({
  key,
  label: key,
  type: 'text',
  required: false,
  order: 0,
  origin: 'plugin',
  ...(pattern === undefined ? {} : { autoValue: { pattern } }),
});

describe('generateAutoValue', () => {
  /** O formato do número de contrato que a tela fixa sorteava em código: duas letras + quatro dígitos. */
  it('respeita o padrão símbolo a símbolo', () => {
    expect(generateAutoValue('AA0000')).toMatch(/^[A-Z]{2}\d{4}$/);
    expect(generateAutoValue('CT-0000/A')).toMatch(/^CT-\d{4}\/[A-Z]$/);
    expect(generateAutoValue('****')).toMatch(/^[A-Z0-9]{4}$/);
  });

  it('não devolve um código já usado', () => {
    const taken = new Set(['A0', 'A1', 'A2', 'A3', 'A4', 'A5', 'A6', 'A7', 'A8']);
    for (let i = 0; i < 30; i += 1) {
      const value = generateAutoValue('A0', taken);
      if (value.startsWith('A')) expect(taken.has(value)).toBe(false);
    }
  });

  /** Espaço esgotado devolve um valor mesmo assim: o formulário não pode travar por isso. */
  it('padrão sem espaço livre ainda devolve um código', () => {
    const taken = new Set(DIGITS_TAKEN);
    expect(generateAutoValue('0', taken)).toHaveLength(1);
  });

  it('padrão sem símbolo variável fica como está', () => {
    expect(hasGeneratedSymbol('CT-')).toBe(false);
    expect(generateAutoValue('CT-')).toBe('CT-');
  });
});

const DIGITS_TAKEN = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];

describe('autoValueFields', () => {
  it('lista só os campos que declaram um padrão utilizável', () => {
    const fields = [field('number', 'AA0000'), field('title'), field('code', '   '), field('fixed', 'CT')];
    expect(autoValueFields(fields)).toEqual([{ key: 'number', pattern: 'AA0000' }]);
  });
});
