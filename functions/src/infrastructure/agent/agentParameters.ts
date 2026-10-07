import type { WorkflowParameter } from '../../domain/entities/Workflow';
import type { RuleIssue } from '../../domain/schema/fieldRules';
import { isEmptyRuleValue } from '../../domain/schema/fieldRules';
import { collectRequiredIssues, formatAndValidateParameters } from '../../domain/schema/parameterRules';
import { unknownParameterKeys } from '../../domain/schema/agent/agentWorkflow';
import { resolveParameters } from '../../domain/services/aiParameterExtraction';

/**
 * Os cinco parâmetros que o SISTEMA entrega a todo fluxo chamado por uma ação. Quem chama não os
 * informa — e por isso eles não contam como parâmetro desconhecido quando aparecem.
 */
export const ACTION_SYSTEM_PARAMETERS = ['action', 'source', 'context', 'recordId', 'isNew'] as const;

export type PreparedParameters =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; kind: 'unknown'; unknown: string[]; accepted: string[] }
  | { ok: false; kind: 'invalid'; issues: RuleIssue[] };

const labelOf = (parameter: WorkflowParameter): string => parameter.label || parameter.key;

/**
 * Valor informado que a coerção ANULOU — `"abc"` num número, uma opção que não existe na lista.
 *
 * `resolveParameters` devolve `null` para o que não converte, e o `null` depois se lia como "não
 * informado": o agente mandava um valor, a automação rodava sem ele, e nada dizia por quê.
 */
const coercionIssues = (
  parameters: readonly WorkflowParameter[],
  provided: Record<string, unknown>,
  resolved: Record<string, unknown>,
): RuleIssue[] =>
  parameters.flatMap((parameter) => {
    const sent = provided[parameter.key];
    if (isEmptyRuleValue(sent) || parameter.type === 'Object' || parameter.list) return [];
    // A coerção de número descarta o que não é dígito antes de converter, e `"muitos"` vira `0` —
    // um valor que ninguém mandou. Texto sem dígito nenhum não é número.
    const notANumber = parameter.type === 'Number' && typeof sent === 'string' && !/\d/.test(sent);
    return notANumber || resolved[parameter.key] === null
      ? [{
        path: parameter.key,
        label: labelOf(parameter),
        error: '@core.records/field.invalid-value',
      }]
      : [];
  });

/**
 * Os parâmetros como o motor os receberia — ou a recusa, ANTES de qualquer coisa começar.
 *
 * Três conferências, na ordem em que um modelo as corrige: nome (a chave existe?), valor (converte
 * ao tipo?) e presença (o obrigatório veio?). As duas primeiras não existiam neste caminho, e a
 * terceira só acontecia DEPOIS da publicação, dentro do motor — o agente recebia `STARTED` e
 * descobria a falha só se fosse ler o log.
 *
 * `systemValues` são os que o sistema acrescenta (os cinco da ação): contam para a obrigatoriedade,
 * não para o nome.
 */
export const prepareParameters = (
  parameters: readonly WorkflowParameter[] | undefined,
  provided: Record<string, unknown>,
  systemValues: Record<string, unknown> = {},
): PreparedParameters => {
  const declared = [...(parameters ?? [])];
  const unknown = unknownParameterKeys(declared, provided)
    .filter((key) => !(key in systemValues));
  if (unknown.length > 0) {
    return { ok: false, kind: 'unknown', unknown, accepted: declared.map((one) => one.key) };
  }

  const resolved = { ...resolveParameters(declared, provided, {}), ...systemValues };
  const issues = [
    ...coercionIssues(declared, provided, resolved),
    ...collectRequiredIssues(declared, resolved),
  ];
  if (issues.length > 0) return { ok: false, kind: 'invalid', issues };

  const ruled = formatAndValidateParameters(declared, resolved);
  return ruled.issues.length > 0
    ? { ok: false, kind: 'invalid', issues: ruled.issues }
    : { ok: true, data: ruled.data };
};
