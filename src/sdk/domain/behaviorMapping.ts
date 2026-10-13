import { ENTITY_EVENT_ACTIONS, WORKFLOW_CALLED_EVENT, WORKFLOW_EVENT_CATALOG } from '../../domain/schema/eventCatalog';
import { DATE_REACHED_ACTION, WORKFLOW_SCHEDULE_EVENT } from '../../domain/schema/workflowClock';
import type { WorkflowDateReached, WorkflowSchedule } from '../../domain/schema/workflowClock';
import { CONTROL_STEP_TYPES } from '../../domain/schema/workflowStepCatalog';
import type { BehaviorEffect, BehaviorTransition, EffectKind } from './behaviorModel';
import { effectEntity, isSelfLoop } from './behaviorModel';

/**
 * A TRADUÇÃO — comportamento para mecanismo que existe mesmo, e RECUSA alta para o que não existe.
 *
 * É a tabela irmã de `STORAGE_MECHANISMS`, e existe pelo mesmo motivo: um modelo pode descrever
 * qualquer coisa, e a plataforma tem um número finito de mecanismos. Um plano que aceitasse
 * `trigger: schedule` e depois não gerasse relógio nenhum seria pior que a ausência do campo — o
 * autor entregaria "cobrança vence todo dia 5" e ninguém nunca seria cobrado, sem erro em lugar
 * nenhum.
 *
 * O que cada linha é obrigada a fazer:
 *
 * - **Nomear um mecanismo REAL, pelo identificador dele.** `stepIds` são conferidos contra
 *   `CORE_STEP_DEFINITION_IDS` e `CONTROL_STEP_TYPES` no teste, e é o que impede a tabela de
 *   prometer um passo que ninguém registrou (`Delay` é o precedente: está na união de tipos, nunca
 *   foi implementado, e o guia prometia "espera antes dos passos seguintes").
 * - **Dizer `supported: false` quando não há mecanismo**, com o motivo no lugar da promessa.
 *
 * E o que ela NÃO é: um construtor. Ela diz o que precisa existir; quem escreve o `plugin.ts` é o
 * autor, exatamente como `generate_artifact_plan` devolve plano e nunca arquivo.
 */

/**
 * Existe gatilho de RELÓGIO nesta instalação?
 *
 * Derivado, e não escrito à mão: todo gatilho de workflow é uma entrada de
 * `WORKFLOW_EVENT_CATALOG`, e nenhuma delas é temporal. No dia em que o kernel publicar um
 * `schedule.*`, esta constante vira `true` sozinha e a recusa desaparece com ela — que é o oposto
 * de uma frase de documentação dizendo "não há agendamento", verdadeira até alguém acrescentar um.
 */
const SCHEDULE_EVENT_PATTERN = /^(schedule|cron|timer)\b/;

export const SCHEDULE_EVENTS: string[] = WORKFLOW_EVENT_CATALOG
  .map((entry) => entry.name)
  .filter((name) => SCHEDULE_EVENT_PATTERN.test(name));

export const SCHEDULE_TRIGGER_SUPPORTED = SCHEDULE_EVENTS.length > 0;

/**
 * Os eventos cujos fluxos são CANDIDATOS de uma superfície que os escolhe sozinha, e que por isso
 * exigem descrição.
 *
 * Derivado, e é o que impede a lista de mentir: o passo `ai-detect-workflow` monta os candidatos com
 * `findEnabledByEvent(tenantId, WORKFLOW_CALLED_EVENT)` e então descarta todo fluxo cuja
 * `description` esteja vazia — o filtro está no passo, e outra vez em `detectWorkflowIds`. Um fluxo
 * chamável sem descrição instala, roda quando alguém aperta o botão, e é invisível para a única
 * superfície que o escolheria por conta própria: nenhuma tela mostra a ausência, e nenhum teste
 * reprova. Este é o único evento assim hoje.
 */
export const DESCRIPTION_REQUIRED_EVENTS: string[] = [WORKFLOW_CALLED_EVENT];

