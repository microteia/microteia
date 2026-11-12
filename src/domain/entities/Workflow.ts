import type { FieldRules } from '../schema/fieldRules';
import type { WorkflowLoopQuery } from '../schema/workflowLoopQuery';
import type { WorkflowDateReached, WorkflowSchedule } from '../schema/workflowClock';
import type { WorkflowChangeFilter } from '../schema/workflowChangeFilter';
import type { WorkflowContentOrigin } from '../schema/workflowVersion';

/**
 * Os tipos de passo, como ARRAY — a união sai dele, pela mesma razão de `CUSTOM_FIELD_TYPES`: a
 * tabela de passos do `AUTHORING.md` é derivada daqui, e um passo novo entra nela sozinho.
 */
export const STEP_TYPES = ['Action', 'Condition', 'Delay', 'Loop', 'Script', 'SubWorkflow', 'Switch'] as const;

export type StepType = typeof STEP_TYPES[number];

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
  // Só relevante quando eventName é "lookup.saved"/"lookup.deleted": identifica qual coleção de
  // lookup (ex: "personTypes", "caseAreas") dispara o gatilho, já que o evento genérico "lookup.*"
  // não distingue sozinho qual lista mudou (ver domain/services/workflowLookupCatalog.ts).
  lookupCollection?: string;
  // Só relevante quando eventName é "workflow.called": parâmetros que este workflow espera receber
  // de quem o chamar. Definem o schema de `event.` (intellisense e hidratação) do workflow chamado.
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
  // Presente quando o workflow foi materializado pela instalação de um plugin do Marketplace.
  // É a marca que a desinstalação usa para remover exatamente os artefatos daquele plugin, e o
  // sinal de que o registro é gerenciado (o usuário não deve editá-lo à mão). Ver "Fatia vertical
  // do Marketplace" no ARCHITECTURE.md.
  ownerPluginId?: string;
  /** Conjunto de extensões que compartilham este workflow (refcount); removido só quando vazio. */
  ownerPluginIds?: string[];
  /**
   * De onde veio o CONTEÚDO gravado por último — uma edição ou a instalação de uma extensão. O servidor o
   * copia para a versão que guarda (ver `workflowVersion.ts`); quem grava é que sabe.
   */
  contentOrigin?: WorkflowContentOrigin;
  /** Id UNIVERSAL de origem (GUID do artefato no tenant autor) — chave de deduplicação na instalação. */
  sourceId?: string;
  /** Revisão de ORIGEM do artefato (epoch ms do `updatedAt` no autor), carimbada no empacotamento.
   * Monotônica por artefato e independente da extensão que o empacota — a instalação/atualização só
   * reescreve o conteúdo quando a revisão que chega é estritamente maior que a materializada. */
  sourceRev?: number | null;
  enabled: boolean;
  version: number;
  condition: Condition;
  steps: WorkflowStep[];
  createdAt: Date;
  updatedAt: Date;
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
  outputs: Record<string, Record<string, unknown>>;
  /** Só em `WAITING`: quando a execução continua. */
  resumeAt?: Date;
}
