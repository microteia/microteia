import type { Condition, InputMapping, WorkflowDefinition, WorkflowParameter, WorkflowStep } from '../../entities/Workflow';
import type { MessageCatalog } from '../i18n/messages';
import { resolveLabel } from '../i18n/messageRef';
import type { WorkflowStepMetadata } from '../workflowStepCatalog';
import { CORE_STEP_CATALOG, isPausingStepDefinition } from '../workflowStepCatalog';
import { returningStepsOf } from '../workflowReturn';
import { WORKFLOW_CALLED_EVENT, splitEntityEventName } from '../eventCatalog';
import { DEFAULT_DATE_REACHED_AT, WORKFLOW_SCHEDULE_EVENT } from '../workflowClock';
import { agentParameterAccepts, agentParameterPlaceholder } from './agentOps';
import type { AgentWorkflowTrigger } from './agentOps';

/**
 * Uma automação como um agente precisa vê-la para chamá-la sem tentativa e erro.
 *
 * O recurso `microteia://office/workflows` lia `name` de cada parâmetro — e o parâmetro é gravado
 * como `key`. Todo parâmetro chegava ao agente com `"name": ""`, e ele não tinha como saber o que
 * mandar. A correção não é trocar o nome do campo: é a descrição sair de UM lugar, usado pelo
 * recurso e por `describe_workflow`, para que as duas respostas não possam divergir.
 */

export interface AgentParameter {
  key: string;
  label: string;
  type: WorkflowParameter['type'];
  required: boolean;
  /** Recebe uma LISTA de valores, cada um na forma descrita. */
  list?: true;
  /** Como o valor é escrito. Texto de API, como a descrição de uma ferramenta. */
  accepts: string;
  /** A coleção cujo `id` de registro é o valor (`EntityReference`). */
  references?: string;
  /** A lista do escritório cuja CHAVE de item é o valor (`lookup`). Lida com `search_records`. */
  optionsFrom?: string;
  /** A lista fechada (`select`). Grava-se o `value`, nunca o `label`. */
  options?: { value: string; label: string }[];
  default?: unknown;
  /** A máscara que o valor recebe antes de ser conferido. */
  format?: string;
  /** O padrão que o valor precisa satisfazer. */
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  /** Os campos de um parâmetro `Object`, na mesma forma. */
  fields?: AgentParameter[];
  example: unknown;
}


const exampleOf = (parameter: WorkflowParameter): unknown => {
  if (parameter.defaultValue !== undefined && parameter.defaultValue !== null && parameter.defaultValue !== '') {
    return parameter.defaultValue;
  }
  switch (parameter.type) {
    case 'Number': return 1;
    case 'Date': return '2026-01-31';
    case 'Boolean': return true;
    case 'select': return parameter.options?.[0]?.value ?? '';
    case 'lookup': return agentParameterPlaceholder('lookup', parameter.lookupCollection);
    case 'EntityReference': return agentParameterPlaceholder('EntityReference', parameter.entityType);
    case 'Object':
      return Object.fromEntries((parameter.fields ?? []).map((field) => [field.key, describedExample(field)]));
    default: return agentParameterPlaceholder('String');
  }
};

const describedExample = (parameter: WorkflowParameter): unknown =>
  parameter.list ? [exampleOf(parameter)] : exampleOf(parameter);

