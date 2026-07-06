export type StepType = 'Action' | 'Condition' | 'Delay' | 'Script' | 'SubWorkflow';

export interface LiteralInputMapping {
  kind: 'Literal';
  value: unknown;
}

export interface EventInputMapping {
  kind: 'Event';
  path: string;
}

export interface ExpressionInputMapping {
  kind: 'Expression';
  expression: string;
}

export interface OutputInputMapping {
  kind: 'Output';
  stepId: string;
  outputId: string;
}

export interface VariableInputMapping {
  kind: 'Variable';
  name: string;
}

export type InputMapping =
  | LiteralInputMapping
  | EventInputMapping
  | ExpressionInputMapping
  | OutputInputMapping
  | VariableInputMapping;

export interface WorkflowStep {
  id: string;
  stepDefinitionId: string;
  type: StepType;
  order: number;
  name?: string;
  configuration: Record<string, InputMapping>;
  enabled: boolean;
}

export interface Condition {
  kind: 'AlwaysTrue';
}

export interface WorkflowDefinition {
  id: string;
  tenantId: string;
  name: string;
  description?: string;
  eventName: string;
  // Só relevante quando eventName é "custom_record.saved"/"custom_record.deleted": identifica
  // qual ScreenDefinition (entidade customizada) dispara o gatilho, já que todos os registros
  // dessas entidades ficam numa única coleção Firestore discriminada por screenKey.
  screenKey?: string;
  enabled: boolean;
  version: number;
  condition: Condition;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
}

export interface WorkflowEvent {
  id: string;
  tenantId: string;
  name: string;
  payload: Record<string, unknown>;
  timestamp: Date;
  sourceModule?: string;
}

export type WorkflowExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL';

export interface WorkflowExecutionLogEntry {
  stepId?: string;
  stepDefinitionId?: string;
  level: 'INFO' | 'WARN' | 'ERROR';
  message: string;
  at: Date;
}

export interface WorkflowExecution {
  id: string;
  tenantId: string;
  workflowDefinitionId: string;
  eventId: string;
  status: WorkflowExecutionStatus;
  startedAt: Date;
  finishedAt?: Date;
  logs: WorkflowExecutionLogEntry[];
  outputs: Record<string, Record<string, unknown>>;
}
