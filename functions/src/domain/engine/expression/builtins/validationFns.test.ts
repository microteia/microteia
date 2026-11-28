import { describe, expect, it } from 'vitest';
import { formatCNPJFn, isCNPJFn } from './validationFns';
import type { ExpressionFunction } from '../FunctionRegistry';
import type { WorkflowContext } from '../../../entities/WorkflowContext';

/**
 * Issue #52: o motor das automações tinha a própria conta do CNPJ, que tirava as letras antes de somar
 * — o CNPJ alfanumérico passava numa regra de campo e falhava no `isCNPJ` de uma automação.
 */
const call = (fn: ExpressionFunction, value: unknown) => fn.call([value], {} as WorkflowContext);

describe('isCNPJ e formatCNPJ das automações aceitam o CNPJ alfanumérico (#52)', () => {
  it('isCNPJ segue a conta compartilhada: alfanumérico, numérico e dígito errado', () => {
    expect(call(isCNPJFn, '12.ABC.345/01DE-35')).toBe(true);
    expect(call(isCNPJFn, '11222333000181')).toBe(true);
    expect(call(isCNPJFn, '12ABC34501DE36')).toBe(false);
  });

  it('formatCNPJ formata o alfanumérico em maiúsculas e mantém o numérico', () => {
    expect(call(formatCNPJFn, '12abc34501de35')).toBe('12.ABC.345/01DE-35');
    expect(call(formatCNPJFn, '11222333000181')).toBe('11.222.333/0001-81');
  });
});
