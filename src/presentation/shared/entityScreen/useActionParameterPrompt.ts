import { useCallback, useState } from 'react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { evaluateFieldExpression } from '../../../domain/schema/fieldExpression';
import type { ActionExprContext } from '../../../domain/schema/actionExpression';
import type { ActionDefinition } from '../../../domain/entities';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';

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

/**
 * Com o que o formulário abre. Duas origens, nesta ordem: a EXPRESSÃO que a ação declarou para o
 * parâmetro, e — só na falta dela — o campo de mesmo nome na tela. A expressão vem primeiro porque é
 * a declaração explícita; o casamento por nome é a conveniência de quem não precisou declarar nada.
 */
export const buildPromptInitialValues = (
  action: ActionDefinition,
  parameters: WorkflowParameter[],
  context: ActionExprContext,
): Record<string, unknown> => {
  const scope = buildScope(context);
  const defaults = action.parameterDefaults ?? {};
  const out: Record<string, unknown> = {};

  for (const param of parameters) {
    const expression = defaults[param.key];
    if (expression && expression.trim() !== '') {
      const value = evaluateFieldExpression(expression, { value: null, data: scope });
      if (value !== undefined && value !== null) out[param.key] = value;
      continue;
    }
    const fromScreen = context.values[param.key];
    if (fromScreen !== undefined && fromScreen !== null) out[param.key] = fromScreen;
  }

  return out;
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
  const { workflows } = useWorkflowStore();
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
    setPending({
      action,
      parameters,
      initialValues: buildPromptInitialValues(action, parameters, context),
      run,
    });
    return true;
  }, [parametersOf]);

  const cancel = useCallback(() => setPending(null), []);

  const confirm = useCallback((params: Record<string, unknown>) => {
    if (!pending) return;
    const { run } = pending;
    setPending(null);
    run(params);
  }, [pending]);

  return { pending, request, cancel, confirm };
};
