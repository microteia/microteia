import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IWorkflowQueryRepository } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import { runWorkflowQuery } from '../query/runWorkflowQuery';

import type { WorkflowResult } from '../../../domain/entities/WorkflowContext';
export const makeQueryStepDefinition = (
  queryRepository: IWorkflowQueryRepository,
  fetcher: IWorkflowRecordFetcher,
  screenProvider: IScreenDefinitionProvider,
): StepDefinition => ({
  id: 'query',
  version: 1,
  name: '@core.automation/step.query.name',
  description: '@core.automation/step.query.description',
  icon: 'RiSearchLine',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    {
      id: 'query',
      label: '@core.automation/step.query.label.consulta',
      required: true,
      type: 'Query',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [
    { id: 'count', label: '@core.automation/step.query.label.quantidade-encontrada', type: 'Number' },
    { id: 'results', label: '@core.automation/step.query.label.resultados-lista', type: 'String' },
    { id: 'first', label: '@core.automation/step.query.label.primeiro-resultado', type: 'String' },
  ],
  dynamicOutputs: {
    kind: 'from-query-projections',
    sourceInputId: 'query',
    description: '@core.automation/step.query.description',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const spec = inputs.query as QuerySpec | undefined;
      if (!spec || typeof spec !== 'object') {
        return { success: false, message: '@core.automation/step.query.not-configured' };
      }

      const outcome = await runWorkflowQuery(spec, context, { queryRepository, fetcher, screenProvider });
      if (!outcome.ok) {
        return { success: false, message: outcome.error };
      }

      return {
        success: true,
        message: '@core.automation/step.query.found',
        messageParams: { count: String(outcome.value.count), table: spec.table },
        outputs: {
          results: outcome.value.results,
          count: outcome.value.count,
          first: outcome.value.first,
        },
      };
    },
  }),
});