/**
 * O mecanismo que exige a descrição, nomeado uma vez — o plano, o detector e o guia citam a MESMA
 * frase, em vez de três redações do mesmo motivo.
 */
export const DESCRIPTION_REQUIRED_BECAUSE =
  'the "ai-detect-workflow" step lists callable flows and drops every one whose description is empty, '
  + 'so a flow with none is invisible to the only surface that picks a flow on its own';

export const BEHAVIOR_CONCERNS = ['trigger', 'guard', 'effect', 'invariant', 'permission'] as const;
export type BehaviorConcern = (typeof BEHAVIOR_CONCERNS)[number];

export interface BehaviorMechanism {
  concern: BehaviorConcern;
  /** O que o modelo declara — o valor, tal como ele é escrito. */
  declares: string;
  /** O mecanismo da plataforma que o consome, em uma linha. */
  mechanism: string;
  /** A declaração concreta, do jeito que o autor a escreve no pacote. */
  declaredAs: string;
  /** Os passos citados, por `stepDefinitionId` (ou nó de controle). Vazio quando não há passo. */
  stepIds: string[];
  /** `false` = não existe mecanismo; a recusa vai com o motivo. */
  supported: boolean;
}

/**
 * Uma linha por mecanismo, e são estas. Fonte também do recurso `microteia://domain-model/rules` e da tabela do
 * `AGENTS.md` — a documentação lê daqui, e não de uma cópia em prosa que envelhece sozinha.
 */
