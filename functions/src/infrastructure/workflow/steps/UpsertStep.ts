import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { setValueAtPath } from '../../../domain/schema/mutationSpec';
import type { UpsertSpec, UpsertStepConfig } from '../../../domain/schema/mutationSpec';
import { runWorkflowUpsert } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

export const makeUpsertStepDefinition = (deps: WorkflowMutationDeps): StepDefinition => ({
  id: 'upsert',
  version: 1,
  name: 'Gravar Registro',
  description:
    'Inclui ou atualiza um registro de qualquer cadastro do escritório (fixo, personalizado ou lista). Informe o id para atualizar; deixe em branco para incluir.',
  icon: 'RiSaveLine',
  category: 'Data',
  configurable: true,
  inputs: [
    {
      id: 'upsert',
      label: 'Gravação',
      required: true,
      type: 'Upsert',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [
    { id: 'id', label: 'Id do registro gravado', type: 'String' },
    { id: 'created', label: 'Foi incluído (novo)', type: 'Boolean' },
    { id: 'record', label: 'Registro gravado', type: 'String' },
  ],
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const config = inputs.upsert as UpsertStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.table) {
        return { success: false, message: 'Gravação não configurada' };
      }

      const data: Record<string, unknown> = {};
      for (const field of config.fields ?? []) {
        if (!field?.path) continue;
        setValueAtPath(data, field.path, resolveMapping(field.value, context));
      }

      const spec: UpsertSpec = { table: config.table, data };
      if (config.id) {
        const resolvedId = resolveMapping(config.id, context);
        if (resolvedId !== undefined && resolvedId !== null && String(resolvedId).trim() !== '') {
          spec.id = String(resolvedId);
        }
      }

      const outcome = await runWorkflowUpsert(spec, context, deps);
      if (!outcome.ok) {
        return { success: false, message: outcome.error };
      }

      const { id, created, record } = outcome.value;
      return {
        success: true,
        message: `Registro ${created ? 'incluído' : 'atualizado'} em "${config.table}"`,
        outputs: { id, created, record },
      };
    },
  }),
});
