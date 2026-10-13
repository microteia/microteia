import type { ExpressionFunction } from '../FunctionRegistry';
import type { WorkflowContext } from '../../../entities/WorkflowContext';
import { LocalizedError } from '../../../errors/LocalizedError';
import { parseDateOnly } from '../../../schema/mutationSpec';
import { DEFAULT_TIME_ZONE } from '../../../schema/i18n/timeZone';
import {
  addBusinessDays,
  businessDaysBetween,
  isBusinessDay,
  isBusinessDaysError,
  nextBusinessDay,
  type BusinessDaysEnvironment,
} from '../../../schema/time/businessDays';
import { ambientBusinessCalendars } from '../../../schema/time/businessDaysGate';

/**
 * As contas de dias úteis no motor de automações. A conta é a MESMA da expressão de campo
 * (`schema/time/businessDays.ts`, compartilhado) — aqui só muda de onde vêm os calendários e o fuso:
 * da execução (`context.services`), carregados por `hydrateAndRunWorkflow` quando a automação cita
 * uma das contas.
 *
 * O dia devolvido é ancorado ao meio-dia UTC, como `today()` e `addDays()` deste lado: é o instante
 * que se lê como o mesmo dia em qualquer escritório.
 */
const environmentOf = (context: WorkflowContext): BusinessDaysEnvironment => ({
  calendars:
    context.services.businessCalendars !== undefined
      ? context.services.businessCalendars
      : ambientBusinessCalendars(),
  timeZone: context.services.timeZone ?? DEFAULT_TIME_ZONE,
});

const refusing = <T>(run: () => T): T => {
  try {
    return run();
  } catch (error) {
    if (isBusinessDaysError(error)) throw new LocalizedError(error.message, error.params);
    throw error;
  }
};

const asDay = (day: string): Date | string => parseDateOnly(day) ?? day;

export const addBusinessDaysFn: ExpressionFunction = {
  name: 'addBusinessDays',
  call: ([date, count, calendars], context) =>
    refusing(() => asDay(addBusinessDays(environmentOf(context), date, count, calendars))),
  description: '@core.automation/expr.addBusinessDays.description',
  signature: 'addBusinessDays(date, count, calendars)',
  example: 'addBusinessDays(today(), 15, ["national", "state"])',
  category: '@core.automation/expr.category.date',
  minArgs: 3,
  maxArgs: 3,
};

export const businessDaysBetweenFn: ExpressionFunction = {
  name: 'businessDaysBetween',
  call: ([from, to, calendars], context) =>
    refusing(() => businessDaysBetween(environmentOf(context), from, to, calendars)),
  description: '@core.automation/expr.businessDaysBetween.description',
  signature: 'businessDaysBetween(from, to, calendars)',
  example: 'businessDaysBetween(today(), dueDate, "national")',
  category: '@core.automation/expr.category.date',
  minArgs: 3,
  maxArgs: 3,
};

export const isBusinessDayFn: ExpressionFunction = {
  name: 'isBusinessDay',
  call: ([date, calendars], context) => refusing(() => isBusinessDay(environmentOf(context), date, calendars)),
  description: '@core.automation/expr.isBusinessDay.description',
  signature: 'isBusinessDay(date, calendars)',
  example: 'isBusinessDay(today(), "national")',
  category: '@core.automation/expr.category.date',
  minArgs: 2,
  maxArgs: 2,
};

export const nextBusinessDayFn: ExpressionFunction = {
  name: 'nextBusinessDay',
  call: ([date, calendars], context) =>
    refusing(() => asDay(nextBusinessDay(environmentOf(context), date, calendars))),
  description: '@core.automation/expr.nextBusinessDay.description',
  signature: 'nextBusinessDay(date, calendars)',
  example: 'nextBusinessDay(addDays(today(), 15), "national")',
  category: '@core.automation/expr.category.date',
  minArgs: 2,
  maxArgs: 2,
};
