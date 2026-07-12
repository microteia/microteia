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
  | 'Remove';

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
  options?: InputOptionsSource;
  // Só relevante quando type === 'EntityReference'. Mesma chave de FieldDefinition.refEntity:
  // 'cases' | 'persons' | 'contracts' | 'financials' | 'deadlines' | 'members' ou um screenKey de entidade customizada.
  entityType?: string;
  // Restringe os tipos de mapping permitidos. Se undefined, todos são permitidos.
  allowedMappingKinds?: Array<'Literal' | 'Event' | 'Expression' | 'Output' | 'Variable'>;
  // Validação via regex (somente para Literal string)
  pattern?: string;
  patternMessage?: string;
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
      /** ID do input (Literal) que guarda o id do Script cujos outputParams viram saídas. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-query-projections';
      /** ID do input do tipo 'Query' cujas projeções viram saídas `first.<projeção>`. */
      sourceInputId: string;
      description?: string;
    };

/**
 * Define se este step ganha inputs dinâmicos a partir de um alvo escolhido em design-time.
 * Ex: 'Chamar Workflow' expõe os parâmetros do workflow-alvo como inputs `param.<chave>`.
 */
export type DynamicInputsMetadata =
  | {
      kind: 'from-target-workflow-parameters';
      /** ID do input (Literal) que guarda o id do workflow-alvo cujos parâmetros viram inputs. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-script-parameters';
      /** ID do input (Literal) que guarda o id do Script cujos inputParams viram inputs `param.<chave>`. */
      sourceInputId: string;
      description?: string;
    };

/**
 * Espelho somente-leitura de StepDefinition (sem `createExecutor`, que só existe em
 * functions/) — carregado via cloud function getWorkflowStepCatalog, alimenta o builder visual.
 * A UI nunca conhece um Step por nome (ex: "CreateDeadline"), só renderiza a partir destes campos.
 */
export interface StepDefinitionSummary {
  id: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  category: StepCategory;
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
}
