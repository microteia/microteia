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
import { hasPermissionFn } from '../../domain/engine/expression/builtins/accessFns';
import {
  roundFn, minFn, maxFn, sumFn, avgFn,
} from '../../domain/engine/expression/builtins/mathFns';
import {
  firstFn, lastFn, containsFn, indexOfFn, mapFn,
} from '../../domain/engine/expression/builtins/arrayFns';
import { objectFn, deleteFn } from '../../domain/engine/expression/builtins/objectFns';
import {
  isEmptyFn, isNullFn, isNotNullFn, coalesceFn,
} from '../../domain/engine/expression/builtins/logicFns';
import {
  isCPFFn, isCNPJFn, isEmailFn, formatCPFFn, formatCNPJFn,
} from '../../domain/engine/expression/builtins/validationFns';

/**
 * Só entra aqui o que o `expr-eval` de fato ROTEIA para uma função registrada. Nome que ele reserva
 * como operador nunca chega até aqui: `and`/`or` dão erro de sintaxe e `not`/`abs`/`ceil`/`floor` são
 * resolvidos pelo operador unário, deixando a implementação órfã. Todos continuam
 * disponíveis e documentados pelo `operatorRegistry`, na forma que funciona. Ver o teste de paridade
 * em `domain/engine/expression/fieldExpressionParity.test.ts`.
 */
const BUILTIN_FUNCTIONS: ExpressionFunction[] = [
  todayFn, nowFn, formatDateFn, dayOfWeekFn, isWeekendFn, dateDiffFn, yearFn, monthFn, dayFn,
  addDaysFn,
  ifFn,
  hasPermissionFn,
  concatFn, lowerFn, upperFn, lengthFn, trimFn, replaceFn, substringFn, startsWithFn, endsWithFn,
  splitFn, joinFn, interpolateFn, onlyNumberFn, formatMoneyFn,
  getVarFn,
  roundFn, minFn, maxFn, sumFn, avgFn,
  firstFn, lastFn, containsFn, indexOfFn, mapFn,
  objectFn, deleteFn,
  isEmptyFn, isNullFn, isNotNullFn, coalesceFn,
  isCPFFn, isCNPJFn, isEmailFn, formatCPFFn, formatCNPJFn,
];

export const coreExpressionsPlugin: PluginRecord = {
  trusted: true,
  implementations: Object.fromEntries(BUILTIN_FUNCTIONS.map((fn) => [fn.name, fn])),
  manifest: {
    id: 'core.expressions',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: '@core.automation/plugin.expressions.name',
    dependencies: { 'core.workflow': '^1.0.0' },
    contributes: BUILTIN_FUNCTIONS.map(expressionFunction),
  },
};
