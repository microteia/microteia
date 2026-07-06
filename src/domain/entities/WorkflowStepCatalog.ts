export type InputType =
  | 'String'
  | 'Number'
  | 'Boolean'
  | 'Date'
  | 'EntityReference'
  | 'Expression'
  | 'OutputReference'
  | 'VariableReference';

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
}

export interface OutputDefinition {
  id: string;
  label: string;
  type: InputType;
}

export type StepCategory = 'Action' | 'Data' | 'Notification' | 'Integration';

/**
 * Espelho somente-leitura de StepDefinition (sem `createExecutor`, que só existe em
 * functions/) — lido de `workflow_step_catalog`, alimenta o builder visual. A UI nunca
 * conhece um Step por nome (ex: "CreateDeadline"), só renderiza a partir destes campos.
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
}
