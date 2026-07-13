import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { UpsertSpec, UpsertStepConfig } from '../../../domain/schema/mutationSpec';
import { getValueAtPath, parsePath } from '../../../domain/schema/pathResolver';
import { runWorkflowUpsert } from '../mutation/runWorkflowMutation';
import type { WorkflowMutationDeps } from '../mutation/runWorkflowMutation';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const makeUpsertStepDefinition = (deps: WorkflowMutationDeps): StepDefinition => ({
  id: 'upsert',
  version: 2,
  name: 'Gravar Registro',
  description:
    'Inclui ou atualiza um registro de qualquer cadastro do escritório (fixo, personalizado ou lista) a partir de um objeto pronto vindo dos steps anteriores ou do evento. Se o objeto tiver um id, atualiza; senão, inclui.',
  icon: 'RiSaveLine',
  category: 'Data',
  type: 'Action',
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
      if (!config || typeof config !== 'object' || !config.table || !config.source) {
        return { success: false, message: 'Gravação não configurada' };
      }

      const source = config.source === 'event' ? context.event.payload : context.input;
      const raw = config.property?.trim()
        ? getValueAtPath(source, parsePath(config.property))
        : source;

      if (!isPlainObject(raw)) {
        return { success: false, message: 'Origem da gravação não é um objeto válido' };
      }

      const { id, ...data } = raw;

      const spec: UpsertSpec = { table: config.table, data };
      if (id !== undefined && id !== null && String(id).trim() !== '') {
        spec.id = String(id);
      }

      const outcome = await runWorkflowUpsert(spec, context, deps, { ignoreUnwritableFields: true });
      if (!outcome.ok) {
        return { success: false, message: outcome.error };
      }

      const { id: recordId, created, record } = outcome.value;
      return {
        success: true,
        message: `Registro ${created ? 'incluído' : 'atualizado'} em "${config.table}"`,
        outputs: { id: recordId, created, record },
      };
    },
  }),
});
