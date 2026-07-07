import type { ExpressionFunction } from '../FunctionRegistry';

const startOfDay = (date: Date): Date => {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
};

export const todayFn: ExpressionFunction = {
  name: 'today',
  call: (_args, context) => startOfDay(context.services.now()),
  description: 'Retorna a data de hoje (início do dia)',
  signature: 'today()',
  example: 'today() + 5',
  category: 'Data',
};

export const nowFn: ExpressionFunction = {
  name: 'now',
  call: (_args, context) => context.services.now(),
  description: 'Retorna a data e hora atual',
  signature: 'now()',
  example: 'now()',
  category: 'Data',
};