export const describeParameter = (catalog: MessageCatalog, parameter: WorkflowParameter): AgentParameter => ({
  key: parameter.key,
  label: resolveLabel(catalog, parameter.label || parameter.key),
  type: parameter.type,
  required: parameter.required === true,
  ...(parameter.list ? { list: true as const } : {}),
  accepts: agentParameterAccepts(parameter.type, parameter.list === true),
  ...(parameter.type === 'EntityReference' && parameter.entityType ? { references: parameter.entityType } : {}),
  ...(parameter.type === 'lookup' && parameter.lookupCollection ? { optionsFrom: parameter.lookupCollection } : {}),
  ...(parameter.options && parameter.options.length > 0
    ? { options: parameter.options.map((one) => ({ value: one.value, label: resolveLabel(catalog, one.label) })) }
    : {}),
  ...(parameter.defaultValue === undefined ? {} : { default: parameter.defaultValue }),
  ...(parameter.rules?.format?.preset ? { format: parameter.rules.format.preset } : {}),
  ...(parameter.rules?.validate?.pattern ? { pattern: parameter.rules.validate.pattern } : {}),
  ...(parameter.rules?.validate?.minLength === undefined ? {} : { minLength: parameter.rules.validate.minLength }),
  ...(parameter.rules?.validate?.maxLength === undefined ? {} : { maxLength: parameter.rules.validate.maxLength }),
  ...(parameter.type === 'Object'
    ? { fields: (parameter.fields ?? []).map((field) => describeParameter(catalog, field)) }
    : {}),
  example: describedExample(parameter),
});

export const describeParameters = (
  catalog: MessageCatalog,
  parameters: readonly WorkflowParameter[] | undefined,
): AgentParameter[] => (parameters ?? []).map((parameter) => describeParameter(catalog, parameter));

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/**
 * As chaves enviadas que nenhum parâmetro declara, com o caminho completo (`parte.nome`).
 *
 * O motor as descartava em silêncio, e a execução terminava SUCCESS sem ter recebido nada — o agente
 * concluía que tinha dado certo. Desce em `Object`, item a item quando é lista, porque um nome
 * errado lá dentro se perde do mesmo jeito.
 */
export const unknownParameterKeys = (
  parameters: readonly WorkflowParameter[] | undefined,
  values: Record<string, unknown>,
  prefix = '',
): string[] => {
  const byKey = new Map((parameters ?? []).map((parameter) => [parameter.key, parameter]));
  return Object.entries(values).flatMap(([key, value]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    const parameter = byKey.get(key);
    if (parameter === undefined) return [path];
    if (parameter.type !== 'Object') return [];
    const items = parameter.list && Array.isArray(value) ? value : [value];
    return items.flatMap((item, index) =>
      isPlainObject(item)
        ? unknownParameterKeys(parameter.fields, item, parameter.list ? `${path}[${index}]` : path)
        : []);
  });
};

/**
 * A ligação de um input, sem a forma interna do `InputMapping`. O `kind` vira a CHAVE do objeto,
 * que é o que se lê de relance: `{ "event": "caseNumber" }` diz de onde vem o valor.
 */
const describeMapping = (mapping: InputMapping): Record<string, unknown> => {
  switch (mapping.kind) {
    case 'Literal': return { value: mapping.value };
    case 'Event': return { event: mapping.path };
    case 'Expression': return { expression: mapping.expression };
    case 'Output': return { output: `${mapping.stepId}.${mapping.outputId}` };
    case 'Variable': return { variable: mapping.name };
    default: return {};
  }
};

/**
 * O efeito de um passo sobre dados, lido do TIPO de input que o catálogo declara — nunca do id do
 * passo. `Query` lê, `Upsert` grava, `Remove` exclui; é o que vale para qualquer passo que use essas
 * entradas, inclusive um que uma extensão registre.
 */
const DATA_INPUT_EFFECT: Readonly<Record<string, 'reads' | 'writes' | 'deletes'>> = {
  Query: 'reads',
  Upsert: 'writes',
  Remove: 'deletes',
};

const literalTable = (mapping: InputMapping | undefined): string | null => {
  if (mapping?.kind !== 'Literal' || !isPlainObject(mapping.value)) return null;
  const table = mapping.value.table;
  return typeof table === 'string' && table.trim() !== '' ? table : null;
};

const literalText = (mapping: InputMapping | undefined): string | null =>
  mapping?.kind === 'Literal' && typeof mapping.value === 'string' && mapping.value.trim() !== ''
    ? mapping.value
    : null;

