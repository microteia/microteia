import type { FieldRules } from '../schema/fieldRules';

export type StepType = 'Action' | 'Condition' | 'Delay' | 'Loop' | 'Script' | 'SubWorkflow';

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

// Ramos de um nó de controle StepCondition: os Steps executados quando a condição é
// verdadeira e os executados quando é falsa. Cada ramo é uma sequência própria de Steps
// (recursiva — pode conter outros StepCondition). Após o ramo, o fluxo converge de volta.
export interface WorkflowStepBranches {
  whenTrue: WorkflowStep[];
  whenFalse: WorkflowStep[];
}

// Configuração de um nó de controle Loop (ForEach): itera `source` (lista ou item único, que vira
// lista de 1) executando `body` uma vez por item. Cada iteração recebe o item no input (objeto é
// espalhado; escalar fica sob `itemName`) e contribui com o output do seu último substep. Ao final,
// o vetor de contribuições é publicado sob `outputName` para o próximo Step. `stepDefinitionId`
// fica vazio nesses nós.
export interface WorkflowLoopConfig {
  source: InputMapping;
  itemName: string;
  outputName: string;
  body: WorkflowStep[];
}

export interface WorkflowStep {
  id: string;
  stepDefinitionId: string;
  type: StepType;
  order: number;
  name?: string;
  signature?: string;
  configuration: Record<string, InputMapping>;
  enabled: boolean;
  // Somente quando type === 'Condition' (nó de controle de fluxo nativo, não um plugin do
  // StepRegistry). `condition` é avaliada em runtime sobre o contexto acumulado e decide qual
  // ramo de `branches` executa. `stepDefinitionId` fica vazio nesses nós.
  condition?: Condition;
  branches?: WorkflowStepBranches;
  // Somente quando type === 'Loop' (nó de controle nativo). Ver WorkflowLoopConfig.
  loop?: WorkflowLoopConfig;
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

export type WorkflowParameterType = 'String' | 'Number' | 'Date' | 'Boolean' | 'select' | 'lookup' | 'EntityReference' | 'Object';

export interface WorkflowParameter {
  key: string;
  label: string;
  type: WorkflowParameterType;
  required?: boolean;
  list?: boolean;
  /** Só relevante quando type é 'EntityReference': a COLEÇÃO apontada, nunca a chave da tela. */
  entityType?: string;
  /**
   * Só relevante quando type é 'lookup': a coleção da lista de opções do escritório (a mesma chave
   * que um campo de tela usa em `lookupCollection`). O valor do parâmetro é a CHAVE da opção.
   */
  lookupCollection?: string;
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
  /**
   * O conjunto de extensões DONAS, e o id universal de origem. Ver a nota gêmea em `Script` — é a
   * referência qualificada de uma extensão ao artefato de outra que os traz para o backend.
   */
  ownerPluginIds?: string[] | null;
  sourceId?: string | null;
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
  /**
   * REFERÊNCIA de mensagem (`@core.automation/…`); a tela resolve com o catálogo de quem lê.
   */
  message: string;
  messageParams?: Record<string, string>;
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
