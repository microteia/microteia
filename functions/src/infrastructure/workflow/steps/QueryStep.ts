import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { coreStepMetadata } from '../../../domain/engine/StepDefinition';
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
  ...coreStepMetadata('query'),
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context): Promise<WorkflowResult> => {
      const spec = inputs.query as QuerySpec | undefined;
      if (!spec || typeof spec !== 'object') {
        return { success: false, message: '@core.automation/step.query.not-configured' };
      }

      const outcome = await runWorkflowQuery(spec, context, { queryRepository, fetcher, screenProvider });
      if (!outcome.ok) {
        return { success: false, message: outcome.error, messageParams: outcome.errorParams };
      }

      // O histórico da execução diz quando a resposta não é o conjunto inteiro — antes, um `limit: 300`
      // devolvia 100 e a linha dizia só "100 registros encontrados".
      const message = !outcome.value.hasMore
        ? '@core.automation/step.query.found'
        : spec.page
          ? '@core.automation/step.query.found-page'
          : '@core.automation/step.query.found-partial';

      return {
        success: true,
        message,
        messageParams: { count: String(outcome.value.count), table: spec.table },
        outputs: {
          results: outcome.value.results,
          count: outcome.value.count,
          first: outcome.value.first,
          hasMore: outcome.value.hasMore,
          cursor: outcome.value.cursor,
        },
      };
    },
  }),
});
