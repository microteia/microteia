import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import {
  AI_GENERATE_DEFAULT_CHARACTERS,
  AI_GENERATE_MAX_CHARACTERS,
  AI_GENERATE_STEP_ID,
} from '../../../domain/schema/aiSteps';
import type { AIStepDeps } from '../stepDeps';
import { resolveAICredentials } from './aiStepCredentials';

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Escrever um texto. O `prompt` é a pergunta — com o que a automação já sabe interpolado por expressão
 * —, e `instructions` é o tom e a regra (vai como instrução de sistema). O texto sai CORTADO no teto: as
 * saídas moram no histórico da execução, e o corte é dito em `truncated`.
 */
export const makeAIGenerateStepDefinition = (deps: AIStepDeps): StepDefinition => ({
  ...coreStepMetadata(AI_GENERATE_STEP_ID),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const prompt = textOf(inputs.prompt);
      if (!prompt) return { success: false, message: '@core.automation/step.ai.no-text' };
      const declared = Number(inputs.maxCharacters);
      const limit = Number.isFinite(declared) && declared > 0
        ? Math.min(Math.trunc(declared), AI_GENERATE_MAX_CHARACTERS)
        : AI_GENERATE_DEFAULT_CHARACTERS;

      const credentials = await resolveAICredentials(deps, context.execution.tenantId, inputs.connectionId);
      const instructions = textOf(inputs.instructions);
      const answer = (await deps.callAIUseCase.execute({
        credentials,
        userContent: prompt,
        ...(instructions ? { options: { systemPrompt: instructions } } : {}),
      })).trim();

      const truncated = answer.length > limit;
      return {
        success: true,
        message: '@core.automation/step.ai-generate.done',
        messageParams: { length: String(Math.min(answer.length, limit)) },
        outputs: { text: truncated ? answer.slice(0, limit) : answer, truncated },
      };
    },
  }),
});
