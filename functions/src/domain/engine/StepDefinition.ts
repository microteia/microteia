import type { WorkflowContext, WorkflowResult } from '../entities/WorkflowContext';

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
  validator?: (value: unknown) => string | undefined;
  options?: InputOptionsSource;
}

export interface OutputDefinition {
  id: string;
  label: string;
  type: InputType;
}

export type StepCategory = 'Action' | 'Data' | 'Notification' | 'Integration';

export interface WorkflowStepExecutor {
  execute(inputs: Record<string, unknown>, context: WorkflowContext): Promise<WorkflowResult>;
}

export interface StepDefinition {
  id: string;
  version: number;
  name: string;
  description: string;
  icon: string;
  category: StepCategory;
  configurable: boolean;
  inputs: InputDefinition[];
  outputDefinitions: OutputDefinition[];
  createExecutor(): WorkflowStepExecutor;
}