export const BEHAVIOR_MECHANISMS: BehaviorMechanism[] = [
  {
    concern: 'trigger',
    declares: 'entity-event',
    mechanism: `a workflow listening to the collection's own event (\`<eventPrefix ?? collection>.${ENTITY_EVENT_ACTIONS[0]}\`)`,
    declaredAs: "workflows: [{ eventName: '<collection>.saved', condition, steps }]",
    stepIds: [],
    supported: true,
  },
  {
    concern: 'trigger',
    declares: 'user-action',
    mechanism: `a callable workflow (\`${WORKFLOW_CALLED_EVENT}\`) plus the record action that invokes it`,
    declaredAs:
      `workflows: [{ eventName: '${WORKFLOW_CALLED_EVENT}', parameters, steps }] `
      + 'PLUS actions: [{ key, workflowId: <that templateId> }], and the action is listed in the target '
      + "screen's cardActionIds / viewActionIds",
    stepIds: [],
    supported: true,
  },
  {
    concern: 'trigger',
    declares: 'schedule',
    mechanism: SCHEDULE_TRIGGER_SUPPORTED
      ? `the kernel clock (\`${SCHEDULE_EVENTS.join(', ')}\`): it wakes the workflow at the cron time, in the office time `
        + 'zone, with no record and no actor — the workflow queries the records in the `from` state and loops over them'
      : 'NONE. No event in this installation is time-based, and the `Delay` step type was never registered either',
    declaredAs: SCHEDULE_TRIGGER_SUPPORTED
      ? `workflows: [{ eventName: '${WORKFLOW_SCHEDULE_EVENT}', schedule: { cron: <when> }, steps: [query, Loop] }]`
      : 'nothing declares it. Move the decision to the moment something is WRITTEN or a person acts',
    stepIds: SCHEDULE_TRIGGER_SUPPORTED ? ['query', 'Loop'] : [],
    supported: SCHEDULE_TRIGGER_SUPPORTED,
  },
  {
    concern: 'trigger',
    declares: 'date-reached',
    mechanism: `the kernel clock, by record (\`<eventPrefix ?? collection>.${DATE_REACHED_ACTION}\`): once per record and per `
      + 'date value, at `at` in the office time zone, the record as the payload — a changed date fires again',
    declaredAs: `workflows: [{ eventName: '<collection>.${DATE_REACHED_ACTION}', dateReached: { field, offset, at }, condition, steps }]`,
    stepIds: [],
    supported: true,
  },
  {
    concern: 'guard',
    declares: 'guard.expression',
    mechanism: 'the condition node, or the workflow-level condition evaluated BEFORE any step',
    declaredAs:
      "a step { type: 'Condition', condition, branches: { whenTrue, whenFalse } }, or the definition's "
      + "own `condition` when the whole flow depends on it. NEVER a 'script' step: a script is code to "
      + 'review, and a condition is a declaration to read',
    stepIds: [CONTROL_STEP_TYPES[0]],
    supported: true,
  },
  {
    concern: 'effect',
    declares: 'set-field / create-record / update-record',
    mechanism: 'the data step that writes a record',
    declaredAs: "a step { stepDefinitionId: 'upsert' } with an UpsertStepConfig",
    stepIds: ['upsert'],
    supported: true,
  },
  {
    concern: 'effect',
    declares: 'delete-record',
    mechanism: 'the data step that removes a record',
    declaredAs: "a step { stepDefinitionId: 'remove' } with a RemoveStepConfig",
    stepIds: ['remove'],
    supported: true,
  },
  {
    concern: 'effect',
    declares: 'total',
    mechanism: 'NO STEP. The field declares the aggregate and the kernel recomputes it on every child write',
    declaredAs:
      "field { aggregation: { from, via, op, field } } on the parent — never logic.compute, which sees no "
      + 'child at all and returns zero forever',
    stepIds: [],
    supported: true,
  },
  {
    concern: 'effect',
    declares: 'notify',
    mechanism: 'the notification step',
    declaredAs: "a step { stepDefinitionId: 'notify' }",
    stepIds: ['notify'],
    supported: true,
  },
  {
    concern: 'effect',
    declares: 'call-automation',
    mechanism: 'the step that calls another workflow',
    declaredAs: "a step { stepDefinitionId: 'call-workflow', configuration: { targetWorkflowId } }",
    stepIds: ['call-workflow'],
    supported: true,
  },
  {
    concern: 'effect',
    declares: 'wait',
    mechanism: 'the wait step: the run pauses there and continues later, in the same run, with the effects after it. '
      + 'Only on a save or a date trigger — a button cannot wait, and a schedule runs its effects inside a loop. The '
      + 'effects after it see the record as it was at the passage: the wait does not re-check the state',
    declaredAs: "a top-level step { stepDefinitionId: 'delay', configuration: { duration } }, in the position of the "
      + 'effect; a guard moves into the workflow condition so the wait stays at the top level',
    stepIds: ['delay'],
    supported: true,
  },
  {
    concern: 'invariant',
    declares: "scope 'field'",
    mechanism: "the field's own rule — evaluated as the person types AND on the write path, which throws",
    declaredAs: "field { rules: { validate: { expression, message } } }. This is the only invariant the platform "
      + 'enforces before the document exists, and it is why a blocking rule is written as a field rule',
    stepIds: [],
    supported: true,
  },
  {
    concern: 'invariant',
    declares: "scope 'record'",
    mechanism: 'the step that validates a whole object against the entity schema — INSIDE a flow, so after the write '
      + 'that started it',
    declaredAs: "a step { stepDefinitionId: 'validate-object' } with a ValidateStepConfig, plus an 'exit' on the branch "
      + 'that refuses. It reports the record that is already wrong; it does not undo the write. The write path itself '
      + 'carries FIELD rules only',
    stepIds: ['validate-object', 'exit'],
    supported: true,
  },
  {
    concern: 'invariant',
    declares: "scope 'transition', enforcement 'blocks'",
    mechanism: "the write path: the field's own rule, and the record action that refuses the gesture",
    declaredAs: "field { rules: { validate: { expression, message } } } — which the repository THROWS on, before the "
      + "document is written — plus, on a user-action transition, the action's disabledWhen / hiddenWhen over "
      + "`record.<field>` and the flow's own condition, which is evaluated before the flow's upsert",
    stepIds: [],
    supported: true,
  },
  {
    concern: 'invariant',
    declares: "scope 'transition', enforcement 'reacts'",
    mechanism: 'the workflow condition plus the step that stops the flow. The record is ALREADY written',
    declaredAs: "the definition's `condition`, plus a step { stepDefinitionId: 'exit' } on the branch that refuses. On "
      + '`<collection>.saved` the document was committed before the event existed — the publisher is an '
      + 'onDocumentWritten trigger — and nothing rolls it back: what this stops is the rest of the flow',
    stepIds: ['exit'],
    supported: true,
  },
  {
    concern: 'invariant',
    declares: "scope 'collection'",
    mechanism: 'a declared KEY on the entity. The value is reserved in a document whose id derives from the value '
      + 'itself, written in the same batch as the record — and creating that document is the lock, so two writes at '
      + 'the same instant do not both pass',
    declaredAs: "screen { keys: [{ name, kind: 'unique' | 'primary', fields, scope, normalize, sparse }] }, or "
      + '`unique: true` on the field when one field is the whole key. NEVER an expression: a validate sees ONE record '
      + 'and cannot query the others, and a workflow on `<collection>.saved` finds the duplicate after it exists',
    stepIds: [],
    supported: true,
  },
  {
    concern: 'permission',
    declares: 'transition.permission',
    mechanism: 'a declared capability, asked inside the declaration itself',
    declaredAs:
      "contributes: [accessPermissionContribution({ id: 'resource.action', name })], asked with "
      + 'hasPermission("resource.action") in the action\'s hiddenWhen / disabledWhen and in the step condition. '
      + 'Every collection already yields <collection>.read|create|update|delete for free',
    stepIds: [],
    supported: true,
  },
];

