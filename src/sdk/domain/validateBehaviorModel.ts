import { FIELD_EXPRESSION_FUNCTION_NAMES } from '../../domain/schema/fieldExpression';
import { KERNEL_PERMISSIONS } from '../../domain/schema/access/kernelPermissions';
import { CRUD_ACTIONS, isValidAccessPermissionId } from '../../domain/schema/access/permission';
import type {
  BehaviorEffect,
  BehaviorInvariant,
  BehaviorModel,
  BehaviorState,
  BehaviorTransition,
} from './behaviorModel';
import { A_STATE_IS_A_KEY, effectEntity, enforcementOfScope, isSelfLoop } from './behaviorModel';
import type { MappedTransition } from './behaviorMapping';
import { DESCRIPTION_REQUIRED_BECAUSE, DOCUMENT_EFFECT_OUTPUTS, mapTransition } from './behaviorMapping';
import {
  MAX_DELAY_DAYS,
  MIN_SCHEDULE_INTERVAL_MINUTES,
  dateReachedIssues,
  parseDelayDuration,
  scheduleIssues,
} from '../../domain/schema/workflowClock';
import type { DomainCatalog } from './catalog';
import type { DomainEntity, DomainIssue, DomainModel } from './domainModel';
import type { DomainIssueCode } from './detectors';
import { collectionOfEntity } from './toPlatform';

/**
 * O MOTOR DETERMINÍSTICO DO COMPORTAMENTO. Nada aqui pergunta a um modelo de linguagem se uma
 * transição "parece" faltar permissão: cada detector é uma comparação sobre o modelo, sobre o
 * catálogo real e sobre a tabela de mecanismos.
 *
 * As três decisões do irmão valem inteiras, e uma quarta é própria daqui:
 *
 * - **A identidade do estado é a CHAVE.** Comparar rótulo é o defeito mais barato de escrever e o
 *   mais caro de achar: funciona no dia em que foi escrito e para na primeira tradução, sem sintoma.
 * - **O que faz o ciclo convergir é a condição, não a boa intenção.** Um efeito que grava no campo
 *   que dispara o próprio gatilho é seguro exatamente quando a condição para de casar depois da
 *   gravação — que é o motivo por que o recompute de agregados é seguro, e por que
 *   `publishWorkflowEventOnEntityChange` não publica quando nada mudou.
 * - **Sem ator, `hasPermission` responde NÃO.** Está escrito em `accessFns.ts`, e é decisivo: uma
 *   permissão numa transição de gatilho de evento não é configuração frouxa, é fluxo que nunca roda.
 * - **Onde não há mecanismo, a resposta é a recusa com o caminho ao lado.** Relógio e unicidade não
 *   existem nesta plataforma, e simulá-los custaria mais que a ausência deles.
 */

export interface BehaviorValidation {
  issues: DomainIssue[];
  /** As transições traduzidas. Definição ÚNICA: nada as reinterpreta depois. */
  transitions: MappedTransition[];
}

const make = (
  code: DomainIssueCode,
  severity: DomainIssue['severity'],
  draft: Omit<DomainIssue, 'code' | 'severity'>,
): DomainIssue => ({ code, severity, ...draft });

// ─── O vocabulário que uma expressão pode citar ───────────────────────────────

/**
 * O que uma expressão vê, e que portanto não é referência a outro registro. `record`, `isNew`,
 * `role` e `surface` são o escopo da declaração de uma ação; `event` e `old` são o do passo.
 */
const SCOPE_TOKENS = new Set([
  'true', 'false', 'null', 'value', 'self', 'old', 'event', 'record', 'isNew', 'role', 'surface',
  'id', 'changeType', 'now', 'today', 'user',
]);

/**
 * Os identificadores de RAIZ de uma expressão. Literais de texto saem primeiro (um nome de coleção
 * dentro de uma string não é uma leitura), depois os segmentos de acesso a membro — em `sale.status`
 * o que interessa é `sale` — e por fim as chamadas de função, que nunca são referência a registro.
 */
const rootTokens = (expression: string): string[] => {
  const withoutText = expression.replace(/"[^"]*"|'[^']*'/g, ' ');
  const withoutMembers = withoutText.replace(/\.\s*[A-Za-z_][A-Za-z0-9_]*/g, ' ');
  const tokens: string[] = [];
  const pattern = /[A-Za-z_][A-Za-z0-9_]*/g;
  let match = pattern.exec(withoutMembers);
  while (match !== null) {
    const after = withoutMembers.slice(match.index + match[0].length).trimStart();
    if (!after.startsWith('(')) tokens.push(match[0]);
    match = pattern.exec(withoutMembers);
  }
  return tokens;
};

const FUNCTION_NAMES = new Set(FIELD_EXPRESSION_FUNCTION_NAMES);

// ─── As entidades, do modelo e do que já existe ───────────────────────────────

interface BehaviorEntityHandle {
  name: string;
  collection: string;
  fields: Map<string, { type?: string; lookup?: string; isAggregate: boolean; isDerived: boolean }>;
  denormKeys: Set<string>;
  /** Os nomes das chaves declaradas — é a elas que uma invariante de coleção aponta. */
  keyNames: Set<string>;
}

const handleOfModelEntity = (entity: DomainEntity, model: DomainModel): BehaviorEntityHandle => ({
  name: entity.name,
  collection: collectionOfEntity(entity),
  keyNames: new Set([
    ...(entity.keys ?? []).map((key) => key.name),
    ...entity.fields.filter((field) => field.unique === true).map((field) => `field:${field.key}`),
  ]),
  fields: new Map(entity.fields.map((field) => [field.key, {
    ...(field.type === undefined ? {} : { type: field.type }),
    ...(field.lookup === undefined ? {} : { lookup: field.lookup }),
    isAggregate: field.aggregation !== undefined,
    isDerived: field.semanticType === 'derived',
  }])),
  denormKeys: new Set(
    model.relationships
      .filter((one) => one.sourceEntity === entity.name && one.denormalize !== undefined)
      .map((one) => one.denormalize?.denormKey as string),
  ),
});

