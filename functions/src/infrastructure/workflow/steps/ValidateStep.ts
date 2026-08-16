import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { getValueAtPath, parsePath } from '../../../domain/schema/pathResolver';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import { validateObject } from '../../../domain/schema/validateSpec';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const makeValidateStepDefinition = (screenProvider: IScreenDefinitionProvider): StepDefinition => ({
  id: 'validate-object',
  version: 1,
  name: '@core.automation/step.validate-object.name',
  description:
    '@core.automation/step.validate.description',
  icon: 'RiShieldCheckLine',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    {
      id: 'validate',
      label: '@core.automation/step.validate-object.label.validacao',
      required: true,
      type: 'Validate',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [],
  dynamicOutputs: {
    kind: 'from-validate-config',
    sourceInputId: 'validate',
    description: '@core.automation/step.validate-object.description',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const config = inputs.validate as ValidateStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.source || !config.outputName?.trim()) {
        return { success: false, message: '@core.automation/step.validate.not-configured' };
      }

      const source = config.source === 'event' ? context.event.payload : context.input;
      const raw = config.property?.trim()
        ? getValueAtPath(source, parsePath(config.property))
        : source;

      if (!isPlainObject(raw)) {
        return { success: false, message: '@core.automation/step.validate.invalid-source' };
      }

      const ctx = await screenProvider.getSchemaContext(context.execution.tenantId);
      const outcome = validateObject(ctx, config, raw);

      if (outcome.issues.length > 0) {
        return {
          success: false,
          message: '@core.automation/step.validate.invalid-object',
          messageParams: { detail: describeRuleIssues(outcome.issues) },
        };
      }

      return {
        success: true,
        message: '@core.automation/step.validate.done',
        messageParams: { name: config.outputName },
        outputs: { [config.outputName]: outcome.value },
      };
    },
  }),
});
