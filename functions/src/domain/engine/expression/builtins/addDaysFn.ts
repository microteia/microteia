import type { ExpressionFunction } from '../FunctionRegistry';

const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const addDaysFn: ExpressionFunction = {
  name: 'addDays',
  call: ([date, days]) => {
    if (!(date instanceof Date)) {
      throw new Error('addDays: primeiro argumento deve ser uma Date');
    }
    if (typeof days !== 'number') {
      throw new Error('addDays: segundo argumento deve ser um número');
    }
    return addDays(date, days);
  },
  description: 'Adiciona dias a uma data',
  signature: 'addDays(data, numeroDeDias)',
  example: 'addDays(today(), 5)',
  category: 'Data',
};
