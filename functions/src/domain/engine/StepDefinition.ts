import type { WorkflowContext, WorkflowResult } from '../entities/WorkflowContext';
import type { FieldRules } from '../schema/fieldRules';

export type InputType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'EntityReference'
  | 'Expression'
  | 'OutputReference'
  | 'VariableReference'
  | 'Query'
  | 'Upsert'
  | 'Remove'
  | 'Map'
  | 'Validate';

export type InputOptionsSource =
  | { kind: 'Static'; options: { value: string; label: string; color?: string }[] }
  | { kind: 'Lookup'; lookup: string };

export interface InputDefinition {
  id: string;
  label: string;
  description?: string;
  required: boolean;
  type: InputType;
  defaultValue?: unknown;
  validator?: (value: unknown) => string | undefined;
  options?: InputOptionsSource;
  // Só relevante quando type === 'EntityReference'. Mesma chave de FieldDefinition.refEntity:
  // 'cases' | 'persons' | 'contracts' | 'financials' | 'deadlines' | 'members' ou um screenKey de entidade customizada.
  entityType?: string;
  // Restringe os tipos de mapping permitidos. Se undefined, todos são permitidos.
  allowedMappingKinds?: Array<'Literal' | 'Event' | 'Expression' | 'Output' | 'Variable'>;
  // Validação via regex (somente para Literal string). Mantido por compatibilidade: em runtime é
  // lido como um `rules.validate` equivalente (ver toEffectiveRules em schema/fieldRules.ts).
  pattern?: string;
  patternMessage?: string;
  // Regras de formatação e validação aplicadas ao valor resolvido, em design-time e em runtime.
  rules?: FieldRules;
}

export interface OutputDefinition {
  id: string;
  label: string;
  type: InputType;
}

export type StepCategory = 'Action' | 'Data' | 'Notification' | 'Integration';

/**
 * Define se e como os outputs são dinâmicos (conhecidos apenas em runtime).
 * Usado pelo IntelliSense para sugerir variáveis mesmo quando o nome não é conhecido em design-time.
 */
export type DynamicOutputsMetadata =
  | {
      kind: 'from-input-field';
      /** ID(s) do(s) input(s) que definem o(s) nome(s) do(s) output(s). Ex: 'name' ou ['key1', 'key2'] */
      sourceInputId: string | string[];
      description?: string;
    }
  | {
      kind: 'runtime-only';
      description?: string;
    }
  | {
      kind: 'from-target-script-outputs';
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-query-projections';
      /** ID do input do tipo 'Query' cujas projeções viram saídas `first.<projeção>`. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-validate-config';
      /** ID do input do tipo 'Validate' cujo ValidateStepConfig define a saída `<outputName>`. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-map-config';
      /** ID do input do tipo 'Map'. Com `name`, a saída é o objeto nomeado `<name>` (tipado por `type`);
       *  sem `name`, cada campo do MapStepConfig vira uma saída direta na raiz do step. */
      sourceInputId: string;
      description?: string;
    };

/**
 * Define se e como os inputs são dinâmicos (conhecidos apenas depois que o usuário escolhe um
 * alvo em design-time). Usado pelo editor para renderizar campos extras e pelo IntelliSense.
 */
export type DynamicInputsMetadata =
  | {
      kind: 'from-target-script-parameters';
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-workflow-parameters';
      /** ID do input (Literal) que guarda o id do workflow-alvo cujos parâmetros viram inputs. */
      sourceInputId: string;
      description?: string;
    };

export interface WorkflowStepExecutor {
  execute(inputs: Record<string, unknown>, context: WorkflowContext): Promise<WorkflowResult>;
}

export type StepType = 'Action' | 'Script' | 'SubWorkflow';

export interface StepDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  category: StepCategory;
  type: StepType;
  configurable: boolean;
  inputs: InputDefinition[];
  outputDefinitions: OutputDefinition[];
  /**
   * Define se este step gera outputs dinâmicos (nomes conhecidos apenas em runtime).
   * Ex: SetVariable gera output com nome definido pelo input 'name'.
   */
  dynamicOutputs?: DynamicOutputsMetadata;
  /**
   * Define se este step ganha inputs dinâmicos a partir de um alvo escolhido em design-time.
   * Ex: 'Chamar Workflow' expõe os parâmetros do workflow-alvo como inputs `param.<chave>`.
   */
  dynamicInputs?: DynamicInputsMetadata;
  createExecutor(): WorkflowStepExecutor;
}
