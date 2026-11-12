import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import { AIResponseFormatError } from '../../../domain/usecases/CallAIUseCase';
import {
  AIExtractionRefusedError,
  extractParameterValues,
  hasEntityReferenceDeep,
  resolveParameters,
} from '../../../domain/services/aiParameterExtraction';
import type { AIStepDeps } from '../stepDeps';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import { aiExtractFields } from '../../../domain/schema/aiSteps';
import type { AiExtractField } from '../../../domain/schema/aiSteps';
import { resolveAICredentials } from './aiStepCredentials';

/**
 * O campo declarado como PARÂMETRO do extrator: com lista fechada, é `select` — e o extrator já manda ao
 * modelo os valores aceitos e confere a resposta contra eles (sem caixa nem acento, na grafia da lista,
 * `null` quando nada casa). É a classificação, sem passo à parte.
 */
const declaredParameter = (field: AiExtractField): WorkflowParameter => ({
  key: field.key,
  label: field.description || field.key,
  ...(field.options
    ? { type: 'select' as const, options: field.options.map((option) => ({ value: option, label: option })) }
    : { type: 'String' as const }),
});

/**
 * Para cada campo de lista FECHADA, se a resposta casou com um dos valores. É o que deixa a automação
 * separar "o modelo classificou" de "nenhuma categoria serviu" sem comparar com vazio à mão.
 */
const closedListMatches = (parameters: WorkflowParameter[], params: Record<string, unknown>): Record<string, boolean> =>
  Object.fromEntries(parameters
    .filter((parameter) => parameter.type === 'select' && !parameter.list)
    .map((parameter) => [parameter.key, params[parameter.key] !== null && params[parameter.key] !== undefined]));

const filledCount = (values: Record<string, unknown>): number =>
  Object.values(values).filter((value) => value !== null && value !== undefined && value !== '')
    .length;

export const makeAIExtractParametersStepDefinition = (deps: AIStepDeps): StepDefinition => ({
  ...coreStepMetadata('ai-extract-parameters'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const text = inputs.text ? String(inputs.text) : '';
      if (!text.trim()) {
        return { success: false, message: '@core.automation/step.ai.no-text' };
      }

      const targetWorkflowId = inputs.targetWorkflowId ? String(inputs.targetWorkflowId) : '';
      const declared = aiExtractFields(inputs.fields);
      // Um modo ou o outro: campos declarados aqui, ou os parâmetros de uma automação-alvo. Os dois juntos
      // seriam dois moldes para a mesma resposta — e qualquer escolha calada surpreenderia quem montou.
      if (declared.length > 0 && targetWorkflowId) {
        return { success: false, message: '@core.automation/step.ai-extract-parameters.both' };
      }
      if (declared.length === 0 && !targetWorkflowId) {
        return { success: false, message: '@core.automation/step.ai-extract-parameters.no-target' };
      }

      const tenantId = context.execution.tenantId;
      let parameters: WorkflowParameter[];
      if (declared.length > 0) {
        parameters = declared.map(declaredParameter);
      } else {
        const definition = await deps.workflowDefinitionRepository.findByRef(tenantId, targetWorkflowId);
        if (!definition || definition.eventName !== WORKFLOW_CALLED_EVENT) {
          return { success: false, message: '@core.automation/step.ai-extract-parameters.target-missing' };
        }
        parameters = definition.parameters ?? [];
      }
      if (parameters.length === 0) {
        return {
          success: true,
          message: '@core.automation/step.ai-extract-parameters.no-parameters',
          outputs: { params: {}, filled: 0 },
        };
      }
      if (hasEntityReferenceDeep(parameters)) {
        return {
          success: false,
          message: '@core.automation/step.ai-extract-parameters.has-references',
        };
      }

      const credentials = await resolveAICredentials(deps, tenantId, inputs.connectionId);

      let values: Record<string, unknown>;
      try {
        values = await extractParameterValues({
          callAI: deps.callAIUseCase,
          credentials,
          text,
          parameters,
        });
      } catch (error) {
        // O motivo é DIAGNÓSTICO, e vai para o log da execução como parâmetro da mensagem: quem
        // abre a execução na tela precisa distinguir "o modelo desistiu" de "a resposta veio
        // cortada no limite de saída" — são causas com correções diferentes.
        if (error instanceof AIExtractionRefusedError) {
          return {
            success: false,
            message: '@core.automation/step.ai-extract-parameters.refused',
            messageParams: { detail: error.detail },
          };
        }
        if (error instanceof AIResponseFormatError) {
          return {
            success: false,
            message: error.truncated
              ? '@core.automation/step.ai.response-truncated'
              : '@core.automation/step.ai.response-not-json',
            messageParams: { limit: String(credentials.maxTokens) },
          };
        }
        throw error;
      }

      const params = resolveParameters(parameters, undefined, values);

      return {
        success: true,
        message: '@core.automation/step.ai-extract-parameters.done',
        messageParams: { count: String(filledCount(params)), total: String(parameters.length) },
        outputs: { params, filled: filledCount(params), matched: closedListMatches(parameters, params) },
      };
    },
  }),
});
