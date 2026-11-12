import type { PluginRecord } from '../../kernel';
import { aiDepsOf } from '../../infrastructure/workflow/stepDeps';
import type { StepFactory } from '../workflowExtensionPoints';
import { workflowStep } from '../workflowExtensionPoints';
import { makeAIDetectWorkflowStepDefinition } from '../../infrastructure/workflow/steps/AIDetectWorkflowStep';
import { makeAIExtractParametersStepDefinition } from '../../infrastructure/workflow/steps/AIExtractParametersStep';
import {
  makeAIClassifyStepDefinition,
  makeAIExtractStepDefinition,
  makeAIGenerateStepDefinition,
} from '../../infrastructure/workflow/steps/AIDataSteps';

/**
 * Os passos que chamam um MODELO. Vivem fora de `core.steps` porque dependem de `core.ai`, e os
 * passos de dado não têm por que herdar essa dependência: uma instalação sem conexão de IA carrega
 * o motor inteiro do mesmo jeito, e o que falta falta só aqui.
 */
const factories: Record<string, StepFactory> = {
  AIDetectWorkflow: (deps) => makeAIDetectWorkflowStepDefinition(aiDepsOf(deps)),
  AIExtractParameters: (deps) => makeAIExtractParametersStepDefinition(aiDepsOf(deps)),
  AIGenerate: (deps) => makeAIGenerateStepDefinition(aiDepsOf(deps)),
  AIClassify: (deps) => makeAIClassifyStepDefinition(aiDepsOf(deps)),
  AIExtract: (deps) => makeAIExtractStepDefinition(aiDepsOf(deps)),
};

export const coreAiStepsPlugin: PluginRecord = {
  trusted: true,
  implementations: factories,
  manifest: {
    id: 'core.ai.steps',
    version: '1.0.0',
    kernel: '^2.0.0',
    name: '@core.automation/plugin.ai-steps.name',
    dependencies: { 'core.workflow': '^1.0.0', 'core.ai': '^1.0.0' },
    contributes: [
      workflowStep(
        {
          stepDefinitionId: 'ai-detect-workflow',
          name: '@core.automation/step.ai-detect-workflow.name',
          category: 'Integration',
        },
        'AIDetectWorkflow',
      ),
      workflowStep(
        {
          stepDefinitionId: 'ai-extract-parameters',
          name: '@core.automation/step.ai-extract-parameters.name',
          category: 'Integration',
        },
        'AIExtractParameters',
      ),
      workflowStep(
        { stepDefinitionId: 'ai-generate', name: '@core.automation/step.ai-generate.name', category: 'Integration' },
        'AIGenerate',
      ),
      workflowStep(
        { stepDefinitionId: 'ai-classify', name: '@core.automation/step.ai-classify.name', category: 'Integration' },
        'AIClassify',
      ),
      workflowStep(
        { stepDefinitionId: 'ai-extract', name: '@core.automation/step.ai-extract.name', category: 'Integration' },
        'AIExtract',
      ),
    ],
  },
};