export const mechanismsFor = (concern: BehaviorConcern): BehaviorMechanism[] =>
  BEHAVIOR_MECHANISMS.filter((one) => one.concern === concern);

/** O passo de cada tipo de efeito, na mesma tabela que a documentação lê. */
const EFFECT_STEPS: Record<EffectKind, string[]> = {
  'set-field': ['upsert'],
  'create-record': ['upsert'],
  'update-record': ['upsert'],
  'delete-record': ['remove'],
  total: [],
  notify: ['notify'],
  'call-automation': ['call-workflow'],
  wait: ['delay'],
};

export const stepsOfEffect = (effect: BehaviorEffect): string[] => EFFECT_STEPS[effect.kind];

/**
 * Onde o `from` é comparado DE VERDADE, e com que vocabulário.
 *
 * Existe porque a comparação não mora no mesmo lugar nos três gatilhos, e um `from` que não é
 * verificável em runtime é decoração: o plano prometeria "de rascunho para confirmado" e o fluxo
 * rodaria em qualquer estado.
 *
 * No gatilho de gravação os três valores estão no payload, publicados por
 * `publishWorkflowEventOnEntityChange`: o ATUAL na raiz, o ANTERIOR em `old` (ausente na inclusão) e
 * a distinção inclusão/alteração em `changeType`. Em `workflow.called` não há nenhum dos três — o
 * contexto é o dos PARÂMETROS declarados, e a entrada do catálogo tem `fields: []` e `hasOld: false`.
 * O campo do estado só chega ali por um parâmetro de referência, e é o hidratador que o resolve:
 * `buildHydrationPlan` materializa o salto e carrega o campo citado pela condição.
 */
export interface TransitionFromCheck {
  /** Onde mora a comparação que realmente impede a passagem. */
  where: 'workflow-condition' | 'action-visibility' | 'query-filter';
  /** A expressão, no vocabulário do escopo em que ela é avaliada. */
  expression: string;
  /** O parâmetro de referência sem o qual a condição do fluxo não resolve o campo do estado. */
  requiresParameter?: string;
  /** O caminho do valor ANTERIOR do campo — só o gatilho de gravação o traz. */
  previousValue?: string;
  /** A comparação que distingue inclusão de alteração — só o gatilho de gravação a traz. */
  creationTest?: string;
}