export interface AgentStepSummary {
  id: string;
  /** `step` é um passo do catálogo; `condition` e `loop` são nós de controle do motor. */
  kind: 'step' | 'condition' | 'loop';
  /** O nome do passo no catálogo. Ausente nos nós de controle, que o `kind` já nomeia. */
  name?: string;
  /** O id do passo no catálogo. Ausente nos nós de controle. */
  step?: string;
  enabled?: false;
  inputs?: Record<string, Record<string, unknown>>;
  reads?: string;
  writes?: string;
  deletes?: string;
  /** A automação que este passo chama (`call-workflow`), quando ela é fixa. */
  calls?: string;
  /** O Script que este passo executa — o que ele faz não se lê daqui. */
  runsScript?: string;
  condition?: Condition;
  whenTrue?: AgentStepSummary[];
  whenFalse?: AgentStepSummary[];
  loop?: { over: Record<string, unknown>; itemName: string; outputName: string; body: AgentStepSummary[] };
}

type StepCatalog = ReadonlyMap<string, WorkflowStepMetadata>;

const byOrder = (a: WorkflowStep, b: WorkflowStep): number => a.order - b.order;

const summarizeStep = (catalog: MessageCatalog, steps: StepCatalog, step: WorkflowStep): AgentStepSummary => {
  const disabled = step.enabled === false ? { enabled: false as const } : {};

  if (step.type === 'Condition') {
    return {
      id: step.id,
      kind: 'condition',
      ...disabled,
      ...(step.condition ? { condition: step.condition } : {}),
      whenTrue: summarizeSteps(catalog, steps, step.branches?.whenTrue ?? []),
      whenFalse: summarizeSteps(catalog, steps, step.branches?.whenFalse ?? []),
    };
  }
  if (step.type === 'Loop' && step.loop) {
    return {
      id: step.id,
      kind: 'loop',
      ...disabled,
      loop: {
        over: describeMapping(step.loop.source),
        itemName: step.loop.itemName,
        outputName: step.loop.outputName,
        body: summarizeSteps(catalog, steps, step.loop.body),
      },
    };
  }

  const metadata = steps.get(step.stepDefinitionId);
  const effects: Partial<AgentStepSummary> = {};
  for (const input of metadata?.inputs ?? []) {
    const effect = DATA_INPUT_EFFECT[input.type];
    const table = effect ? literalTable(step.configuration[input.id]) : null;
    if (effect && table) effects[effect] = table;
  }
  if (metadata?.type === 'SubWorkflow') {
    const target = literalText(step.configuration[metadata.dynamicInputs?.sourceInputId ?? '']);
    if (target) effects.calls = target;
  }
  if (metadata?.type === 'Script') {
    const script = literalText(step.configuration[metadata.dynamicInputs?.sourceInputId ?? '']);
    if (script) effects.runsScript = script;
  }

  const inputs = Object.entries(step.configuration ?? {});
  return {
    id: step.id,
    kind: 'step',
    name: metadata ? resolveLabel(catalog, metadata.name) : step.stepDefinitionId,
    step: step.stepDefinitionId,
    ...disabled,
    ...effects,
    ...(inputs.length > 0
      ? { inputs: Object.fromEntries(inputs.map(([id, mapping]) => [id, describeMapping(mapping)])) }
      : {}),
  };
};

export const summarizeSteps = (
  catalog: MessageCatalog,
  steps: StepCatalog,
  list: readonly WorkflowStep[],
): AgentStepSummary[] => [...list].sort(byOrder).map((step) => summarizeStep(catalog, steps, step));

const walk = (summaries: readonly AgentStepSummary[]): AgentStepSummary[] =>
  summaries.flatMap((one) => [
    one,
    ...walk(one.whenTrue ?? []),
    ...walk(one.whenFalse ?? []),
    ...walk(one.loop?.body ?? []),
  ]);

