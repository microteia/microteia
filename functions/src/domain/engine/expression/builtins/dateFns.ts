import type { ExpressionFunction } from '../FunctionRegistry';
import type { WorkflowContext } from '../../../entities/WorkflowContext';
import { anchorDay } from '../../../schema/mutationSpec';
import {
  DEFAULT_TIME_ZONE,
  formatWallClock,
  isValidTimeZone,
  wallClockInTimeZone,
  type WallClock,
} from '../../../schema/i18n/timeZone';

import { LocalizedError } from '../../../errors/LocalizedError';

/**
 * O relógio do ESCRITÓRIO (`i18n.timezone`, resolvido no começo da execução), o mesmo de `today()`.
 * Os getters de `Date` respondiam pelo fuso do processo — UTC numa Cloud Function —, e a mensagem
 * recebida às 11:32 em Brasília era carimbada 14:32. Um dia gravado (meio-dia UTC) se lê o mesmo dia
 * em qualquer fuso entre UTC-11 e UTC+11 — ver `parseDateOnly`.
 */
const officeClock = (date: Date, context: WorkflowContext): WallClock =>
  wallClockInTimeZone(date, context.services.timeZone ?? DEFAULT_TIME_ZONE);

const isWeekendClock = (clock: WallClock): boolean => clock.weekday === 0 || clock.weekday === 6;

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
 * dia que se lê na tela é o dia em que a automação rodou.
 *
 * O dia é o do ESCRITÓRIO (`i18n.timezone`, resolvido no começo da execução), e não o do servidor:
 * em UTC, entre 21h e a meia-noite no horário de Brasília a página já virou, e `today()` devolvia o
 * dia seguinte. É a mesma resposta que `today()` dá numa expressão de campo — uma regra só, nas duas
 * pontas.
 */
export const todayFn: ExpressionFunction = {
  name: 'today',
  call: (_args, context) => anchorDay(context.services.now(), context.services.timeZone),
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
  call: ([date, format, timeZone], context) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.first.date', { fn: 'formatDate' });
    }
    if (typeof format !== 'string') {
      throw new LocalizedError('@core.automation/expr.arg.second.string', { fn: 'formatDate' });
    }
    if (timeZone === undefined) return formatWallClock(officeClock(date, context), format);
    if (!isValidTimeZone(timeZone)) {
      throw new LocalizedError('@core.automation/expr.arg.third.time-zone', { fn: 'formatDate' });
    }
    return formatWallClock(wallClockInTimeZone(date, timeZone), format);
  },
  description: '@core.automation/expr.formatDate.description',
  signature: 'formatDate(date, format, timeZone?)',
  example: 'formatDate(now(), "DD/MM/YYYY HH:mm")',
  category: '@core.automation/expr.category.date',
  minArgs: 2,
  maxArgs: 3,
};

export const dayOfWeekFn: ExpressionFunction = {
  name: 'dayOfWeek',
  call: ([date], context) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'dayOfWeek' });
    }
    return officeClock(date, context).weekday;
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
  call: ([date], context) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'isWeekend' });
    }
    return isWeekendClock(officeClock(date, context));
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
  call: ([date], context) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'year' });
    }
    return officeClock(date, context).year;
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
  call: ([date], context) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'month' });
    }
    return officeClock(date, context).month;
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
  call: ([date], context) => {
    if (!(date instanceof Date)) {
      throw new LocalizedError('@core.automation/expr.arg.date', { fn: 'day' });
    }
    return officeClock(date, context).day;
  },
  description: '@core.automation/expr.day.description',
  signature: 'day(date)',
  example: 'day(today())',
  category: '@core.automation/expr.category.date',
  minArgs: 1,
  maxArgs: 1,
};