export interface MappedTransition {
  transition: BehaviorTransition;
  /** O nome do evento que a dispara. */
  eventName: string;
  /** Quando o relógio a dispara — só no gatilho `schedule`. */
  schedule?: WorkflowSchedule;
  /** Qual data do registro a dispara — só no gatilho `date-reached`. */
  dateReached?: WorkflowDateReached;
  /**
   * O fluxo desta transição é candidato de uma superfície que escolhe sozinha, e portanto a
   * `description` dela não é opcional. Ver `DESCRIPTION_REQUIRED_EVENTS`.
   */
  describable: boolean;
  /** A chave da ação de registro que a invoca, quando o gatilho é de pessoa. */
  actionKey?: string;
  /**
   * O filtro avaliado ANTES de qualquer passo, em uma linha — EXPRESSÃO e nada mais.
   *
   * A nota que explica por que ela converge morava aqui dentro, entre parênteses, em prosa inglesa:
   * `status == "draft" (false after the write, which is what ends the cascade)`. Um campo com nome de
   * condição, emitido para quem escreve o `plugin.ts`, cujo valor não parseia — e o guia pede
   * justamente que o plano seja copiado verbatim. A explicação continua, em `conditionNote`.
   */
  workflowCondition: string;
  /** Por que a condição converge, quando há o que dizer. Prosa: nunca vai para dentro da expressão. */
  conditionNote?: string;
  /** Os passos, na ordem, por `stepDefinitionId` — ou o tipo do nó, quando é controle de fluxo. */
  steps: string[];
  permission?: string;
  /** Como o `from` é conferido em runtime. Ausente quando o gatilho não tem mecanismo nenhum. */
  fromCheck?: TransitionFromCheck;
  /** `false` quando o gatilho não tem mecanismo; a transição não vira automação nenhuma. */
  supported: boolean;
}

/**
 * A chave do parâmetro de referência que a ação preenche — a entidade com a inicial minúscula.
 * Convenção, e declarada aqui uma vez para que o plano e o guia citem a MESMA.
 */
export const referenceParameterKey = (entity: string): string =>
  entity.charAt(0).toLowerCase() + entity.slice(1);

/**
 * A tradução de UMA transição. Definição única — o validador e a resposta da tool leem daqui, para
 * que a checagem não responda sobre um mecanismo diferente do que vai ser escrito.
 *
 * A condição do workflow não é decoração: é ela que faz o ciclo convergir. Uma transição
 * `from -> to` com `from` diferente de `to` para de casar depois da própria gravação, e é por isso
 * que ela pode gravar no registro que a disparou sem laço — o mesmo motivo por que o recompute de
 * agregados é seguro, e por que `publishWorkflowEventOnEntityChange` não publica quando nada mudou.
 */
