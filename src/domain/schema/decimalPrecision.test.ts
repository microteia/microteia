import { describe, expect, it } from 'vitest';
import { roundDecimal, settleDecimal, sumDecimal } from './decimalPrecision';
import { evaluateFieldExpression } from './fieldExpression';
import { applyAggregationOp } from './aggregationSpec';

/**
 * Issue #48: a conta com dinheiro deixava resíduo binário — `0.1 + 0.2` dava `0.30000000000000004`, e
 * um lançamento com débito e crédito iguais ao centavo ficava desbalanceado para o `==`.
 */
const EMPTY = { value: null, data: {} };
const evaluate = (expression: string, data: Record<string, unknown> = {}) =>
  evaluateFieldExpression(expression, { value: null, data });

describe('assentar no decimal (#48)', () => {
  it('não é arredondamento para centavos: valor com 3 ou mais casas continua como foi escrito', () => {
    expect(settleDecimal(0.654)).toBe(0.654);
    expect(settleDecimal(0.123456789)).toBe(0.123456789);
    expect(evaluate('price * qty', { price: 0.654, qty: 3 })).toBe(1.962);
    expect(applyAggregationOp('sum', [0.654, 0.001])).toBe(0.655);
  });

  it('tira o resíduo da conta binária e não mexe em inteiro, nem nos grandes', () => {
    expect(settleDecimal(0.1 + 0.2)).toBe(0.3);
    expect(settleDecimal(1.1 * 3)).toBe(3.3);
    expect(settleDecimal(Number.MAX_SAFE_INTEGER)).toBe(Number.MAX_SAFE_INTEGER);
    expect(settleDecimal(2 ** 60)).toBe(2 ** 60);
    expect(settleDecimal(Number.NaN)).toBeNaN();
  });

  it('a soma de milhares de centavos dá o total exato', () => {
    const cents = Array.from({ length: 10_000 }, () => 0.1);
    expect(sumDecimal(cents)).toBe(1000);
    expect(cents.reduce((total, value) => total + value, 0)).not.toBe(1000);
  });

  it('round arredonda o decimal escrito, metade para longe do zero', () => {
    expect(roundDecimal(1.005, 2)).toBe(1.01);
    expect(roundDecimal(2.675, 2)).toBe(2.68);
    expect(roundDecimal(-2.5)).toBe(-3);
    expect(roundDecimal(2.5)).toBe(3);
    expect(roundDecimal(1234.5678, -2)).toBe(1200);
  });
});

describe('expressão de campo: o débito bate com o crédito (#48)', () => {
  it('0.1 + 0.2 == 0.3, e a comparação de totais não depende de round', () => {
    expect(evaluate('0.1 + 0.2 == 0.3', {})).toBe(true);
    expect(evaluate('debit == credit', { debit: 0.1 + 0.2, credit: 0.3 })).toBe(true);
    expect(evaluate('a + b + c', { a: 0.1, b: 0.2, c: 0.3 })).toBe(0.6);
    expect(evaluate('19.99 * 3', {})).toBe(59.97);
    expect(evaluate('1 - 0.9', {})).toBe(0.1);
  });

  it('o valor que já CHEGA com resíduo (gravado antes) também compara igual', () => {
    expect(evaluate('total == 0.3', { total: 0.30000000000000004 })).toBe(true);
    expect(evaluate('total <= 0.3', { total: 0.30000000000000004 })).toBe(true);
    expect(evaluate('total != 0.3', { total: 0.30000000000000004 })).toBe(false);
  });

  it('sum, avg e round seguem a mesma conta, e + continua concatenando texto', () => {
    expect(evaluate('sum(items)', { items: [0.1, 0.2, 0.3] })).toBe(0.6);
    expect(evaluate('avg(items)', { items: [0.1, 0.2] })).toBe(0.15);
    expect(evaluate('round(1.005, 2)', {})).toBe(1.01);
    expect(evaluateFieldExpression('concat("a", "b")', EMPTY)).toBe('ab');
  });
});

describe('campo agregado: o total é a soma das linhas ao centavo (#48)', () => {
  it('sum e avg sobre filhos monetários', () => {
    expect(applyAggregationOp('sum', [0.1, 0.2, 0.3])).toBe(0.6);
    expect(applyAggregationOp('sum', Array.from({ length: 5000 }, () => 0.01))).toBe(50);
    expect(applyAggregationOp('avg', [0.1, 0.2])).toBe(0.15);
  });
});
