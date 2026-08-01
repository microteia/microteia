import { describe, expect, it } from 'vitest';
import type { ActionExprContext } from './actionExpression';
import { actionActiveState, isActionDisabled, isActionHidden } from './actionExpression';

const ctx = (values: Record<string, unknown>, overrides: Partial<ActionExprContext> = {}): ActionExprContext => ({
  values,
  record: values,
  isNew: false,
  isDirty: false,
  role: 'admin',
  ...overrides,
});

/**
 * `surface` diz ONDE a ação está sendo desenhada. A mesma ação faz sentidos diferentes conforme o
 * lugar: dentro da aba de outro registro, uma ação destrutiva é lida como "tirar daqui" quando na
 * verdade apaga o registro inteiro. Declarada, a extensão decide sozinha onde a ação não cabe.
 */
describe('surface — onde a ação aparece', () => {
  it('sem declaração, a superfície é o detalhe', () => {
    expect(isActionHidden('surface == "detail"', ctx({}))).toBe(true);
  });

  it('a ação se esconde dentro da aba de um pai', () => {
    const naAba = ctx({}, { surface: 'parentTab' });
    expect(isActionHidden('surface == "parentTab"', naAba)).toBe(true);
    expect(isActionHidden('surface == "parentTab"', ctx({}, { surface: 'list' }))).toBe(false);
  });

  /** Campo do registro chamado `surface` não sequestra a variável reservada. */
  it('a variável reservada vence um campo de mesmo nome', () => {
    expect(isActionHidden('surface == "list"', ctx({ surface: 'detail' }, { surface: 'list' }))).toBe(true);
  });
});

/**
 * `relation` é ortogonal a `surface`: aquela diz ONDE a ação aparece, esta diz O QUE o registro é
 * para o pai da aba — e é a diferença entre apagar o registro e apenas desligá-lo do pai.
 */
describe('relation — o que o registro é para o pai', () => {
  it('sem declaração, o registro não está dentro da aba de ninguém', () => {
    expect(isActionHidden('relation == "none"', ctx({}))).toBe(true);
  });

  it('distingue o filho do relacionado', () => {
    expect(isActionHidden('relation == "related"', ctx({}, { relation: 'related' }))).toBe(true);
    expect(isActionHidden('relation == "related"', ctx({}, { relation: 'owned' }))).toBe(false);
  });
});

describe('isActionHidden / isActionDisabled', () => {
  it('sem expressão, a ação aparece e está habilitada', () => {
    expect(isActionHidden(undefined, ctx({}))).toBe(false);
    expect(isActionDisabled(null, ctx({}))).toBe(false);
  });

  /** É assim que uma ação que opera sobre o registro se esconde enquanto ele não existe. */
  it('esconde a ação num registro novo', () => {
    expect(isActionHidden('isNew', ctx({}, { isNew: true }))).toBe(true);
    expect(isActionHidden('isNew', ctx({}, { isNew: false }))).toBe(false);
  });
});

/**
 * `activeWhen` é o que transforma um botão de ação num INTERRUPTOR: ele passa a mostrar o estado do
 * registro. `undefined` (sem declaração) é diferente de `false` — um é "não é interruptor", o outro
 * é "interruptor desligado".
 */
describe('actionActiveState', () => {
  it('sem declaração, a ação não é um interruptor', () => {
    expect(actionActiveState(undefined, ctx({ status: 'Ativo' }))).toBeUndefined();
    expect(actionActiveState('  ', ctx({ status: 'Ativo' }))).toBeUndefined();
  });

  it('liga e desliga pelo valor do registro', () => {
    expect(actionActiveState('status != "Inativo"', ctx({ status: 'Ativo' }))).toBe(true);
    expect(actionActiveState('status != "Inativo"', ctx({ status: 'Inativo' }))).toBe(false);
  });

  /**
   * Registro sem o campo: a expressão não resolve e o interruptor fica DESLIGADO — a mesma leitura
   * que o botão em código dava (`status === 'Ativo'`), e a mais segura: um estado desconhecido não
   * se apresenta como ligado.
   */
  it('registro sem o campo fica desligado', () => {
    expect(actionActiveState('status != "Inativo"', ctx({}))).toBe(false);
  });
});
