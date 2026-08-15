import { useCallback, useState } from 'react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useNotification } from '../../../stores/useNotification';
import { evaluateFieldExpression } from '../../../domain/schema/fieldExpression';
import type { ActionExprContext } from '../../../domain/schema/actionExpression';
import type { ActionDefinition } from '../../../domain/entities';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';

import { useT, type TranslateFn } from '../i18n/useT';

/**
 * Os cinco parâmetros que TODA action entrega ao fluxo. Não entram no formulário: são do sistema, e
 * pedi-los ao usuário seria pedir que ele redigitasse o que a tela já sabe.
 */
export const ACTION_SYSTEM_PARAMETERS: ReadonlySet<string> = new Set([
  'action',
  'source',
  'context',
  'recordId',
  'isNew',
]);

export interface ActionParameterPrompt {
  action: ActionDefinition;
  parameters: WorkflowParameter[];
  initialValues: Record<string, unknown>;
  /** O disparo que ficou esperando a resposta — já sabe sobre QUAL registro a ação age. */
  run: (params: Record<string, unknown>) => void;
}

export interface ActionParameterPromptController {
  pending: ActionParameterPrompt | null;
  /**
   * Pede os parâmetros da ação, se ela os pedir. Devolve `true` quando ASSUMIU o disparo (o modal
   * abriu) e `false` quando não há nada a perguntar — aí quem chamou executa como sempre.
   */
  request: (
    action: ActionDefinition,
    context: ActionExprContext,
    run: (params: Record<string, unknown>) => void,
  ) => boolean;
  cancel: () => void;
  confirm: (params: Record<string, unknown>) => void;
}

const buildScope = (context: ActionExprContext): Record<string, unknown> => ({
  ...context.values,
  record: context.record ?? {},
  isNew: context.isNew,
  isDirty: context.isDirty,
  role: context.role,
  surface: context.surface ?? 'detail',
  relation: context.relation ?? 'none',
});

const IDENTIFIER_PATTERN = /^[A-Za-z_$][\w$]*$/;

/**
 * O `expr-eval` fala de "undefined variable" tanto para o campo que não existe quanto para a FUNÇÃO
 * que não existe — e quem escreveu `addDays(...)` não reconhece o próprio erro nessa frase. Olhar a
 * expressão diz de qual dos dois se trata: nome seguido de parêntese é chamada de função.
 */
const describeExpressionError = (t: TranslateFn, expression: string, error: unknown): string => {
  const raw = error instanceof Error ? error.message : String(error);
  const name = /undefined variable:\s*(\S+)/.exec(raw)?.[1];
  if (!name || !IDENTIFIER_PATTERN.test(name)) return raw;
  return new RegExp(`\\b${name}\\s*\\(`).test(expression)
    ? t('expression.error.unknown-function-name', { name })
    : t('expression.error.unknown-field', { name });
};

export interface PromptInitialValues {
  values: Record<string, unknown>;
  /** As expressões que estouraram, já em linguagem de quem as escreveu. */
  failures: { key: string; label: string; message: string }[];
}

/**
 * Com o que o formulário abre. Duas origens, nesta ordem: a EXPRESSÃO que a ação declarou para o
 * parâmetro, e — só na falta dela — o campo de mesmo nome na tela. A expressão vem primeiro porque é
 * a declaração explícita; o casamento por nome é a conveniência de quem não precisou declarar nada.
 *
 * Expressão que estoura NÃO derruba o formulário: ela vira uma falha relatada, o parâmetro recai no
 * campo de mesmo nome e a tela abre para ser preenchida à mão. Antes o erro subia pelo handler do
 * clique — a tela simplesmente não abria, e o motivo só existia no console do navegador.
 */
export const buildPromptInitialValues = (
  t: TranslateFn,
  action: ActionDefinition,
  parameters: WorkflowParameter[],
  context: ActionExprContext,
): PromptInitialValues => {
  const scope = buildScope(context);
  const defaults = action.parameterDefaults ?? {};
  const values: Record<string, unknown> = {};
  const failures: PromptInitialValues['failures'] = [];

  for (const param of parameters) {
    const expression = defaults[param.key];
    if (expression && expression.trim() !== '') {
      try {
        const value = evaluateFieldExpression(expression, { value: null, data: scope });
        if (value !== undefined && value !== null) values[param.key] = value;
        continue;
      } catch (error) {
        failures.push({
          key: param.key,
          label: param.label || param.key,
          message: describeExpressionError(t, expression, error),
        });
      }
    }
    const fromScreen = context.values[param.key];
    if (fromScreen !== undefined && fromScreen !== null) values[param.key] = fromScreen;
  }

  return { values, failures };
};

/**
 * A ação que PERGUNTA antes de executar. Vive fora das duas superfícies que a usam — o cartão da
 * listagem e o cabeçalho do registro — porque o gesto é o mesmo nas duas: perguntar, e só então
 * chamar o mesmo `run` que a ação teria chamado direto.
 *
 * A ação que não declara `promptParameters`, ou cujo fluxo não pede nada além dos cinco do sistema,
 * não abre nada: `request` devolve `false` e o disparo segue o caminho de sempre. Fluxo que sumiu do
 * escritório também não trava a tela — sem parâmetros a perguntar, a ação apenas dispara e o
 * servidor devolve o erro de fluxo inexistente, que é onde esse erro se lê.
 */
export const useActionParameterPrompt = (): ActionParameterPromptController => {
  const t = useT('core.records');
  const { workflows } = useWorkflowStore();
  const { notify } = useNotification();
  const [pending, setPending] = useState<ActionParameterPrompt | null>(null);

  const parametersOf = useCallback((workflowId: string): WorkflowParameter[] => {
    const workflow = workflows.find((candidate) => candidate.id === workflowId);
    return (workflow?.parameters ?? []).filter((param) => !ACTION_SYSTEM_PARAMETERS.has(param.key));
  }, [workflows]);

  const request = useCallback((
    action: ActionDefinition,
    context: ActionExprContext,
    run: (params: Record<string, unknown>) => void,
  ): boolean => {
    if (!action.promptParameters || action.command) return false;
    const parameters = parametersOf(action.workflowId);
    if (parameters.length === 0) return false;
    const { values, failures } = buildPromptInitialValues(t, action, parameters, context);
    for (const failure of failures) {
      notify(t('action.prompt.compute-failed', { label: failure.label, message: failure.message }), 'warning');
    }
    setPending({ action, parameters, initialValues: values, run });
    return true;
  }, [parametersOf, notify, t]);

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback((params: Record<string, unknown>) => {
    if (!pending) return;
    const { run } = pending;
    setPending(null);
    run(params);
  }, [pending]);

  return { pending, request, cancel, confirm };
};