export const mapTransition = (
  transition: BehaviorTransition,
  stateField: string,
  collection: string,
): MappedTransition => {
  const trigger = transition.trigger;
  // Com espera, a guarda vai para a condição do fluxo: dentro de um nó de Condição a espera ficaria num
  // ramo, e só o nível principal pausa. É equivalente, porque a guarda só lê o registro em mãos.
  const waits = transition.effects.some((effect) => effect.kind === 'wait');
  const guardSteps = transition.guard && !waits ? [CONTROL_STEP_TYPES[0]] : [];
  const guardClause = waits && transition.guard ? ` and (${transition.guard.expression})` : '';
  const effectSteps = transition.effects.flatMap(stepsOfEffect);
  const deletes = trigger.kind === 'entity-event' && trigger.event === 'deleted';
  // Numa exclusão não há documento em que gravar o estado novo: o `upsert` que estava aqui
  // ressuscitaria o registro que a pessoa acabou de apagar, com um campo só.
  const stateSteps = isSelfLoop(transition) || deletes ? [] : ['upsert'];
  const permission = transition.permission === undefined ? {} : { permission: transition.permission };
  const steps = [...guardSteps, ...stateSteps, ...effectSteps];

  if (trigger.kind === 'user-action') {
    // `workflow.called` não carrega o registro: o `from` que PARA a passagem é o da ação, e o do
    // fluxo só resolve através de um parâmetro de referência.
    const parameter = referenceParameterKey(transition.entity);
    return {
      transition,
      ...permission,
      eventName: WORKFLOW_CALLED_EVENT,
      describable: DESCRIPTION_REQUIRED_EVENTS.includes(WORKFLOW_CALLED_EVENT),
      actionKey: trigger.action,
      workflowCondition: `${parameter}.${stateField} == "${transition.from}"`,
      steps,
      fromCheck: {
        where: 'action-visibility',
        expression: `record.${stateField} == "${transition.from}"`,
        requiresParameter: parameter,
      },
      supported: true,
    };
  }

  if (trigger.kind === 'entity-event') {
    // Numa exclusão o payload é a imagem ANTERIOR do documento, então o campo lido é o estado em que
    // ele estava; não há `old` nem `changeType` (o publicador só os põe em `.saved`).
    const note = deletes
      ? 'The payload of a delete is the before-image, so this reads the state it was in.'
      : isSelfLoop(transition)
        ? undefined
        : 'False after the write, which is what ends the cascade.';
    return {
      transition,
      ...permission,
      eventName: `${collection}.${trigger.event}`,
      describable: DESCRIPTION_REQUIRED_EVENTS.includes(`${collection}.${trigger.event}`),
      workflowCondition: `${stateField} == "${transition.from}"${guardClause}`,
      ...(note === undefined ? {} : { conditionNote: note }),
      steps,
      fromCheck: {
        where: 'workflow-condition',
        expression: `${stateField} == "${transition.from}"`,
        ...(deletes ? {} : {
          previousValue: `old.${stateField}`,
          creationTest: 'changeType == "created"',
        }),
      },
      supported: true,
    };
  }

  if (trigger.kind === 'date-reached') {
    // O evento É o registro, como numa gravação — sem `old` nem `changeType`. O `from` é conferido na
    // condição do fluxo, e gravar o `to` não volta a disparar: a gravação emite `.saved`, não a data.
    return {
      transition,
      ...permission,
      eventName: `${collection}.${DATE_REACHED_ACTION}`,
      dateReached: { field: trigger.field, offset: trigger.offset, ...(trigger.at === undefined ? {} : { at: trigger.at }) },
      describable: false,
      workflowCondition: `${stateField} == "${transition.from}"${guardClause}`,
      steps,
      fromCheck: { where: 'workflow-condition', expression: `${stateField} == "${transition.from}"` },
      supported: true,
    };
  }

  // O relógio não traz registro nenhum: o `from` vira o filtro da consulta, e a passagem roda por
  // registro, dentro do laço. Gravar o `to` tira o registro do filtro — é o que impede a volta seguinte
  // de passá-lo de novo.
  return {
    transition,
    ...permission,
    eventName: WORKFLOW_SCHEDULE_EVENT,
    schedule: { cron: trigger.when },
    describable: false,
    workflowCondition: '',
    conditionNote: 'A schedule carries no record: the `from` filters the query, and the loop runs the passage per record.',
    steps: ['query', CONTROL_STEP_TYPES[1], ...steps],
    fromCheck: { where: 'query-filter', expression: `${stateField} == "${transition.from}"` },
    supported: SCHEDULE_TRIGGER_SUPPORTED,
  };
};

/** Uma linha por transição, para quem lê o plano ou a resposta da tool. */
export const transitionSummary = (mapped: MappedTransition): string =>
  `${mapped.transition.entity}: ${mapped.transition.from} -> ${mapped.transition.to}`
  + ` on ${mapped.eventName || 'nothing'}`
  + (mapped.actionKey === undefined ? '' : ` (action "${mapped.actionKey}")`)
  + (mapped.permission === undefined ? '' : ` requiring ${mapped.permission}`);

/** A entidade que cada efeito da transição toca, sem repetição. */
export const effectTargets = (transition: BehaviorTransition): string[] =>
  [...new Set(transition.effects.map((effect) => effectEntity(effect, transition)))];