/**
 * Se rodar duas vezes deixa o escritório como uma vez.
 *
 * É um VEREDITO com um MOTIVO de vocabulário fechado, e não uma frase: o modelo decide por ele se
 * pode repetir uma chamada que talvez tenha falhado no meio.
 *
 * - `reads-only` — nada é gravado.
 * - `keyed-writes` — toda coleção gravada tem chave única: a repetição é RECUSADA como duplicata, e
 *   não vira um segundo registro.
 * - `may-duplicate` — grava numa coleção sem chave única; repetir pode criar registros a mais.
 * - `notifies` — um passo de notificação manda de novo a cada execução.
 * - `appends` — um passo acrescenta um artefato novo a cada execução (`appendsEachRun` no catálogo),
 *   como o documento gerado e anexado ao registro.
 * - `opaque-steps` — há Script, chamada de outra automação ou passo desconhecido, cujo efeito não se
 *   lê da declaração.
 */
export type AgentIdempotency =
  | { idempotent: 'yes'; because: 'reads-only' | 'keyed-writes' }
  | { idempotent: 'no'; because: 'may-duplicate' | 'notifies' | 'appends' }
  | { idempotent: 'unknown'; because: 'opaque-steps' };

export interface AgentWorkflowDataAccess {
  reads: string[];
  writes: { collection: string; uniqueKeys: string[] }[];
  deletes: string[];
  calls: string[];
  scripts: string[];
}

const unique = (values: readonly string[]): string[] => [...new Set(values)].sort();

export const workflowDataAccess = (
  summaries: readonly AgentStepSummary[],
  uniqueKeysOf: (collection: string) => string[],
): AgentWorkflowDataAccess => {
  const enabled = walk(summaries).filter((one) => one.enabled !== false);
  return {
    reads: unique(enabled.flatMap((one) => (one.reads ? [one.reads] : []))),
    writes: unique(enabled.flatMap((one) => (one.writes ? [one.writes] : [])))
      .map((collection) => ({ collection, uniqueKeys: uniqueKeysOf(collection) })),
    deletes: unique(enabled.flatMap((one) => (one.deletes ? [one.deletes] : []))),
    calls: unique(enabled.flatMap((one) => (one.calls ? [one.calls] : []))),
    scripts: unique(enabled.flatMap((one) => (one.runsScript ? [one.runsScript] : []))),
  };
};

export const workflowIdempotency = (
  summaries: readonly AgentStepSummary[],
  access: AgentWorkflowDataAccess,
  steps: StepCatalog,
): AgentIdempotency => {
  const enabled = walk(summaries).filter((one) => one.enabled !== false && one.kind === 'step');
  const opaque = enabled.some((one) => {
    const metadata = steps.get(one.step ?? '');
    return metadata === undefined || metadata.type === 'Script' || metadata.type === 'SubWorkflow';
  });
  if (opaque) return { idempotent: 'unknown', because: 'opaque-steps' };

  const notifies = enabled.some((one) => steps.get(one.step ?? '')?.category === 'Notification');
  if (notifies) return { idempotent: 'no', because: 'notifies' };

  const appends = enabled.some((one) => steps.get(one.step ?? '')?.appendsEachRun === true);
  if (appends) return { idempotent: 'no', because: 'appends' };

  if (access.writes.length === 0) return { idempotent: 'yes', because: 'reads-only' };
  return access.writes.every((write) => write.uniqueKeys.length > 0)
    ? { idempotent: 'yes', because: 'keyed-writes' }
    : { idempotent: 'no', because: 'may-duplicate' };
};

/**
 * Onde a execução PAUSA e retoma depois (`get_workflow_run` responde `WAITING` com `resumeAt`). Só o
 * nível principal pausa — é a regra do motor —, então só ele é lido. Sem isto o agente via a execução
 * parada e concluía que tinha acabado, ou que travou.
 */
