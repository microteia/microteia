import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IScriptRepository } from '../../../domain/repositories/IScriptRepository';
import { resolveMapping } from '../../../domain/engine/InputMapping';
import { runScriptSandbox } from '../sandbox/runScriptSandbox';

const PARAM_PREFIX = 'param.';

export const makeScriptStepDefinition = (scriptRepository: IScriptRepository): StepDefinition => ({
  id: 'script',
  version: 1,
  name: 'Script',
  description: 'Executa um Script (código) reutilizável dentro de um sandbox isolado.',
  icon: 'RiCodeBoxLine',
  category: 'Integration',
  configurable: true,
  inputs: [
    {
      id: 'scriptId',
      label: 'Script',
      required: true,
      type: 'String',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [],
  dynamicInputs: { kind: 'from-target-script-parameters', sourceInputId: 'scriptId' },
  dynamicOutputs: { kind: 'from-target-script-outputs', sourceInputId: 'scriptId' },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const scriptId = inputs.scriptId ? String(inputs.scriptId) : '';
      if (!scriptId) {
        return { success: false, message: 'Nenhum Script foi selecionado' };
      }

      const script = await scriptRepository.findById(context.execution.tenantId, scriptId);
      if (!script) {
        return { success: false, message: 'Script não encontrado' };
      }
      if (!script.compiledJs.trim()) {
        return { success: false, message: 'O Script selecionado está vazio' };
      }

      const scriptInput: Record<string, unknown> = {};
      for (const [key, mapping] of Object.entries(context.stepConfiguration ?? {})) {
        if (!key.startsWith(PARAM_PREFIX)) continue;
        scriptInput[key.slice(PARAM_PREFIX.length)] = resolveMapping(mapping, context);
      }

      try {
        const output = await runScriptSandbox(script.compiledJs, scriptInput, context);
        return { success: true, message: `Script "${script.name}" executado`, outputs: output };
      } catch (error) {
        return { success: false, message: error instanceof Error ? error.message : String(error) };
      }
    },
  }),
});
