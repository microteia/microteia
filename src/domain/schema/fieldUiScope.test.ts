import { describe, expect, it } from 'vitest';
import { buildFieldUiScope, EMPTY_FIELD_UI_STATE, FIELD_UI_RESERVED_VARIABLES } from './fieldUiScope';
import type { FieldUiState } from './fieldUiScope';
import { evaluateFieldBoolean } from './fieldExpression';

const hidden = (
  expr: string,
  values: Record<string, unknown>,
  ui: Partial<FieldUiState> = {},
): boolean =>
  evaluateFieldBoolean(expr, {
    value: null,
    data: buildFieldUiScope(values, { ...EMPTY_FIELD_UI_STATE, ...ui }),
  });

describe('buildFieldUiScope', () => {
  it('mantém os campos do registro e acrescenta a situação', () => {
    const scope = buildFieldUiScope({ status: 'ativo' }, { isNew: true, isDirty: true });
    expect(scope).toEqual({ status: 'ativo', isNew: true, isDirty: true });
  });

  it('não muta o escopo recebido', () => {
    const original = { status: 'ativo' };
    buildFieldUiScope(original, { isNew: true, isDirty: true });
    expect(original).toEqual({ status: 'ativo' });
  });

  it('todo nome reservado vence um campo de mesma chave', () => {
    const scope = buildFieldUiScope(
      { isNew: 'texto do escritório', isDirty: 'outro texto' },
      EMPTY_FIELD_UI_STATE,
    );
    expect(scope.isNew).toBe(false);
    expect(scope.isDirty).toBe(false);
  });

  it('o estado vazio é o registro já existente e intocado', () => {
    expect(EMPTY_FIELD_UI_STATE).toEqual({ isNew: false, isDirty: false });
  });

  it('a lista de reservados é o que o autocomplete oferece', () => {
    expect([...FIELD_UI_RESERVED_VARIABLES]).toEqual(['isNew', 'isDirty']);
  });

  it('cada reservado está de fato no escopo — a lista não é prosa solta', () => {
    const scope = buildFieldUiScope({}, EMPTY_FIELD_UI_STATE);
    for (const name of FIELD_UI_RESERVED_VARIABLES) {
      expect(scope).toHaveProperty(name);
    }
  });
});

describe('`isNew` na expressão de campo', () => {
  it('esconde o campo só na criação', () => {
    expect(hidden('isNew', {}, { isNew: true })).toBe(true);
    expect(hidden('isNew', {}, { isNew: false })).toBe(false);
  });

  it('esconde o campo só na edição', () => {
    expect(hidden('not isNew', {}, { isNew: true })).toBe(false);
    expect(hidden('not isNew', {}, { isNew: false })).toBe(true);
  });

  it('combina com os campos do registro', () => {
    const expr = 'isNew or status == "Concluído"';
    expect(hidden(expr, { status: 'Aberto' }, { isNew: true })).toBe(true);
    expect(hidden(expr, { status: 'Aberto' }, { isNew: false })).toBe(false);
    expect(hidden(expr, { status: 'Concluído' }, { isNew: false })).toBe(true);
  });

  it('sem o escopo de UI, a mesma expressão era um `false` mudo — o defeito que isto corrige', () => {
    expect(evaluateFieldBoolean('isNew', { value: null, data: {} })).toBe(false);
    expect(evaluateFieldBoolean('isDirty', { value: null, data: {} })).toBe(false);
  });
});

describe('`isDirty` na expressão de campo', () => {
  it('responde ao formulário já alterado', () => {
    expect(hidden('isDirty', {}, { isDirty: true })).toBe(true);
    expect(hidden('isDirty', {}, { isDirty: false })).toBe(false);
  });

  it('é ortogonal a `isNew` — as quatro combinações se distinguem', () => {
    const expr = 'isNew and not isDirty';
    expect(hidden(expr, {}, { isNew: true, isDirty: false })).toBe(true);
    expect(hidden(expr, {}, { isNew: true, isDirty: true })).toBe(false);
    expect(hidden(expr, {}, { isNew: false, isDirty: false })).toBe(false);
    expect(hidden(expr, {}, { isNew: false, isDirty: true })).toBe(false);
  });
});
