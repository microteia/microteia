import { evaluateFieldBoolean } from './fieldExpression';

/**
 * Contexto das expressões `hiddenWhen` / `disabledWhen` de uma Action. Puramente de UI — o backend não
 * as reavalia, do mesmo modo que `FieldLogic.hiddenWhen`/`disabledWhen`.
 */
export interface ActionExprContext {
  /** Valores correntes do formulário, expostos na raiz do escopo (`email`, `status`…). */
  values: Record<string, unknown>;
  /** Registro como está gravado no servidor — `null` enquanto o registro é novo. */
  record: Record<string, unknown> | null;
  isNew: boolean;
  isDirty: boolean;
  /** Papel do usuário no escritório: `admin`, `lawyer`, `secretary` ou `user`. */
  role: string;
}

/**
 * Nomes reservados sobrescrevem campos de mesma chave: um campo chamado `record` não fica acessível na
 * raiz do escopo, mas segue legível por `record.record`.
 */
export const ACTION_RESERVED_VARIABLES = ['record', 'isNew', 'isDirty', 'role'] as const;

const buildScope = (ctx: ActionExprContext): Record<string, unknown> => ({
  ...ctx.values,
  record: ctx.record ?? {},
  isNew: ctx.isNew,
  isDirty: ctx.isDirty,
  role: ctx.role,
});

export const isActionHidden = (expr: string | null | undefined, ctx: ActionExprContext): boolean =>
  evaluateFieldBoolean(expr, { value: null, data: buildScope(ctx) });

export const isActionDisabled = (expr: string | null | undefined, ctx: ActionExprContext): boolean =>
  evaluateFieldBoolean(expr, { value: null, data: buildScope(ctx) });

/**
 * A ação está LIGADA? Só faz sentido quando ela declara `activeWhen`; sem declaração, `undefined`
 * diz "não é um interruptor" — diferente de `false`, que é o interruptor desligado.
 */
export const actionActiveState = (
  expr: string | null | undefined,
  ctx: ActionExprContext,
): boolean | undefined =>
  expr?.trim() ? evaluateFieldBoolean(expr, { value: null, data: buildScope(ctx) }) : undefined;
