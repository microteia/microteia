import type { FieldRules } from '../schema/fieldRules';
import type { WorkflowLoopQuery } from '../schema/workflowLoopQuery';
import type { WorkflowDateReached, WorkflowSchedule } from '../schema/workflowClock';
import type { WorkflowChangeFilter } from '../schema/workflowChangeFilter';

export type StepType = 'Action' | 'Condition' | 'Delay' | 'Loop' | 'Script' | 'SubWorkflow' | 'Switch' | 'Parallel';

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
  /**
   * Percorre uma CONSULTA em páginas, em vez da lista de `source` (que então não é lida): uma página por
   * volta, a execução pausando entre elas. Ver `workflowLoopQuery.ts`.
   */
  query?: WorkflowLoopQuery;
  /**
   * Quantos itens rodam AO MESMO TEMPO (1 a `MAX_LOOP_CONCURRENCY`). Ausente ou 1: um de cada vez, como
   * sempre. Cada item roda num contexto próprio, e a saída do laço mantém a ORDEM dos itens, não a de
   * chegada. Não vale com `query` (o laço paginado pausa entre páginas). Ver `workflowParallel.ts`.
   */
  concurrency?: number;
}

/**
 * Um caminho de um nó `Switch`: os passos que rodam quando a condição dele é a PRIMEIRA a valer.
 *
 * `id` identifica o caminho dentro do nó — é por ele que o construtor arrasta um passo para dentro
 * dele —, e não se confunde com o id de passo: um caminho não produz saída.
 */
export interface WorkflowSwitchCase {
  id: string;
  /** O nome que o construtor mostra. Texto do escritório: passa intacto por `useLabel`. */
  label?: string;
  condition: Condition;
  steps: WorkflowStep[];
}

/**
 * Configuração de um nó de controle `Switch`: N caminhos avaliados em ordem, e o primeiro cuja
 * condição vale é o único que roda; nenhum valendo, roda `otherwise`. Como a `Condition`, o fluxo
 * converge depois do nó.
 *
 * Existe ao lado da `Condition` porque a decisão de negócio raramente é binária — "por situação",
 * "por faixa de valor" —, e escrevê-la como condições aninhadas era uma escada que ninguém relia.
 */
export interface WorkflowSwitchConfig {
  cases: WorkflowSwitchCase[];
  otherwise: WorkflowStep[];
}

/**
 * Um ramo de um nó `Parallel`: uma sequência de passos que roda AO MESMO TEMPO que os ramos vizinhos.
 *
 * `id` identifica o ramo dentro do nó — é por ele que o construtor arrasta um passo para dentro dele —, e
 * não se confunde com o id de passo.
 */
export interface WorkflowParallelBranch {
  id: string;
  /** O nome que o construtor mostra. Texto do escritório: passa intacto por `useLabel`. */
  label?: string;
  steps: WorkflowStep[];
}

/**
 * Configuração de um nó de controle `Parallel`: os ramos rodam juntos, e o fluxo segue quando TODOS
 * terminam. Ver `workflowParallel.ts` para as regras que o tornam seguro.
 */
export interface WorkflowParallelConfig {
  branches: WorkflowParallelBranch[];
}

/**
 * O que o motor faz quando ESTE passo falha.
 *
 * `retries` tenta de novo, na mesma execução, antes de desistir — para a falha passageira (um
 * serviço fora do ar por um instante). `continue` segue para o próximo passo, publicando
 * `failed: true` e `error` como saída deste, para que um passo seguinte decida o que fazer. O padrão
 * é o de sempre: a falha encerra a execução.
 *
 * Tentar de novo é decisão de quem DECLARA: um passo que já gravou algo antes de falhar gravaria de
 * novo. Por isso não há tentativa automática — só a declarada.
 */
export interface WorkflowStepErrorPolicy {
  action?: 'fail' | 'continue';
  /** 0 a `MAX_STEP_RETRIES`. */
  retries?: number;
}

export interface WorkflowStep {
  id: string;
  stepDefinitionId: string;
  type: StepType;
  order: number;
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
  /** Somente quando type === 'Switch' (nó de controle nativo). Ver WorkflowSwitchConfig. */
  switch?: WorkflowSwitchConfig;
  /** Somente quando type === 'Parallel' (nó de controle nativo). Ver WorkflowParallelConfig. */
  parallel?: WorkflowParallelConfig;
  /** Só em passos do catálogo (`type: 'Action'`). Ausente = a falha encerra a execução. */
  onError?: WorkflowStepErrorPolicy;
}

/** O teto de novas tentativas de um passo: mais que isso é laço, e o orçamento da execução acaba antes. */
export const MAX_STEP_RETRIES = 3;

// Condições para filtrar quando o workflow deve executar (avaliadas ANTES de qualquer Step)

// Sempre executa (padrão, compatibilidade com workflows existentes)
export interface AlwaysTrueCondition {
  kind: 'AlwaysTrue';
}

// Comparação de campo único
export interface FieldComparisonCondition {
  kind: 'FieldComparison';
  fieldPath: string;         // Caminho do campo (ex: "status", "event.payload.parentId")
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

/**
 * O filtro de mudança (`changeType`, `changedFields`) vale só para os gatilhos de registro SALVO.
 * Ver `workflowChangeFilter.ts`.
 */
export interface WorkflowDefinition extends WorkflowChangeFilter {
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
  /**
   * Só relevante quando eventName é "schedule": QUANDO o relógio do kernel acorda esta automação.
   * Ver "Gatilhos temporais" no ARCHITECTURE.md.
   */
  schedule?: WorkflowSchedule;
  /**
   * Só relevante quando eventName é "<coleção>.dateReached": QUAL data do registro, com que
   * deslocamento e a que hora. Ver "Gatilhos temporais" no ARCHITECTURE.md.
   */
  dateReached?: WorkflowDateReached;
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
  /** A única automação que o evento acorda, quando ele tem dono (o relógio do kernel). Ver `workflowEventDocument`. */
  target?: string;
}

/**
 * `WAITING`: parada num passo `delay`, com hora para continuar (`resumeAt`) — a MESMA execução segue
 * depois, no mesmo histórico. `CANCELLED`: a espera acabou e não havia mais o que continuar (a automação
 * foi desligada, apagada, ou perdeu o passo em que parou).
 */
export type WorkflowExecutionStatus = 'RUNNING' | 'SUCCESS' | 'FAILED' | 'PARTIAL' | 'WAITING' | 'CANCELLED';

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
  /** Só em `WAITING`: quando a execução continua. */
  resumeAt?: Date;
}
