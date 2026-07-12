import type { FieldRules } from '../schema/fieldRules';

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
  signature?: string;
  configuration: Record<string, InputMapping>;
  enabled: boolean;
}

// Condições para filtrar quando o workflow deve executar (avaliadas ANTES de qualquer Step)

// Sempre executa (padrão, compatibilidade com workflows existentes)
export interface AlwaysTrueCondition {
  kind: 'AlwaysTrue';
}

// Comparação de campo único
export interface FieldComparisonCondition {
  kind: 'FieldComparison';
  fieldPath: string;         // Caminho do campo (ex: "status", "event.payload.caseId")
  operator: '==' | '!=' | '>' | '>=' | '<' | '<=' | 'contains' | 'startsWith' | 'endsWith' | 'isEmpty' | 'isNotEmpty';
  value: unknown;            // Valor a comparar
  valueType: 'literal' | 'expression' | 'eventField';  // Como interpretar o valor
}

// Operador lógico AND (todas as condições devem ser verdadeiras)
export interface LogicalAndCondition {
  kind: 'LogicalAnd';
  conditions: Condition[];
}

// Operador lógico OR (pelo menos uma condição deve ser verdadeira)
export interface LogicalOrCondition {
  kind: 'LogicalOr';
  conditions: Condition[];
}

// Negação (inverte o resultado da condição)
export interface NotCondition {
  kind: 'Not';
  condition: Condition;
}

// Expressão pura avaliada pelo motor de expressões; o resultado é convertido para booleano
export interface ExpressionCondition {
  kind: 'Expression';
  expression: string;
}

export type Condition =
  | AlwaysTrueCondition
  | FieldComparisonCondition
  | LogicalAndCondition
  | LogicalOrCondition
  | NotCondition
  | ExpressionCondition;

export type WorkflowParameterType = 'String' | 'Number' | 'Date' | 'Boolean' | 'select' | 'EntityReference' | 'Object';

export interface WorkflowParameter {
  key: string;
  label: string;
  type: WorkflowParameterType;
  required?: boolean;
  entityType?: string;
  multi?: boolean;
  options?: { value: string; label: string }[];
  fields?: WorkflowParameter[];
  defaultValue?: unknown;
  rules?: FieldRules;
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
  // Só relevante quando eventName é "lookup.saved"/"lookup.deleted": identifica qual coleção de
  // lookup (ex: "personTypes", "caseAreas") dispara o gatilho, já que o evento genérico "lookup.*"
  // não distingue sozinho qual lista mudou.
  lookupCollection?: string;
  parameters?: WorkflowParameter[];
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
  level: 'SUCCESS' | 'INFO' | 'WARN' | 'ERROR';
  message: string;
  at: Date;
  contextInput?: Record<string, unknown>; // Contexto de entrada do step (output do step anterior ou evento)
  inputs?: Record<string, unknown>; // Parâmetros configurados e resolvidos do step
  outputs?: Record<string, unknown>;
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
  outputs: Record<string, unknown>;
}
