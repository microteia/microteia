import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { buildNestedParams } from '../../../domain/engine/nestedParams';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import { getDb } from '../../firebase/initFirebase';
import { publishEvent } from '../publishEvent';

const MAX_CALL_DEPTH = 10;
const PARAM_PREFIX = 'param.';

export const makeCallWorkflowStepDefinition = (): StepDefinition => ({
  id: 'call-workflow',
  version: 1,
  name: 'Chamar Workflow',
  description: 'Dispara outro workflow, passando valores para os parâmetros dele.',
  icon: 'RiFlowChart',
  category: 'Action',
  configurable: true,
  inputs: [
    {
      id: 'targetWorkflowId',
      label: 'Workflow a chamar',
      required: true,
      type: 'String',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [],
  dynamicInputs: { kind: 'from-target-workflow-parameters', sourceInputId: 'targetWorkflowId' },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const targetWorkflowId = inputs.targetWorkflowId ? String(inputs.targetWorkflowId) : '';
      if (!targetWorkflowId) {
        return { success: false, message: 'Nenhum workflow-alvo foi selecionado' };
      }

      const depth = Number(context.event.payload.__callDepth ?? 0);
      if (depth >= MAX_CALL_DEPTH) {
        return { success: false, message: `Profundidade máxima de ${MAX_CALL_DEPTH} chamadas de workflow excedida` };
      }

      const paramEntries: [string, unknown][] = [];
      for (const [key, mapping] of Object.entries(context.stepConfiguration ?? {})) {
        if (!key.startsWith(PARAM_PREFIX)) continue;
        paramEntries.push([key.slice(PARAM_PREFIX.length), resolveMapping(mapping, context)]);
      }
      const resolvedParams = buildNestedParams(paramEntries);

      await publishEvent(getDb(), context.execution.tenantId, WORKFLOW_CALLED_EVENT, {
        __targetWorkflowId: targetWorkflowId,
        __callDepth: depth + 1,
        ...resolvedParams,
      });

      return { success: true, message: 'Workflow chamado', outputs: {} };
    },
  }),
});
