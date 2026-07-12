import type { StepDefinition, WorkflowStepExecutor } from '../../../domain/engine/StepDefinition';
import type { IScreenDefinitionProvider } from '../../../domain/repositories/IScreenDefinitionProvider';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { createSchemaContext, getValueAtPath, parsePath } from '../../../domain/schema/pathResolver';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import { validateObject } from '../../../domain/schema/validateSpec';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

export const makeValidateStepDefinition = (screenProvider: IScreenDefinitionProvider): StepDefinition => ({
  id: 'validate-object',
  version: 1,
  name: 'Validar Objeto',
  description:
    'Valida e formata um objeto vindo do evento ou dos steps anteriores, seja pelo schema de um cadastro conhecido, seja por parâmetros próprios. Falha o workflow quando algum campo não passa nas regras, e devolve o objeto já validado e formatado.',
  icon: 'RiShieldCheckLine',
  category: 'Data',
  configurable: true,
  inputs: [
    {
      id: 'validate',
      label: 'Validação',
      required: true,
      type: 'Validate',
      allowedMappingKinds: ['Literal'],
    },
  ],
  outputDefinitions: [],
  dynamicOutputs: {
    kind: 'from-validate-config',
    sourceInputId: 'validate',
    description: 'Objeto validado e formatado por este step',
  },
  createExecutor: (): WorkflowStepExecutor => ({
    execute: async (inputs, context) => {
      const config = inputs.validate as ValidateStepConfig | undefined;
      if (!config || typeof config !== 'object' || !config.source || !config.outputName?.trim()) {
        return { success: false, message: 'Validação não configurada' };
      }

      const source = config.source === 'event' ? context.event.payload : context.input;
      const raw = config.property?.trim()
        ? getValueAtPath(source, parsePath(config.property))
        : source;

      if (!isPlainObject(raw)) {
        return { success: false, message: 'Origem da validação não é um objeto válido' };
      }

      const screens = await screenProvider.getScreens(context.execution.tenantId);
      const outcome = validateObject(createSchemaContext(screens), config, raw);

      if (outcome.issues.length > 0) {
        return { success: false, message: `Objeto inválido: ${describeRuleIssues(outcome.issues)}` };
      }

      return {
        success: true,
        message: `Objeto "${config.outputName}" validado`,
        outputs: { [config.outputName]: outcome.value },
      };
    },
  }),
});
