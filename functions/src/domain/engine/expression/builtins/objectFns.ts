import type { ExpressionFunction } from '../FunctionRegistry';

import { LocalizedError } from '../../../errors/LocalizedError';
export const objectFn: ExpressionFunction = {
  name: 'object',
  call: (args) => {
    if (args.length % 2 !== 0) {
      throw new LocalizedError('@core.automation/expr.arg.even-count', { fn: 'object' });
    }
    const result: Record<string, unknown> = {};
    for (let i = 0; i + 1 < args.length; i += 2) {
      result[String(args[i])] = args[i + 1];
    }
    return result;
  },
  description: '@core.automation/expr.object.description',
  signature: 'object(key, value, ...)',
  example: 'object("name", event.client.name, "message", "hello")',
  category: '@core.automation/expr.category.operator',
  minArgs: 0,
};

export const deleteFn: ExpressionFunction = {
  name: 'delete',
  call: ([key, obj]) => {
    if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
      return obj;
    }
    const clone = { ...(obj as Record<string, unknown>) };
    delete clone[String(key)];
    return clone;
  },
  description: '@core.automation/expr.delete.description',
  signature: 'delete(key, object)',
  example: 'delete("name", event)',
  category: '@core.automation/expr.category.operator',
  minArgs: 2,
  maxArgs: 2,
};
