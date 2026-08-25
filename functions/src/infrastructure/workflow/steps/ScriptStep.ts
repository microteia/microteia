import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
import type { IScriptRepository } from '../../../domain/repositories/IScriptRepository';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { buildNestedParams } from '../../../domain/engine/nestedParams';
import { applyParameterDefaults } from '../../../domain/schema/eventCatalog';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { formatAndValidateParameters } from '../../../domain/schema/parameterRules';
import { runScriptSandbox } from '../sandbox/runScriptSandbox';
import type { WorkflowQueryDeps } from '../query/runWorkflowQuery';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
const PARAM_PREFIX = 'param.';

export const makeScriptStepDefinition = (
  scriptRepository: IScriptRepository,
  queryDeps: WorkflowQueryDeps,
  mutationDeps: WorkflowMutationDeps,
): StepDefinition => ({
  ...coreStepMetadata('script'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const scriptId = inputs.scriptId ? String(inputs.scriptId) : '';
      if (!scriptId) {
        return { success: false, message: '@core.automation/step.script.none-selected' };
      }

      const script = await scriptRepository.findById(context.execution.tenantId, scriptId);
      if (!script) {
        return { success: false, message: '@core.automation/step.script.not-found' };
      }
      if (!script.compiledJs.trim()) {
        return { success: false, message: '@core.automation/step.script.empty' };
      }

      const paramEntries: [string, unknown][] = [];
      for (const [key, mapping] of Object.entries(context.stepConfiguration ?? {})) {
        if (!key.startsWith(PARAM_PREFIX)) continue;
        paramEntries.push([key.slice(PARAM_PREFIX.length), resolveMapping(mapping, context)]);
      }
      const ruled = formatAndValidateParameters(
        script.inputParams,
        applyParameterDefaults(script.inputParams, buildNestedParams(paramEntries)),
      );
      if (ruled.issues.length > 0) {
        return {
          success: false,
          message: '@core.automation/handler.script.invalid-params',
          messageParams: { detail: describeRuleIssues(ruled.issues) },
        };
      }
      const scriptInput = ruled.data;

      try {
        const output = await runScriptSandbox(script.compiledJs, scriptInput, context, queryDeps, mutationDeps);
        return {
          success: true,
          message: '@core.automation/step.script.done',
          messageParams: { name: script.name },
          outputs: output,
        };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
  }),
});