const buildHandles = (model: DomainModel, catalog: DomainCatalog): Map<string, BehaviorEntityHandle> => {
  const handles = new Map<string, BehaviorEntityHandle>();
  for (const entity of model.entities) {
    const handle = handleOfModelEntity(entity, model);
    handles.set(entity.name, handle);
    handles.set(handle.collection, handle);
  }
  for (const entity of catalog.entities) {
    if (handles.has(entity.collection)) continue;
    handles.set(entity.collection, {
      name: entity.collection,
      collection: entity.collection,
      fields: new Map(entity.fields.map((field) => [field.key, {
        type: field.type,
        ...(field.lookupCollection === undefined ? {} : { lookup: field.lookupCollection }),
        isAggregate: field.aggregation !== undefined,
        isDerived: field.aggregation !== undefined || field.computeExpression !== undefined,
      }])),
      denormKeys: new Set(),
      keyNames: new Set((entity.keys ?? []).map((key) => key.name)),
    });
  }
  return handles;
};

/** Todo nome pelo qual um CONJUNTO de registros pode ser citado — o que uma condição não enxerga. */
const recordVocabulary = (model: DomainModel, catalog: DomainCatalog): Set<string> => {
  const names = new Set<string>();
  for (const entity of model.entities) {
    names.add(entity.name);
    names.add(collectionOfEntity(entity));
  }
  for (const entity of catalog.entities) names.add(entity.collection);
  for (const list of [...catalog.lookups, ...catalog.tagLists]) names.add(list.collection);
  return names;
};

// ─── Estados ──────────────────────────────────────────────────────────────────

const STATE_FIELD_TYPE = 'select';

const stateIssues = (
  behavior: BehaviorModel,
  handles: ReadonlyMap<string, BehaviorEntityHandle>,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const seen = new Set<string>();

  for (const state of behavior.states) {
    if (seen.has(state.entity)) {
      issues.push(make('behavior.state.duplicate', 'error', {
        entity: state.entity,
        field: state.field,
        message: `"${state.entity}" declares more than one state machine.`,
        suggestion: 'One entity, one state field. A second axis that really varies on its own is a second field, '
          + 'and then it is a second machine over a different entity or a plain scalar.',
        howToDeclareException: 'None.',
      }));
      continue;
    }
    seen.add(state.entity);

    const keys = new Set<string>();
    for (const option of state.options) {
      if (keys.has(option.key)) {
        issues.push(make('behavior.state.duplicate', 'error', {
          entity: state.entity,
          field: state.field,
          message: `Two options of "${state.field}" share the key "${option.key}".`,
          suggestion: `${A_STATE_IS_A_KEY} Two options with one key are one option with two labels.`,
          howToDeclareException: 'None.',
        }));
      }
      keys.add(option.key);
    }

    const handle = handles.get(state.entity);
    if (handle === undefined) continue;

    const field = handle.fields.get(state.field);
    if (field === undefined) {
      issues.push(make('behavior.state.field-not-declared', 'error', {
        entity: state.entity,
        field: state.field,
        message: `"${state.entity}" has no field "${state.field}", so there is nowhere for the state to be stored.`,
        suggestion: `Declare it in the domain model: { key: "${state.field}", semanticType: "scalar", `
          + `type: "${STATE_FIELD_TYPE}", lookup: "<the list of options>" }.`,
        howToDeclareException: 'None. A state machine over a field that does not exist is a diagram, not a declaration.',
      }));
      continue;
    }

    if (field.type !== STATE_FIELD_TYPE || field.lookup === undefined) {
      issues.push(make('behavior.state.field-not-a-list', 'error', {
        entity: state.entity,
        field: state.field,
        message: `"${state.entity}.${state.field}" is ${field.type === undefined ? 'untyped' : `a "${field.type}"`}`
          + `${field.lookup === undefined ? ' with no list behind it' : ''}, so the ${state.options.length} option keys `
          + 'declared here have nowhere to be written.',
        suggestion: `Make it { type: "${STATE_FIELD_TYPE}", lookup: "<collection>" }. The list travels in the package as `
          + 'a declaration and the options are SEEDED once, on install; from then on they are the office\'s data, '
          + 'which is why renaming a label never breaks a transition and why the key is the identity.',
        howToDeclareException: 'None.',
      }));
      continue;
    }

    if (state.lookup !== undefined && state.lookup !== field.lookup) {
      issues.push(make('behavior.state.field-not-a-list', 'error', {
        entity: state.entity,
        field: state.field,
        message: `The state says its options live in "${state.lookup}" and the field reads them from "${field.lookup}".`,
        suggestion: 'Two lists for one field means the office can pick an option no transition knows. Point both at the same one.',
        howToDeclareException: 'None.',
      }));
    }
  }

  return issues;
};

// ─── Alcance ──────────────────────────────────────────────────────────────────

/**
 * O que ENTRA num estado sem ser uma transição dele: o efeito de um fluxo de OUTRA entidade que
 * grava o campo do estado.
 *
 * O detector só olhava `behavior.transitions` da própria entidade, e por isso acusava de
 * inalcançável o estado mais comum de todos — o que o vizinho atinge ("ao faturar a venda, o item
 * vira 'fechado'"). Isso é um mecanismo real, não uma brecha: `set-field`, `update-record` e
 * `create-record` viram um passo `upsert`, que escreve o campo como qualquer outro.
 *
 * Quando o valor gravado é uma EXPRESSÃO, não se sabe qual chave sai dela, e a resposta é a mais
 * frouxa das duas: todas contam como atingidas. Um `unreachable` errado ensina a ignorar o relatório,
 * e a partir daí ele não protege mais nada.
 */
interface EffectWrites {
  /** As chaves que um efeito de fora comprovadamente grava. */
  written: Set<string>;
  /**
   * Os efeitos que gravam o campo do estado com uma EXPRESSÃO, e por isso calaram a verificação para
   * esta entidade inteira. Cada um é `"<transição>" via <kind>`.
   */
  byExpression: string[];
}

