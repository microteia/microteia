/**
 * ESCOPO DE UI DAS EXPRESSÕES DE CAMPO — FRONT-ONLY, deliberadamente fora de `SHARED_FILES` do
 * sync-schemas, pelo mesmo motivo de `referenceScope.ts`.
 *
 * O escopo de uma expressão de campo é plano por chave de campo, e por isso só sabia falar do
 * REGISTRO — nunca da SITUAÇÃO em que o formulário está aberto. Uma Action já distinguia as duas
 * coisas (`isNew` e `isDirty` no `actionExpression.ts`), e o campo não: `hiddenWhen: 'isNew'`
 * parseava, resolvia para indefinido e o slot tolerante devolvia `false` — o campo aparecia sempre,
 * sem erro nenhum.
 *
 * Vale APENAS nos slots que já são front-only — `hiddenWhen`, `disabledWhen` e `onChange`. Os slots
 * que rodam dos dois lados (`validate` e `compute`) continuam vendo só o registro: a mesma expressão
 * precisa dar o mesmo resultado no front e no back.
 */

import type { FieldDefinition } from '../entities/entitySchemas';
import { evaluateFieldBoolean } from './fieldExpression';

/**
 * ONDE a expressão do campo está sendo avaliada (issue #12) — a mesma ideia do `surface` das ações:
 *
 * - `form` — o formulário do registro (o padrão quando não se diz nada).
 * - `card` — o cartão da lista. Só avalia o `hiddenWhen` dos campos que declaram `visibleIn`: os pacotes
 *   de antes escreveram a condição para o formulário, e o cartão deles continua como sempre foi.
 */
export type FieldUiSurface = 'form' | 'card';

export interface FieldUiState {
  /** O registro ainda não existe no servidor — o formulário está em modo de criação. */
  isNew: boolean;
  /** O usuário já alterou algum campo desde que o formulário abriu, e ainda não salvou. */
  isDirty: boolean;
  /** Ausente, `form`. */
  surface?: FieldUiSurface;
}

export const FIELD_UI_RESERVED_VARIABLES = ['isNew', 'isDirty', 'surface'] as const;

export const EMPTY_FIELD_UI_STATE: FieldUiState = { isNew: false, isDirty: false };

/**
 * Acrescenta as variáveis de situação ao escopo já montado a partir do registro.
 *
 * Nome reservado VENCE campo de mesma chave, como no escopo das Actions: um campo chamado `isNew`
 * não fica acessível pela raiz, mas segue legível por `value`/`self` na expressão dele mesmo.
 */
export const buildFieldUiScope = (
  scope: Record<string, unknown>,
  ui: FieldUiState,
): Record<string, unknown> => ({ ...scope, isNew: ui.isNew, isDirty: ui.isDirty, surface: ui.surface ?? 'form' });

/**
 * O campo some do CARTÃO deste registro? Só pergunta ao campo que declara `visibleIn` — a adesão ao
 * contrato em que o `hiddenWhen` também vale no cartão, com `surface == "card"`. O de antes foi escrito
 * para o formulário, e avaliá-lo aqui mudaria em silêncio o cartão de quem já tem a extensão instalada.
 * No cartão não há edição: `isNew` e `isDirty` são falsos.
 */
export const isFieldHiddenOnCard = (
  field: FieldDefinition,
  values: Record<string, unknown>,
  extras: { permissions?: string[]; entity?: string } = {},
): boolean => {
  const hiddenWhen = field.logic?.hiddenWhen;
  if (!Array.isArray(field.visibleIn) || !hiddenWhen?.trim()) return false;
  return evaluateFieldBoolean(hiddenWhen, {
    value: values[field.key],
    data: buildFieldUiScope(values, { isNew: false, isDirty: false, surface: 'card' }),
    ...extras,
  });
};

