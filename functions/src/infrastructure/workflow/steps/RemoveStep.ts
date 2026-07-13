import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { RemoveSpec, RemoveStepConfig } from '../../../domain/schema/mutationSpec';
import { runWorkflowRemove } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

export const makeRemoveStepDefinition = (deps: WorkflowMutationDeps): StepDefinition => ({
  id: 'remove',
  version: 1,
  name: 'Excluir Registro',
  description:
    'Exclui um registro de qualquer cadastro do escritório (fixo, personalizado ou lista) pelo seu id. Exclui apenas o registro informado, sem cascata.',
  icon: 'RiDeleteBin6Line',
  category: 'Data',
  type: 'Action',
  configurable: true,
  inputs: [
    {
      id: 'remove',
      label: 'Exclusão',
      required: true,
      type: 'Remove',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [
    { id: 'id', label: 'Id do registro', type: 'String' },
    { id: 'removed', label: 'Foi excluído', type: 'Boolean' },
  ],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const config = inputs.remove as RemoveStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.table || !config.id) {
        return { success: false, message: 'Exclusão não configurada' };
      }

      const resolvedId = resolveMapping(config.id, context);
      if (resolvedId === undefined || resolvedId === null || String(resolvedId).trim() === '') {
        return { success: false, message: 'Id do registro a excluir não informado' };
      }

      const spec: RemoveSpec = { table: config.table, id: String(resolvedId) };
      const outcome = await runWorkflowRemove(spec, context, deps);
      if (!outcome.ok) {
        return { success: false, message: outcome.error };
      }

      const { id, removed } = outcome.value;
      return {
        success: true,
        message: removed ? `Registro excluído de "${config.table}"` : 'Registro não encontrado',
        outputs: { id, removed },
      };
    },
  }),
});
