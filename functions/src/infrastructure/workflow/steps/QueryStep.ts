import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IWorkflowQueryRepository } from '../../../domain/repositories/IWorkflowQueryRepository';
import type { IWorkflowRecordFetcher } from '../../../domain/repositories/IWorkflowRecordFetcher';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import { runWorkflowQuery } from '../query/runWorkflowQuery';

export const makeQueryStepDefinition = (
  queryRepository: IWorkflowQueryRepository,
  fetcher: IWorkflowRecordFetcher,
  screenProvider: IScreenDefinitionProvider,
): StepDefinition => ({
  id: 'query',
  version: 1,
  name: 'Buscar Registros',
  description: 'Pesquisa registros de qualquer cadastro do escritório (fixo, personalizado ou lista) para usar nos próximos passos.',
  icon: 'RiSearchLine',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    {
      id: 'query',
      label: 'Consulta',
      required: true,
      type: 'Query',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [
    { id: 'count', label: 'Quantidade encontrada', type: 'Number' },
    { id: 'results', label: 'Resultados (lista)', type: 'String' },
    { id: 'first', label: 'Primeiro resultado', type: 'String' },
  ],
  dynamicOutputs: {
    kind: 'from-query-projections',
    sourceInputId: 'query',
    description: 'Cada projeção escolhida vira uma saída "first.<projeção>" (ex: first.client.name), além de results/count/first.',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const spec = inputs.query as QuerySpec | undefined;
      if (!spec || typeof spec !== 'object') {
        return { success: false, message: 'Consulta não configurada' };
      }

      const outcome = await runWorkflowQuery(spec, context, { queryRepository, fetcher, screenProvider });
      if (!outcome.ok) {
        return { success: false, message: outcome.error };
      }

      return {
        success: true,
        message: `${outcome.value.count} registro(s) encontrado(s) em "${spec.table}"`,
        outputs: {
          results: outcome.value.results,
          count: outcome.value.count,
          first: outcome.value.first,
        },
      };
    },
  }),
});
