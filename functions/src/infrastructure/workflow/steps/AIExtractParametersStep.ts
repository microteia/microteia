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
import { resolveAICredentials } from './aiStepCredentials';

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
      if (!targetWorkflowId) {
        return { success: false, message: '@core.automation/step.ai-extract-parameters.no-target' };
      }

      const tenantId = context.execution.tenantId;
      const definition = await deps.workflowDefinitionRepository.findByRef(tenantId, targetWorkflowId);
      if (!definition || definition.eventName !== WORKFLOW_CALLED_EVENT) {
        return { success: false, message: '@core.automation/step.ai-extract-parameters.target-missing' };
      }

      const parameters = definition.parameters ?? [];
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
        outputs: { params, filled: filledCount(params) },
      };
    },
  }),
});
