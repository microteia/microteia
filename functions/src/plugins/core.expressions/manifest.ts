import type { PluginRecord } from '../../kernel';
import type { ExpressionFunction } from '../../domain/engine/expression/FunctionRegistry';
import { expressionFunction } from '../workflowExtensionPoints';
import {
  todayFn, nowFn, formatDateFn, dayOfWeekFn, isWeekendFn, dateDiffFn, yearFn, monthFn, dayFn,
} from '../../domain/engine/expression/builtins/dateFns';
import { addDaysFn } from '../../domain/engine/expression/builtins/addDaysFn';
import { ifFn } from '../../domain/engine/expression/builtins/ifFn';
import {
  concatFn, lowerFn, upperFn, lengthFn, trimFn, replaceFn, substringFn, startsWithFn, endsWithFn,
  splitFn, joinFn, interpolateFn, onlyNumberFn, formatMoneyFn,
} from '../../domain/engine/expression/builtins/stringFns';
import { getVarFn } from '../../domain/engine/expression/builtins/getVarFn';
import {
  roundFn, floorFn, ceilFn, absFn, minFn, maxFn, sumFn, avgFn,
} from '../../domain/engine/expression/builtins/mathFns';
import {
  firstFn, lastFn, containsFn, indexOfFn, mapFn,
} from '../../domain/engine/expression/builtins/arrayFns';
import { objectFn, deleteFn } from '../../domain/engine/expression/builtins/objectFns';
import {
  andFn, orFn, notFn, isEmptyFn, isNullFn, isNotNullFn, coalesceFn,
} from '../../domain/engine/expression/builtins/logicFns';
import {
  isCPFFn, isCNPJFn, isEmailFn, formatCPFFn, formatCNPJFn,
} from '../../domain/engine/expression/builtins/validationFns';

const BUILTIN_FUNCTIONS: ExpressionFunction[] = [
  todayFn, nowFn, formatDateFn, dayOfWeekFn, isWeekendFn, dateDiffFn, yearFn, monthFn, dayFn,
  addDaysFn,
  ifFn,
  concatFn, lowerFn, upperFn, lengthFn, trimFn, replaceFn, substringFn, startsWithFn, endsWithFn,
  splitFn, joinFn, interpolateFn, onlyNumberFn, formatMoneyFn,
  getVarFn,
  roundFn, floorFn, ceilFn, absFn, minFn, maxFn, sumFn, avgFn,
  firstFn, lastFn, containsFn, indexOfFn, mapFn,
  objectFn, deleteFn,
  andFn, orFn, notFn, isEmptyFn, isNullFn, isNotNullFn, coalesceFn,
  isCPFFn, isCNPJFn, isEmailFn, formatCPFFn, formatCNPJFn,
];

export const coreExpressionsPlugin: PluginRecord = {
  trusted: true,
  implementations: Object.fromEntries(BUILTIN_FUNCTIONS.map((fn) => [fn.name, fn])),
  manifest: {
    id: 'core.expressions',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Funções de Expressão',
    dependencies: { 'core.workflow': '^1.0.0' },
    contributes: BUILTIN_FUNCTIONS.map(expressionFunction),
  },
};
