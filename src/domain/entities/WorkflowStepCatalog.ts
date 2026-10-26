import type { FieldRules } from '../schema/fieldRules';
import type { StepType } from './Workflow';

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

/**
 * O que um input NOMEIA, quando o valor dele é o id de outra coisa declarada no escritório. Faz o
 * editor oferecer a lista em vez de pedir um id digitado, e só quando o mapping é `Literal`.
 */
export type InputPickerKind =
  | 'workflow'
  | 'script'
  | 'ai-connection'
  | 'permission'
  | 'document-template'
  | 'document-template-reference'
  | 'documents-collection'
  | 'portal-subject'
  | 'portal-invite-subject';

export interface InputDefinition {
  id: string;
  /** REFERÊNCIA de mensagem, ou o rótulo que a extensão digitou; `labelParams` interpola. */
  label: string;
  labelParams?: Record<string, string>;
  description?: string;
  required: boolean;
  type: InputType;
  defaultValue?: unknown;
  options?: InputOptionsSource;
  // Só relevante quando type === 'EntityReference'. É a COLEÇÃO apontada — mesma chave de
  // FieldDefinition.refEntity: `members` (usuários do tenant) ou a coleção de uma tela do Form
  // Design ou de uma extensão. O kernel não conhece nenhuma coleção de negócio pelo nome.
  entityType?: string;
  // O valor `Literal` é uma LISTA do que o input nomeia. Ver `InputDefinition.list` no catálogo.
  list?: boolean;
  // Restringe os tipos de mapping permitidos. Se undefined, todos são permitidos.
  allowedMappingKinds?: Array<'Literal' | 'Event' | 'Expression' | 'Output' | 'Variable'>;
  // O que o valor deste input nomeia, para o editor oferecer a lista. Ver `InputPickerKind`.
  picker?: InputPickerKind;
  // Só para modelos de documento desta origem — ver `templateSource` em `schema/workflowStepCatalog.ts`.
  templateSource?: { is: 'record' | 'payload'; required?: boolean };
  // Validação via regex (somente para Literal string). Mantido por compatibilidade: em runtime é
  // lido como um `rules.validate` equivalente.
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
      /** ID do input (Literal) que guarda o id do Script cujos outputParams viram saídas. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-workflow-outputs';
      /** ID do input (Literal) que guarda o id do workflow-alvo cujas "Saída do Workflow" viram saídas. */
      sourceInputId: string;
      description?: string;
    }
  | {
      kind: 'from-target-workflow-parameters';
      /** ID do input que guarda o id do workflow-alvo cujos PARÂMETROS viram saídas `params.<chave>`. */
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
      /** ID do input do tipo 'Map' cujo MapStepConfig define a saída `<name>` (objeto tipado por `type`). */
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
    }
  | {
      kind: 'from-target-document-template-parameters';
      /** ID do input (Literal) que guarda a chave do modelo `payload` cujos parâmetros viram inputs `param.<chave>`. */
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
  /** Os gatilhos em cuja automação o passo não pode entrar — ver `WorkflowStepMetadata.excludedTriggers`. */
  excludedTriggers?: readonly string[];
}
