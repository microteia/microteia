import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import { detectWorkflowIds } from '../../../domain/services/aiWorkflowDetection';
import type { AIStepDeps } from '../stepDeps';
import { resolveAICredentials } from './aiStepCredentials';

export const makeAIDetectWorkflowStepDefinition = (deps: AIStepDeps): StepDefinition => ({
  ...coreStepMetadata('ai-detect-workflow'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const text = inputs.text ? String(inputs.text) : '';
      if (!text.trim()) {
        return { success: false, message: '@core.automation/step.ai.no-text' };
      }

      const tenantId = context.execution.tenantId;

      // O fluxo que está rodando sai dos candidatos. Ele é chamável como qualquer outro, e nada no
      // texto impede o modelo de escolhê-lo: sem isso, a automação que detecta pode detectar a si
      // mesma e o único freio seria o limite de profundidade de chamadas, dez execuções depois.
      const candidates = (
        await deps.workflowDefinitionRepository.findEnabledByEvent(tenantId, WORKFLOW_CALLED_EVENT)
      ).filter((definition) => definition.id !== context.execution.workflowDefinitionId);

      const describable = candidates.filter((definition) => (definition.description ?? '').trim());
      if (describable.length === 0) {
        return { success: false, message: '@core.automation/step.ai-detect-workflow.no-candidates' };
      }

      const credentials = await resolveAICredentials(deps, tenantId, inputs.connectionId);

      const ordered = await detectWorkflowIds({
        callAI: deps.callAIUseCase,
        credentials,
        text,
        candidates: describable.map((definition) => ({
          id: definition.id,
          description: definition.description ?? '',
        })),
      });

      const nameById = new Map(describable.map((definition) => [definition.id, definition.name]));
      const candidateNames = ordered.map((id) => nameById.get(id) ?? id);
      const best = ordered[0];

      if (!best) {
        return {
          success: true,
          message: '@core.automation/step.ai-detect-workflow.none',
          outputs: { found: false, workflowId: '', workflowName: '', candidates: [] },
        };
      }

      return {
        success: true,
        message: '@core.automation/step.ai-detect-workflow.done',
        messageParams: { name: nameById.get(best) ?? best, count: String(ordered.length) },
        outputs: {
          found: true,
          workflowId: best,
          workflowName: nameById.get(best) ?? '',
          candidates: ordered.map((id, index) => ({ id, name: candidateNames[index] })),
        },
      };
    },
  }),
});
