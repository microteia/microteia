import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';

export const makeMapStepDefinition = (): StepDefinition => ({
  id: 'map',
  version: 1,
  name: 'Montar Objeto',
  description:
    'Monta um objeto de saída nomeado a partir de campos mapeados (nome e valor). Útil para preparar os dados de um cadastro e depois gravá-los com o step Gravar Registro.',
  icon: 'RiBracketsLine',
  category: 'Data',
  configurable: true,
  inputs: [
    {
      id: 'map',
      label: 'Objeto',
      required: true,
      type: 'Map',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [],
  dynamicOutputs: {
    kind: 'from-map-config',
    sourceInputId: 'map',
    description: 'Objeto montado por este step',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const config = inputs.map as MapStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.name?.trim()) {
        return { success: false, message: 'Montagem de objeto não configurada' };
      }

      const object: Record<string, unknown> = {};
      for (const field of config.fields ?? []) {
        if (!field?.name?.trim()) continue;
        object[field.name] = resolveMapping(field.value, context);
      }

      return {
        success: true,
        message: `Objeto "${config.name}" montado`,
        outputs: { [config.name]: object },
      };
    },
  }),
});
