import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';

export const makeMapStepDefinition = (): StepDefinition => ({
  id: 'map',
  version: 1,
  name: 'Montar Objeto',
  description:
    'Monta campos a partir de mapeamentos (nome e valor). Com um nome informado, agrupa tudo num objeto nomeado (útil para gravar com o step Gravar Registro). Sem nome, cada campo fica disponível diretamente como saída do step.',
  icon: 'RiBracketsLine',
  category: 'Data',
  type: 'Action',
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
      if (!config || typeof config !== 'object' || !Array.isArray(config.fields)) {
        return { success: false, message: 'Montagem de objeto não configurada' };
      }

      const object: Record<string, unknown> = {};
      for (const field of config.fields) {
        if (!field?.name?.trim()) continue;
        object[field.name] = resolveMapping(field.value, context);
      }

      const name = config.name?.trim();
      if (name) {
        return {
          success: true,
          message: `Objeto "${name}" montado`,
          outputs: { [name]: object },
        };
      }

      return {
        success: true,
        message: 'Campos montados',
        outputs: object,
      };
    },
  }),
});