const keysWrittenByEffects = (behavior: BehaviorModel, state: BehaviorState): EffectWrites => {
  const keys = new Set(state.options.map((one) => one.key));
  const written = new Set<string>();
  const byExpression: string[] = [];

  for (const transition of behavior.transitions) {
    for (const effect of transition.effects) {
      if (effect.kind !== 'set-field' && effect.kind !== 'update-record' && effect.kind !== 'create-record') continue;
      if (effectEntity(effect, transition) !== state.entity) continue;
      if (effect.field !== state.field) continue;
      const value = effect.value;
      if (value === undefined) continue;
      const literal = /^(["'])(.*)\1$/.exec(value)?.[2] ?? value;
      if (keys.has(literal)) {
        written.add(literal);
        continue;
      }
      byExpression.push(`"${transition.name}" via ${effect.kind}`);
      for (const key of keys) written.add(key);
    }
  }
  return { written, byExpression };
};

/**
 * Um estado sem entrada é inalcançável; um sem saída é o fim, e a diferença entre "é o fim" e
 * "esqueci a saída" não se lê no modelo — por isso o fim é DECLARADO. Laço declarado (`from` igual a
 * `to`) não conta como entrada nem como saída: ele não leva a lugar nenhum, é o que ele significa.
 */
const reachabilityIssues = (behavior: BehaviorModel): DomainIssue[] => {
  const issues: DomainIssue[] = [];

  for (const state of behavior.states) {
    const keys = state.options.map((one) => one.key);
    const moving = behavior.transitions.filter((one) => one.entity === state.entity && !isSelfLoop(one));
    const { written: byEffect, byExpression } = keysWrittenByEffects(behavior, state);
    const inbound = new Set([...moving.map((one) => one.to), ...byEffect]);
    // Uma gravação de fora tira o registro de onde ele estava: ela é saída de todo estado, menos do
    // único que ela mesma escreve — desse ela não sai, escreve o valor que já estava lá.
    const leftByEffect = keys.filter((key) => [...byEffect].some((written) => written !== key));

    // O CUSTO DO AFROUXAMENTO, dito em vez de suposto. Efeito com valor literal conta como entrada
    // daquela chave; efeito com EXPRESSÃO conta como entrada de TODAS, porque não se sabe qual chave
    // sai dela — e a partir daí nenhum estado desta entidade pode ser acusado de inalcançável nem de
    // sem-saída. É a direção segura, e é silenciosa: quem lê o relatório limpo leria "está tudo
    // verificado", quando o certo é "não há como verificar aqui".
    if (byExpression.length > 0) {
      issues.push(make('behavior.state.reachability-not-verifiable', 'info', {
        entity: state.entity,
        field: state.field,
        message: `Reachability is not verifiable for "${state.entity}": ${byExpression.join(', ')} writes `
          + `"${state.field}" with a computed value, so every one of the ${keys.length} option keys counts as both `
          + 'reachable and escapable and neither check can fire on this entity.',
        suggestion: 'If the expression really resolves to one of a few keys, write one effect per key with the literal '
          + 'value and let the guard choose between the transitions — then the check works again. If it genuinely '
          + 'computes the key, nothing here is wrong, and this is the note saying the two checks are off for this '
          + 'entity rather than passing it.',
        howToDeclareException: 'None needed — this is information. The alternative was accusing a state that a '
          + 'computed write does reach, and one wrong accusation is how a report stops being read.',
      }));
    }
    const outbound = new Set([...moving.map((one) => one.from), ...leftByEffect]);
    const terminal = new Set(state.terminal ?? []);

    for (const key of keys) {
      if (!inbound.has(key) && key !== state.initial) {
        issues.push(make('behavior.state.unreachable', 'error', {
          entity: state.entity,
          field: state.field,
          message: `No transition ever puts "${state.entity}.${state.field}" into "${key}", and it is not the initial state.`,
          suggestion: state.initial === undefined
            ? `Declare initial: "${key}" if that is where a record is born, or write the transition that reaches it.`
            : `Write the transition that reaches "${key}", or drop the option — an option nothing selects is a promise `
              + 'the office will read on the screen and never see happen.',
          howToDeclareException: `Declare it as the initial state, or as one the office sets by hand — and then it is a `
            + 'plain select, not a state machine.',
        }));
      }
      if (!outbound.has(key) && !terminal.has(key)) {
        issues.push(make('behavior.state.dead-end', 'error', {
          entity: state.entity,
          field: state.field,
          message: `Nothing leaves "${key}", and it is not declared terminal.`,
          suggestion: `If it is the end, say so: terminal: ["${key}"]. If it is not, the transition out of it is missing.`,
          howToDeclareException: `terminal: ["${key}"] is the declaration. There is no third reading.`,
        }));
      }
    }
  }

  return issues;
};

// ─── Transições ───────────────────────────────────────────────────────────────

const permissionIssues = (
  transition: BehaviorTransition,
  knownPermissions: ReadonlySet<string>,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const { permission, actor, trigger } = transition;

  if (actor !== undefined && permission === undefined) {
    issues.push(make('behavior.transition.actor-without-permission', 'error', {
      entity: transition.entity,
      field: transition.name,
      message: `The rule behind "${transition.name}" names an actor ("${actor}") and the transition asks nothing of them, `
        + 'so everyone who can open the record can make it happen.',
      suggestion: 'Give it permission: "<resource>.<action>". There are no roles per office in this platform — the office '
        + 'builds its own profiles and every check asks for a PERMISSION, so "only the manager" is only ever expressible '
        + 'as one.',
      howToDeclareException: 'If the actor is prose and not a restriction ("the seller confirms" meaning whoever is '
        + 'looking at it), drop the actor. Leaving both is what nobody can tell apart later.',
    }));
  }

  if (permission === undefined) return issues;

  if (!isValidAccessPermissionId(permission)) {
    issues.push(make('behavior.transition.permission-invalid', 'error', {
      entity: transition.entity,
      field: transition.name,
      message: `"${permission}" is not a permission identifier.`,
      suggestion: 'It is exactly "resource.action" — lower-case action. A role name ("manager", "admin") is not a '
        + 'permission: the office invents its own profiles and groups permissions into them.',
      howToDeclareException: 'None.',
    }));
    return issues;
  }

  if (trigger.kind !== 'user-action') {
    issues.push(make('behavior.transition.permission-on-event-trigger', 'error', {
      entity: transition.entity,
      field: transition.name,
      message: `"${transition.name}" is triggered by ${trigger.kind === 'entity-event' ? 'a save' : 'a clock'} and requires `
        + `"${permission}". Nobody called it, so there is no actor, and hasPermission answers false — always. The flow `
        + 'either never runs or the permission is decoration; both are silent.',
      suggestion: 'A permission is only answerable when a person acts: make the trigger { kind: "user-action", action } '
        + 'and the check lives in the action (hiddenWhen / disabledWhen) and in the step condition. If the passage really '
        + 'must follow a save, then it is not restricted — restrict the GESTURE that causes the save instead.',
      howToDeclareException: 'None. Granting on absence of a person would turn "nobody triggered this" into "can do '
        + 'anything", which is why the engine answers false.',
    }));
  }

  if (!knownPermissions.has(permission)) {
    issues.push(make('behavior.transition.permission-undeclared', 'info', {
      entity: transition.entity,
      field: transition.name,
      message: `"${permission}" is neither derived from a collection nor one the kernel declares, so nothing offers it `
        + 'to the office when it builds a profile.',
      suggestion: 'Declare it in the package: contributes: [accessPermissionContribution({ id, name, description })]. '
        + 'It is metadata with no code to review, so any package may declare one.',
      howToDeclareException: 'Nothing to declare — this is information. It is a defect only if the package ships '
        + 'without it.',
    }));
  }

  return issues;
};

const guardIssues = (
  transition: BehaviorTransition,
  handles: ReadonlyMap<string, BehaviorEntityHandle>,
  vocabulary: ReadonlySet<string>,
): DomainIssue[] => {
  const guard = transition.guard;
  if (guard === undefined) return [];
  const handle = handles.get(transition.entity);
  const foreign = rootTokens(guard.expression).filter((token) =>
    !SCOPE_TOKENS.has(token)
    && !FUNCTION_NAMES.has(token)
    && !(handle?.fields.has(token) ?? false)
    && !(handle?.denormKeys.has(token) ?? false)
    && vocabulary.has(token));

  if (foreign.length === 0) return [];

  return [make('behavior.guard.needs-other-records', 'error', {
    entity: transition.entity,
    field: transition.name,
    message: `The guard of "${transition.name}" reads ${foreign.map((one) => `"${one}"`).join(', ')}, which is a set of `
      + 'records. A condition is evaluated over the ONE record in hand and never queries: the reference resolves to '
      + 'nothing and the guard quietly answers false.',
    suggestion: 'Query first, then decide: a step { stepDefinitionId: "query" } publishes count, results and first, and '
      + 'the condition node after it compares THOSE outputs. That is the shape, and it costs one more step.',
    howToDeclareException: 'If the value is read often and belongs to the record anyway, denormalize it on the '
      + 'relationship (denormalize: { denormKey, fields, reason }) and the guard reads it as `<denormKey>.<field>` — the '
      + 'current value of the target, with nothing copied.',
  })];
};

const stateKeyIssues = (
  transition: BehaviorTransition,
  state: BehaviorState | undefined,
): DomainIssue[] => {
  if (state === undefined) {
    return [make('behavior.transition.unknown-state', 'error', {
      entity: transition.entity,
      field: transition.name,
      message: `"${transition.name}" moves "${transition.entity}" from "${transition.from}" to "${transition.to}", and no `
        + 'state machine is declared for that entity.',
      suggestion: 'Declare it in behavior.states: { entity, field, options } — the field that holds the state and the '
        + 'options it admits, by key.',
      howToDeclareException: 'None.',
    })];
  }

  const issues: DomainIssue[] = [];
  const keys = new Set(state.options.map((one) => one.key));
  const byLabel = new Map(state.options.map((one) => [one.label.toLowerCase(), one.key]));

  for (const [side, value] of [['from', transition.from], ['to', transition.to]] as const) {
    if (keys.has(value)) continue;
    const asLabel = byLabel.get(value.toLowerCase());
    if (asLabel !== undefined) {
      issues.push(make('behavior.transition.compares-label', 'error', {
        entity: transition.entity,
        field: transition.name,
        message: `"${transition.name}" names the ${side} state "${value}", which is the LABEL of the option whose key is `
          + `"${asLabel}".`,
        suggestion: `Use the key: ${side}: "${asLabel}". ${A_STATE_IS_A_KEY} The label is what the office renames and what `
          + 'the translation package replaces; the comparison would work the day it was written and stop with no symptom.',
        howToDeclareException: 'None.',
      }));
      continue;
    }
    issues.push(make('behavior.transition.unknown-state', 'error', {
      entity: transition.entity,
      field: transition.name,
      message: `"${transition.name}" names the ${side} state "${value}", which is not an option of `
        + `"${state.entity}.${state.field}" (${[...keys].join(', ')}).`,
      suggestion: `Add the option to the state, or point ${side} at one that exists. Nothing refuses a value outside the `
        + 'list at write time either — the record would simply hold a state no transition can leave.',
      howToDeclareException: 'None.',
    }));
  }

  return issues;
};

/**
 * O laço. Um efeito que grava na entidade que disparou o gatilho reescreve o documento, e a escrita
 * republica o evento — a não ser que a condição do fluxo tenha deixado de casar. Com `from`
 * diferente de `to`, ela deixou: a gravação move o estado e a comparação com `from` fica falsa. Com
 * `from` igual a `to`, não há nada para pará-la, e o único freio possível é uma condição que fale do
 * campo gravado.
 */
const loopIssues = (transition: BehaviorTransition): DomainIssue[] => {
  if (transition.trigger.kind !== 'entity-event' || !isSelfLoop(transition)) return [];

  const written = transition.effects
    .filter((effect) => effectEntity(effect, transition) === transition.entity && effect.field !== undefined
      && effect.kind !== 'total')
    .map((effect) => effect.field as string);
  if (written.length === 0) return [];

  const guarded = new Set(transition.guard === undefined ? [] : rootTokens(transition.guard.expression));
  const unguarded = written.filter((field) => !guarded.has(field));
  if (unguarded.length === 0) return [];

  return [make('behavior.effect.self-trigger-loop', 'error', {
    entity: transition.entity,
    field: transition.name,
    message: `"${transition.name}" fires on every save of "${transition.entity}" and writes `
      + `${unguarded.map((one) => `"${one}"`).join(', ')} back into it, leaving the state where it was. The write `
      + 'republishes the event, the condition still matches, and it runs again — for as long as the value keeps changing.',
    suggestion: 'Two ways out, and both are declarations. Either the transition MOVES the state (from different from to), '
      + 'so the condition stops matching after the write; or the guard names the field being written, so the second pass '
      + 'writes the same value and the platform stops publishing — it does not publish when the document did not change. '
      + 'That is exactly why recomputing an aggregate is safe: it is idempotent and writes nothing when nothing moved.',
    howToDeclareException: 'None that is declarable. "It converges in practice" is not a property the platform can check, '
      + 'and a runaway cascade shows up as cost, not as an error.',
  })];
};

const totalIssues = (
  transition: BehaviorTransition,
  effect: BehaviorEffect,
  handles: ReadonlyMap<string, BehaviorEntityHandle>,
): DomainIssue[] => {
  if (effect.kind !== 'total') return [];
  const target = effectEntity(effect, transition);
  const field = effect.field;
  const declared = field === undefined ? undefined : handles.get(target)?.fields.get(field);

  const wrong = effect.value !== undefined
    || effect.aggregation === undefined
    || (declared !== undefined && !declared.isAggregate);
  if (!wrong) return [];

  return [make('behavior.effect.total-not-an-aggregation', 'error', {
    entity: target,
    field: field ?? transition.name,
    message: effect.value !== undefined
      ? `"${transition.name}" totals ${field === undefined ? 'a field' : `"${field}"`} with an expression. An expression `
        + 'sees only the record it is on — no child at all — so it returns zero, once, and never moves again.'
      : `"${transition.name}" totals ${field === undefined ? 'a field' : `"${field}"`} as an effect of the transition, and `
        + 'a total is not something a passage does.',
    suggestion: 'Declare the field as derived from children with the aggregate — { semanticType: "derived", '
      + 'derivedFrom: "children", aggregation: { from, via, op, field } } — and the kernel recomputes it on every write '
      + 'to a child, whoever caused it. No step, no transition, and it stays right when a child is edited outside this flow.',
    howToDeclareException: 'None. This is the same limit the domain model already refuses: compute and aggregation are '
      + 'two mechanisms and neither substitutes the other.',
  })];
};

/**
 * A espera só existe onde o motor consegue pausar: numa execução que nasceu do barramento de eventos (uma
 * gravação, uma data) e no nível principal do fluxo. O botão aguarda a resposta; o relógio roda os efeitos
 * dentro do laço sobre os registros.
 */
const waitIssues = (transition: BehaviorTransition): DomainIssue[] => transition.effects
  .filter((effect) => effect.kind === 'wait')
  .flatMap((effect): DomainIssue[] => {
    const at = { entity: transition.entity, field: transition.name };
    if (transition.trigger.kind === 'user-action' || transition.trigger.kind === 'schedule') {
      const person = transition.trigger.kind === 'user-action';
      return [make('behavior.effect.wait-unsupported', 'error', {
        ...at,
        message: `"${transition.name}" waits, and it is triggered by ${person
          ? 'a person: the button waits for the answer, and cannot wait for a pause'
          : 'a clock: its effects run inside the loop over the records, and a wait only pauses at the top level'}.`,
        suggestion: person
          ? 'Split it: the gesture does the passage, and a second transition triggered by the save (entity-event) '
            + 'waits and does the rest. Or, if the later effects depend on a date of the record, a date-reached trigger.'
          : 'If the effect is about a date of each record ("two days after it was invoiced"), use a date-reached '
            + 'trigger with an offset instead of a schedule plus a wait.',
        howToDeclareException: 'None. The engine refuses the pause there, mid-execution.',
      })];
    }
    if (parseDelayDuration(effect.duration) === null) {
      return [make('behavior.effect.wait-invalid', 'error', {
        ...at,
        message: `"${transition.name}" waits "${effect.duration ?? ''}", which is not a duration like 30m, 4h or 2d (at most `
          + `${MAX_DELAY_DAYS} days).`,
        suggestion: '{ kind: "wait", duration: "2d" } — and remember the effects after it see the record as it was at the '
          + 'passage. When they depend on the state NOW ("if it is still open"), the rule is a date-reached trigger.',
        howToDeclareException: 'None.',
      })];
    }
    return [];
  });

/**
 * O documento é gerado sobre o registro DA TRANSIÇÃO: o modelo de documento nomeia a tela, e o passo
 * recusa um registro de outra. Numa exclusão não sobra registro em que anexar.
 */
const documentIssues = (transition: BehaviorTransition): DomainIssue[] => transition.effects
  .filter((effect) => effect.kind === 'generate-document')
  .flatMap((effect): DomainIssue[] => {
    const at = { entity: transition.entity, field: transition.name };
    const deleted = transition.trigger.kind === 'entity-event' && transition.trigger.event === 'deleted';
    if (deleted || (effect.entity !== undefined && effect.entity !== transition.entity)) {
      return [make('behavior.effect.document-unsupported', 'error', {
        ...at,
        message: deleted
          ? `"${transition.name}" generates a document when the record is deleted: there is no record left to attach it to.`
          : `"${transition.name}" generates a document for "${effect.entity}", and the template only fills a record of `
            + `"${transition.entity}" — the model has no way to say WHICH "${effect.entity}".`,
        suggestion: deleted
          ? 'Generate it on the passage before the delete, or on the save that leads to it.'
          : `Declare the effect on a transition of "${effect.entity}" (the one that should carry the file).`,
        howToDeclareException: 'None.',
      })];
    }
    const outputInvalid = effect.output !== undefined && !DOCUMENT_EFFECT_OUTPUTS.includes(effect.output);
    if (effect.template === undefined || effect.template.trim() === '' || outputInvalid) {
      return [make('behavior.effect.document-invalid', 'error', {
        ...at,
        message: outputInvalid
          ? `"${transition.name}" asks for a "${effect.output}" document; the step produces ${DOCUMENT_EFFECT_OUTPUTS.join(' or ')}.`
          : `"${transition.name}" generates a document without saying which template.`,
        suggestion: `{ kind: "generate-document", template: "<template key>", output: "${DOCUMENT_EFFECT_OUTPUTS[0] ?? 'pdf'}" } — `
          + 'the template is declared with documentTemplateContribution on the screen of the entity.',
        howToDeclareException: 'None.',
      })];
    }
    return [];
  });

const transitionIssues = (
  behavior: BehaviorModel,
  handles: ReadonlyMap<string, BehaviorEntityHandle>,
  vocabulary: ReadonlySet<string>,
  knownPermissions: ReadonlySet<string>,
): { issues: DomainIssue[]; transitions: MappedTransition[] } => {
  const issues: DomainIssue[] = [];
  const transitions: MappedTransition[] = [];
  const byEntity = new Map(behavior.states.map((one) => [one.entity, one]));

  for (const transition of behavior.transitions) {
    const handle = handles.get(transition.entity);
    if (handle === undefined) {
      issues.push(make('behavior.transition.unknown-entity', 'error', {
        entity: transition.entity,
        field: transition.name,
        message: `"${transition.name}" happens to "${transition.entity}", and nothing models that entity and no `
          + 'collection carries that name here.',
        suggestion: 'Model the entity first. Behavior is declared over a structure that exists — that is the whole order: '
          + 'intent, entities, relationships, then what happens to them.',
        howToDeclareException: 'None.',
      }));
      continue;
    }

    const state = byEntity.get(transition.entity);
    issues.push(...stateKeyIssues(transition, state));
    issues.push(...permissionIssues(transition, knownPermissions));
    issues.push(...guardIssues(transition, handles, vocabulary));
    issues.push(...loopIssues(transition));
    for (const effect of transition.effects) {
      issues.push(...totalIssues(transition, effect, handles));
      const target = effectEntity(effect, transition);
      if (handles.has(target)) continue;
      issues.push(make('behavior.transition.unknown-entity', 'error', {
        entity: target,
        field: transition.name,
        message: `An effect of "${transition.name}" writes to "${target}", which is neither modelled nor an existing `
          + 'collection.',
        suggestion: 'Model it, or point the effect at the entity that really holds the data.',
        howToDeclareException: 'None.',
      }));
    }

    issues.push(...waitIssues(transition));
    issues.push(...documentIssues(transition));

    if (transition.trigger.kind === 'date-reached') {
      const declared = [...handle.fields.entries()].filter(([, one]) => one.type === 'date').map(([key]) => key);
      const known = handle.fields.size > 0 ? declared : null;
      const [problem] = dateReachedIssues(
        { field: transition.trigger.field, offset: transition.trigger.offset, at: transition.trigger.at },
        known,
      );
      if (problem) {
        issues.push(make('behavior.transition.date-reached-invalid', 'error', {
          entity: transition.entity,
          field: transition.name,
          message: `"${transition.name}" happens when a date of "${transition.entity}" arrives, and the kernel clock cannot `
            + `watch it: ${problem.code === 'field-not-date'
              ? `"${transition.trigger.field}" is not a date field of the entity`
              : problem.code === 'offset-invalid'
                ? `"${transition.trigger.offset}" is not a whole number of days like -3d, 0d or +1d`
                : problem.code === 'at-invalid' ? `"${transition.trigger.at}" is not a time like 08:00` : 'it names no field'}.`,
          suggestion: `{ kind: "date-reached", field: "<a date field>", offset: "-3d", at: "08:00" } — three days before, `
            + `at 08:00 in the office time zone. Declare the field with type "date"${known && known.length > 0
              ? ` (this entity has: ${known.join(', ')})` : ''}.`,
          howToDeclareException: 'None. A date trigger on a field that is not a date finds no record, and nothing says so.',
        }));
      }
    }

    if (transition.trigger.kind === 'schedule' && scheduleIssues({ cron: transition.trigger.when }).length > 0) {
      issues.push(make('behavior.transition.schedule-invalid', 'error', {
        entity: transition.entity,
        field: transition.name,
        message: `"${transition.name}" is triggered by a clock, and "${transition.trigger.when}" is not a cron expression `
          + `the kernel clock can run — it must have five fields, happen at least once, and not fire more often than every `
          + `${MIN_SCHEDULE_INTERVAL_MINUTES} minutes.`,
        suggestion: 'Write `when` as cron: "0 5 * * *" is every day at 05:00, "0 8 * * MON-FRI" is weekdays at 08:00. It '
          + 'runs in the office time zone, and the workflow it becomes is { eventName: "schedule", schedule: { cron } }.',
        howToDeclareException: 'None. A schedule the clock cannot read never fires, and nothing would say so.',
      }));
    }

    const mapped = mapTransition(transition, state?.field ?? '', handle.collection);
    // A DESCRIÇÃO, e ela é do MECANISMO, não da documentação: onde o fluxo é candidato de uma
    // superfície que escolhe sozinha, a ausência não tem sintoma — instala, roda quando alguém
    // aperta o botão, e desaparece da única lista que o escolheria.
    if (mapped.describable && (transition.description ?? '').trim() === '') {
      issues.push(make('behavior.transition.without-description', 'warning', {
        entity: transition.entity,
        field: transition.name,
        message: `"${transition.name}" becomes a callable flow (\`${mapped.eventName}\`) with no description, and `
          + `${DESCRIPTION_REQUIRED_BECAUSE}.`,
        suggestion: 'Give the transition a `description`: one sentence in business language saying what this passage '
          + 'does ("resolves a ticket that has been answered"). It becomes the flow\'s own description, which is the '
          + 'only text that decision reads — the same standing the workflow description already has as the '
          + 'classification contract of the automation detector.',
        howToDeclareException: 'None that the model can express. If the flow really must never be picked '
          + 'automatically, that is a decision about the INSTALLED flow, and the office turns it off there — leaving '
          + 'the description empty says the same thing by accident, and nothing records that it was on purpose.',
      }));
    }
    transitions.push(mapped);
  }

  return { issues, transitions };
};

// ─── Invariantes ──────────────────────────────────────────────────────────────

/**
 * A METADE QUE FALTAVA. `scope: 'transition'` prometia recusar a passagem e mapeava para o par
 * condição + `exit`; num gatilho `entity-event` esse par não recusa nada, porque
 * `publishWorkflowEventOnEntityChange` é um `onDocumentWritten` — quando o evento existe, a escrita
 * já foi confirmada, e `exit` (que é `halt: true`) interrompe o resto do fluxo, não a gravação.
 *
 * Então o modelo declara qual das duas coisas a regra é, e o detector pega a que foi posta no lugar
 * errado: uma invariante que PRECISA impedir, pendurada num gatilho que só existe depois do fato.
 */
const enforcementIssues = (invariant: BehaviorInvariant, behavior: BehaviorModel): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const at = { entity: invariant.entity, ...(invariant.field === undefined ? {} : { field: invariant.field }) };

  if (invariant.scope !== 'transition') {
    if (invariant.enforcement === 'blocks' && enforcementOfScope(invariant.scope) === 'reacts') {
      issues.push(make('behavior.invariant.blocks-after-the-fact', 'error', {
        ...at,
        message: `This invariant over "${invariant.entity}" must BLOCK, and its scope is "${invariant.scope}", whose only `
          + 'mechanism is the validate-object STEP. A step runs inside a flow, and a flow starts from a write that is '
          + 'already committed: it reports the record that is wrong and never refuses it.',
        suggestion: 'The write path carries FIELD rules only, and it does refuse — the repository throws before the '
          + 'document is written. Split the rule into the fields it is really about: field '
          + '{ logic: { validate: \'if(<expression>, null, "<message>")\' } }. If it is genuinely about the passage and not the record, '
          + 'declare it scope "transition" over a user-action transition, where the gesture can be refused.',
        howToDeclareException: 'enforcement: "reacts" — and then say so in the message, because "this cannot be saved" '
          + 'and "this was saved and is wrong" are read differently by whoever sees them.',
      }));
    }
    return issues;
  }

  const named = invariant.transition === undefined
    ? undefined
    : behavior.transitions.find((one) => one.name === invariant.transition);

  if (named === undefined) {
    issues.push(make('behavior.invariant.transition-unknown', 'error', {
      ...at,
      message: invariant.transition === undefined
        ? `An invariant over "${invariant.entity}" has scope "transition" and names no transition.`
        : `No transition is called "${invariant.transition}".`,
      suggestion: 'Point `transition` at the `name` of one of them. The name is not decoration: it is what decides '
        + 'WHERE this rule can be enforced, because that is what the trigger decides.',
      howToDeclareException: 'None. A rule about a passage that does not exist is a sentence, not a declaration.',
    }));
  }

  if (invariant.enforcement === undefined) {
    issues.push(make('behavior.invariant.transition-without-enforcement', 'error', {
      ...at,
      message: `This invariant is about the passage${invariant.transition === undefined ? '' : ` "${invariant.transition}"`}`
        + ' and does not say whether it REFUSES it or REACTS to it. The two are different mechanisms, and one of them '
        + 'does not exist on every trigger.',
      suggestion: 'enforcement: "blocks" — the field rule the write path throws on, plus the action that refuses the '
        + 'gesture. Or enforcement: "reacts" — the workflow condition plus an "exit" step, which stops the rest of the '
        + 'flow over a record that is already written. Reading a plan that promises the first and delivers the second '
        + 'is how "the system will not let this happen" becomes "the system noticed afterwards".',
      howToDeclareException: 'None. There is no default that is right in both directions: guessing "blocks" promises '
        + 'what a save trigger cannot do, and guessing "reacts" quietly downgrades a rule someone meant as a barrier.',
    }));
    return issues;
  }

  if (invariant.enforcement === 'blocks' && named !== undefined && named.trigger.kind !== 'user-action') {
    const clock = named.trigger.kind === 'schedule' || named.trigger.kind === 'date-reached';
    issues.push(make('behavior.invariant.blocks-after-the-fact', 'error', {
      ...at,
      message: `"${named.name}" is triggered by ${clock ? 'a clock' : 'a save'}, and this invariant must BLOCK the `
        + `passage. ${clock ? 'A clock looks at records that are already written: it can move them on, never stop them '
        + 'being written.' : 'The event is published by an onDocumentWritten '
        + 'trigger: by the time it exists the document is committed. The condition and the "exit" step stop the rest of '
        + 'the flow; nothing rolls the write back.'}`,
      suggestion: 'Two ways, and both are declarations. Put the rule on the WRITE path — field '
        + '{ logic: { validate: \'if(<expression>, null, "<message>")\' } }, which the repository throws on before the document is '
        + 'written. Or make the passage a gesture: trigger { kind: "user-action", action }, and then the action\'s '
        + 'disabledWhen over `record.<field>` refuses it before anything runs, and the flow\'s own condition sits '
        + 'before the flow\'s own upsert.',
      howToDeclareException: 'enforcement: "reacts", when reacting is really what the rule is for — and then the '
        + 'message has to read like one, because "cannot" and "should not have" are not the same sentence to whoever '
        + 'gets it.',
    }));
  }

  return issues;
};

const invariantIssues = (
  behavior: BehaviorModel,
  handles: ReadonlyMap<string, BehaviorEntityHandle>,
  vocabulary: ReadonlySet<string>,
): DomainIssue[] => {
  const issues: DomainIssue[] = [];

  for (const invariant of behavior.invariants) {
    const handle = handles.get(invariant.entity);
    issues.push(...enforcementIssues(invariant, behavior));

    if (invariant.scope === 'collection') {
      // A ÚNICA invariante cujo mecanismo não é expressão: ela aponta para uma chave declarada, e o
      // que se cobra aqui é que a declaração exista. Sem essa cobrança, "não pode haver dois com o
      // mesmo código" voltaria a ser uma frase que passa no gate e não vale em lugar nenhum.
      const declared = handle?.keyNames ?? new Set<string>();
      const named = invariant.key;
      if (named === undefined || !declared.has(named)) {
        issues.push(make('behavior.invariant.uniqueness-undeclared', 'error', {
          entity: invariant.entity,
          message: named === undefined
            ? `An invariant over "${invariant.entity}" has scope "collection" and names no key.`
            : `The invariant names key "${named}", and "${invariant.entity}" does not declare it.`
              + (declared.size > 0 ? ` It declares: ${[...declared].join(', ')}.` : ' It declares none.'),
          suggestion: 'Uniqueness is the one rule here that is DECLARED, never written as an expression: a validate '
            + 'sees one record and cannot query the others. Declare it on the entity — '
            + 'keys: [{ name, kind: "unique", fields: [...] }] — or, when one field is the whole key, `unique: true` '
            + 'on the field, which becomes the key named `field:<key>`. Then point this invariant at that name.',
          howToDeclareException: 'None. A rule that says "unique" and lets duplicates through is worse than no rule, '
            + 'because whoever reads the screen stops checking.',
        }));
      }
      continue;
    }

    if (invariant.scope === 'field' && (invariant.field === undefined || !(handle?.fields.has(invariant.field) ?? true))) {
      issues.push(make('behavior.invariant.field-scope-without-field', 'error', {
        entity: invariant.entity,
        ...(invariant.field === undefined ? {} : { field: invariant.field }),
        message: invariant.field === undefined
          ? `An invariant over "${invariant.entity}" has scope "field" and names no field.`
          : `"${invariant.entity}" has no field "${invariant.field}".`,
        suggestion: 'A field rule lives IN the field — { logic: { validate: \'if(<expression>, null, "<message>")\' } } — so it needs to '
          + 'know which one. A rule about the record as a whole is scope "record", and it becomes a validate-object step.',
        howToDeclareException: 'None.',
      }));
    }

    const foreign = rootTokens(invariant.expression).filter((token) =>
      !SCOPE_TOKENS.has(token)
      && !FUNCTION_NAMES.has(token)
      && !(handle?.fields.has(token) ?? false)
      && !(handle?.denormKeys.has(token) ?? false)
      && vocabulary.has(token));

    if (foreign.length === 0) continue;

    const ownNames = new Set([invariant.entity, handle?.collection].filter((one): one is string => one !== undefined));
    const aboutItself = foreign.some((one) => ownNames.has(one));

    issues.push(make('behavior.invariant.cross-record', 'error', {
      entity: invariant.entity,
      ...(invariant.field === undefined ? {} : { field: invariant.field }),
      message: aboutItself
        ? `This invariant compares "${invariant.entity}" against its own other records — a uniqueness rule — and it is `
          + 'written as an EXPRESSION. No expression here can do it: a field rule and an object validation both see one '
          + 'record and never query.'
        : `This invariant reads ${foreign.map((one) => `"${one}"`).join(', ')}, which is a set of records. A field rule and `
          + 'an object validation both see one record and never query.',
      suggestion: aboutItself
        ? 'Declare it instead of computing it: keys: [{ name, kind: "unique", fields: [...] }] on the entity, or '
          + '`unique: true` on the field when one field is the whole key — and then an invariant with '
          + 'scope: "collection" pointing at that key name. The value is reserved in a document whose id derives from '
          + 'the value, written in the same batch as the record, so two writes at the same instant do not both pass.'
        : 'Query first, then validate: a query step publishes the rows, and the condition or the validate-object step '
          + 'reads its outputs.',
      howToDeclareException: aboutItself
        ? 'None. Do not simulate the comparison — a rule that says "unique" and lets duplicates through is worse than '
          + 'no rule, because whoever reads the screen stops checking. The key is the declaration that holds.'
        : 'Denormalize the value onto the record if it is read this often, and the invariant becomes local.',
    }));
  }

  return issues;
};

// ─── A porta ──────────────────────────────────────────────────────────────────

/**
 * As permissões que JÁ existem sem ninguém declarar nada: as quatro de cada coleção, e as do núcleo.
 * Derivado, para que uma capacidade nova do kernel entre aqui sozinha.
 */
const knownPermissionSet = (model: DomainModel, catalog: DomainCatalog): Set<string> => {
  const permissions = new Set(KERNEL_PERMISSIONS.map((one) => one.id));
  const collections = [
    ...model.entities.map(collectionOfEntity),
    ...catalog.entities.map((one) => one.collection),
  ];
  for (const collection of collections) {
    for (const action of CRUD_ACTIONS) permissions.add(`${collection}.${action}`);
  }
  return permissions;
};

/**
 * A porta ÚNICA do comportamento, chamada de dentro de `validateDomainModel` — não de fora.
 *
 * O gate é UM porque a pergunta é uma: "este modelo está de pé?". Estrutura e comportamento não se
 * validam separado sem que a metade certa passe a responder sobre a metade errada — um estado mora
 * num campo, um efeito grava numa coleção, um total é um campo derivado. Duas tools seriam duas
 * respostas para o mesmo modelo, e a segunda seria chamada por quem se lembrasse dela.
 */
export const validateBehaviorModel = (
  model: DomainModel,
  behavior: BehaviorModel,
  catalog: DomainCatalog,
): BehaviorValidation => {
  const handles = buildHandles(model, catalog);
  const vocabulary = recordVocabulary(model, catalog);
  const knownPermissions = knownPermissionSet(model, catalog);

  const { issues: transitionProblems, transitions } = transitionIssues(behavior, handles, vocabulary, knownPermissions);

  return {
    issues: [
      ...stateIssues(behavior, handles),
      ...reachabilityIssues(behavior),
      ...transitionProblems,
      ...invariantIssues(behavior, handles, vocabulary),
    ],
    transitions,
  };
};
