import { evaluateFieldBoolean, evaluateFieldExpression } from './fieldExpression';
import { navigateReferences, planReferenceNavigation } from './referenceScope';
import type { ReferenceNavigator } from './referenceScope';
import { ACTION_RESERVED_VARIABLES, actionFieldContext } from './actionScope';
import type { ActionScopeInput } from './actionScope';

export {
  ACTION_RESERVED_VARIABLES,
  BUILTIN_ACTION_SURFACES,
  EMPTY_VIEWER,
  PORTAL_ACTION_SURFACE,
} from './actionScope';
export type { ActionRelation, ActionSurface, ExprViewer } from './actionScope';

/**
 * Contexto das expressões `hiddenWhen` / `disabledWhen` de uma Action. No escritório, puramente de UI —
 * o backend não as reavalia, do mesmo modo que `FieldLogic.hiddenWhen`/`disabledWhen`. O escopo em si
 * mora em `actionScope.ts`, compartilhado: no portal, o servidor o monta igual.
 */
export interface ActionExprContext extends ActionScopeInput {
  /**
   * Como chegar aos registros que um campo de referência aponta. Presente, a expressão que NAVEGA
   * uma referência (`caseId.responsibleLawyerId`) lê o registro apontado; ausente, só existe o id —
   * que é o que o escopo sempre teve. Ver `navigateReferences`.
   */
  references?: ReferenceNavigator;
}

const RESERVED_ROOTS: ReadonlySet<string> = new Set(ACTION_RESERVED_VARIABLES);

/** Os valores da raiz, com as referências que ESTA expressão navega já trocadas pelos registros. */
const navigatedValues = (expr: string, ctx: ActionExprContext): Record<string, unknown> => {
  if (!ctx.references || !ctx.entity) return ctx.values;
  const plan = planReferenceNavigation(ctx.references.schema, ctx.entity, [expr], RESERVED_ROOTS);
  return plan ? navigateReferences(ctx.values, plan, ctx.references.lookup) : ctx.values;
};

const asFieldContext = (expr: string, ctx: ActionExprContext) =>
  actionFieldContext({ ...ctx, values: navigatedValues(expr, ctx) });

export const isActionHidden = (expr: string | null | undefined, ctx: ActionExprContext): boolean =>
  evaluateFieldBoolean(expr, asFieldContext(expr ?? '', ctx));

export const isActionDisabled = (expr: string | null | undefined, ctx: ActionExprContext): boolean =>
  evaluateFieldBoolean(expr, asFieldContext(expr ?? '', ctx));

/**
 * O VALOR de uma expressão de ação, no mesmo escopo dos três slots booleanos. É o que o formulário de
 * parâmetros usa para `parameterDefaults` — e estoura, em vez de engolir o erro, porque ali a falha é
 * relatada a quem escreveu a expressão.
 */
export const evaluateActionExpression = (expr: string, ctx: ActionExprContext): unknown =>
  evaluateFieldExpression(expr, asFieldContext(expr, ctx));

/**
 * A ação está LIGADA? Só faz sentido quando ela declara `activeWhen`; sem declaração, `undefined`
 * diz "não é um interruptor" — diferente de `false`, que é o interruptor desligado.
 */
export const actionActiveState = (
  expr: string | null | undefined,
  ctx: ActionExprContext,
): boolean | undefined =>
  expr?.trim() ? evaluateFieldBoolean(expr, asFieldContext(expr, ctx)) : undefined;
