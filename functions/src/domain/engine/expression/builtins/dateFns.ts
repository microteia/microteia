import type { ExpressionFunction } from '../FunctionRegistry';
import { anchorDay } from '../../../schema/mutationSpec';

import { LocalizedError } from '../../../errors/LocalizedError';
const formatDate = (date: Date, format: string): string => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const seconds = String(date.getSeconds()).padStart(2, '0');

  return format
    .replace('YYYY', String(year))
    .replace('MM', month)
    .replace('DD', day)
    .replace('HH', hours)
    .replace('mm', minutes)
    .replace('ss', seconds);
};

const dayOfWeek = (date: Date): number => date.getDay();

const isWeekend = (date: Date): boolean => {
  const day = date.getDay();
  return day === 0 || day === 6;
};

const dateDiff = (date1: Date, date2: Date, unit: string): number => {
  const diffMs = date1.getTime() - date2.getTime();
  switch (unit.toLowerCase()) {
    case 'days':
    case 'dias':
      return Math.floor(diffMs / (1000 * 60 * 60 * 24));
    case 'hours':
    case 'horas':
      return Math.floor(diffMs / (1000 * 60 * 60));
    case 'minutes':
    case 'minutos':
      return Math.floor(diffMs / (1000 * 60));
    case 'seconds':
    case 'segundos':
      return Math.floor(diffMs / 1000);
    default:
      throw new LocalizedError(
        '@core.automation/expr.date-diff.unknown-unit',
        { unit: String(unit) },
      );
  }
};

/**
 * `today()` devolve um DIA — quem quer o instante tem `now()`. Por isso ele cai na mesma âncora de
 * uma data digitada (meio-dia em UTC): carimbado em `completedAt`, `paymentDate` ou `cancelDate`, o
 * dia que se lê na tela é o dia em que a automação rodou. Antes era meia-noite do fuso do SERVIDOR
 * (UTC), que no escritório é o dia anterior — concluir um prazo hoje registrava ontem.
 *
 * O dia é o dia UTC: entre 21h e a meia-noite no horário de Brasília o servidor já virou a página, e
 * `today()` devolve o dia seguinte. Resolver isso de vez pede o fuso do escritório, que hoje não é
 * declarado em lugar nenhum.
 */
export const todayFn: ExpressionFunction = {
  name: 'today',
  call: (_args, context) => anchorDay(context.services.now()),
  description: '@core.automation/expr.today.description',
  signature: 'today()',
  example: 'today()',
  category: '@core.automation/expr.category.date',
  minArgs: 0,
  maxArgs: 0,
};

export const nowFn: ExpressionFunction = {
  name: 'now',
  call: (_args, context) => context.services.now(),
  description: '@core.automation/expr.now.description',
  signature: 'now()',
  example: 'now()',
  category: '@core.automation/expr.category.date',
  minArgs: 0,
  maxArgs: 0,
};

export const formatDateFn: ExpressionFunction = {
  name: 'formatDate',
  call: ([date, format]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.first.date', { fn: 'formatDate' });
    }
    if (typeof format !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.second.string', { fn: 'formatDate' });
    }
    return formatDate(date, format);
  },
  description: '@core.automation/expr.formatDate.description',
  signature: 'formatDate(date, format)',
  example: 'formatDate(today(), "DD/MM/YYYY")',
  category: '@core.automation/expr.category.date',
  minArgs: 2,
  maxArgs: 2,
};

export const dayOfWeekFn: ExpressionFunction = {
  name: 'dayOfWeek',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'dayOfWeek' });
    }
    return dayOfWeek(date);
  },
  description: '@core.automation/expr.dayOfWeek.description',
  signature: 'dayOfWeek(date)',
  example: 'dayOfWeek(today())',
  category: '@core.automation/expr.category.date',
  minArgs: 1,
  maxArgs: 1,
};

export const isWeekendFn: ExpressionFunction = {
  name: 'isWeekend',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'isWeekend' });
    }
    return isWeekend(date);
  },
  description: '@core.automation/expr.isWeekend.description',
  signature: 'isWeekend(date)',
  example: 'isWeekend(today())',
  category: '@core.automation/expr.category.date',
  minArgs: 1,
  maxArgs: 1,
};

export const dateDiffFn: ExpressionFunction = {
  name: 'dateDiff',
  call: ([date1, date2, unit = 'days']) => {
    if (!(date1 instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.first.date', { fn: 'dateDiff' });
    }
    if (!(date2 instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.second.date', { fn: 'dateDiff' });
    }
    if (typeof unit !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.third.string', { fn: 'dateDiff' });
    }
    return dateDiff(date1, date2, unit);
  },
  description: '@core.automation/expr.dateDiff.description',
  signature: 'dateDiff(date1, date2, unit)',
  example: 'dateDiff(today(), event.deadline, "days")',
  category: '@core.automation/expr.category.date',
  minArgs: 2,
  maxArgs: 3,
};

export const yearFn: ExpressionFunction = {
  name: 'year',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'year' });
    }
    return date.getFullYear();
  },
  description: '@core.automation/expr.year.description',
  signature: 'year(date)',
  example: 'year(today())',
  category: '@core.automation/expr.category.date',
  minArgs: 1,
  maxArgs: 1,
};

export const monthFn: ExpressionFunction = {
  name: 'month',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'month' });
    }
    return date.getMonth() + 1;
  },
  description: '@core.automation/expr.month.description',
  signature: 'month(date)',
  example: 'month(today())',
  category: '@core.automation/expr.category.date',
  minArgs: 1,
  maxArgs: 1,
};

export const dayFn: ExpressionFunction = {
  name: 'day',
  call: ([date]) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'day' });
    }
    return date.getDate();
  },
  description: '@core.automation/expr.day.description',
  signature: 'day(date)',
  example: 'day(today())',
  category: '@core.automation/expr.category.date',
  minArgs: 1,
  maxArgs: 1,
};