export const workflowPauses = (summaries: readonly AgentStepSummary[]): string[] =>
  summaries
    .filter((one) => one.kind === 'step' && one.enabled !== false && isPausingStepDefinition(one.step))
    .map((one) => one.id);

export interface AgentWorkflowOutput {
  /** O passo cujas saídas viram o resultado — mais de um quando depende do ramo que executar. */
  step: string;
  name?: string;
  fields: { key: string; label: string; type: string }[];
  /** As saídas deste passo dependem da configuração e só são conhecidas ao rodar. */
  dynamic?: true;
}

/** O formato do resultado, pela MESMA regra que o editor usa (`returningStepsOf`). */
export const workflowOutputs = (
  catalog: MessageCatalog,
  steps: StepCatalog,
  workflowSteps: WorkflowStep[],
): AgentWorkflowOutput[] =>
  returningStepsOf(workflowSteps).map((step) => {
    if (step.type === 'Loop' && step.loop) {
      return {
        step: step.id,
        fields: [{ key: step.loop.outputName, label: step.loop.outputName, type: 'List' }],
      };
    }
    const metadata = steps.get(step.stepDefinitionId);
    return {
      step: step.id,
      name: metadata ? resolveLabel(catalog, metadata.name) : step.stepDefinitionId,
      fields: (metadata?.outputDefinitions ?? []).map((output) => ({
        key: output.id,
        label: resolveLabel(catalog, output.label),
        type: output.type,
      })),
      ...(metadata === undefined || metadata.dynamicOutputs ? { dynamic: true as const } : {}),
    };
  });

/** O catálogo de passos indexado, com os do kernel como base e os registrados por cima. */
export const indexStepCatalog = (registered: readonly WorkflowStepMetadata[] = []): StepCatalog =>
  new Map([...CORE_STEP_CATALOG, ...registered].map((step) => [step.id, step]));

export interface AgentTriggerDescription {
  kind: AgentWorkflowTrigger;
  /** O prefixo de evento da coleção (`record` e `date-reached`) — o mesmo nome que a tela emite. */
  on?: string;
  /** `record`: em que gesto sobre o registro. */
  when?: 'saved' | 'deleted';
  /** `date-reached`: o campo vigiado, o deslocamento em dias e a hora no fuso do escritório. */
  field?: string;
  offset?: string;
  at?: string;
  /** `schedule`: o cron, e o fuso só quando a automação sobrescreve o do escritório. */
  cron?: string;
  timeZone?: string;
  /** `other`: o nome do evento, para o que não tem vocabulário próprio (lista de opções, nota, anexo). */
  eventName?: string;
}

/**
 * Como a automação nasce, lido da declaração. É a mesma regra de quem a dispara de verdade: o relógio
 * (`schedule`, `dateReached`), o publicador de gravação (`saved`/`deleted`) e quem chama (`called`).
 */
export const describeWorkflowTrigger = (
  definition: Pick<WorkflowDefinition, 'eventName' | 'schedule' | 'dateReached'>,
): AgentTriggerDescription => {
  if (definition.eventName === WORKFLOW_CALLED_EVENT) return { kind: 'called' };
  if (definition.eventName === WORKFLOW_SCHEDULE_EVENT) {
    return {
      kind: 'schedule',
      cron: definition.schedule?.cron ?? '',
      ...(definition.schedule?.timeZone ? { timeZone: definition.schedule.timeZone } : {}),
    };
  }
  const entity = splitEntityEventName(definition.eventName);
  if (entity?.action === 'dateReached') {
    return {
      kind: 'date-reached',
      on: entity.prefix,
      field: definition.dateReached?.field ?? '',
      offset: definition.dateReached?.offset ?? '0d',
      at: definition.dateReached?.at ?? DEFAULT_DATE_REACHED_AT,
    };
  }
  if (entity) return { kind: 'record', on: entity.prefix, when: entity.action };
  return { kind: 'other', eventName: definition.eventName };
};
