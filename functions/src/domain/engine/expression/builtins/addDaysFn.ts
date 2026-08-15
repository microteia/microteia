import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
const addDays = (date: Date, days: number): Date => {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
};

export const addDaysFn: ExpressionFunction = {
  name: 'addDays',
  call: ([date, days]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.first.date', { fn: 'addDays' });
    }
    if (typeof days !== 'number') {
      throw new LocalizedError('@core.automation/expr.arg.second.number', { fn: 'addDays' });
    }
    return addDays(date, days);
  },
  description: '@core.automation/expr.addDays.description',
  signature: 'addDays(date, dayCount)',
  example: 'addDays(today(), 5)',
  category: '@core.automation/expr.category.date',
  minArgs: 2,
  maxArgs: 2,
};
