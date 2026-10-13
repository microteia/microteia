import type { DomainAggregation, DomainIssue } from './domainModel';
import { malformedIssue, readAggregationOrderBy } from './domainModel';

/**
 * O MODELO DE COMPORTAMENTO — o irmão que faltava ao `domainModel.ts`.
 *
 * O modelo de domínio descreve a ESTRUTURA: quais entidades existem, o que cada campo significa,
 * como elas se ligam. Ele não diz o que ACONTECE. E enquanto ele não diz, o agente modela entidades
 * bonitas e espera que alguém peça "agora cria a automação X" — o que nunca chega, porque quem pediu
 * o sistema descreveu o comportamento na MESMA frase em que descreveu a estrutura: "uma venda nasce
 * em rascunho; ao confirmar, reserva estoque; só o gerente cancela venda faturada".
 *
 * As três metades do comportamento, e nenhuma é opcional na frase de negócio:
 *
 * - **O que acontece** — a transição de estado, e os efeitos dela.
 * - **Quando** — o gatilho: uma gravação, um gesto de pessoa, um relógio.
 * - **Quem pode** — a permissão, que é o único jeito de dizer "só o gerente" nesta plataforma.
 *
 * A disciplina é a do irmão, e por isso ele fica no mesmo diretório: vocabulário declarado em
 * arrays (a união sai deles), leitura tolerante que devolve problema em vez de exceção, detectores
 * num `Record` indexado pelo código, e a tradução para mecanismo real num arquivo só
 * (`behaviorMapping.ts`), que RECUSA alto o que a plataforma não tem.
 *
 * O que ele NÃO é: um segundo motor de workflow. Não há aqui execução, ordenação de passos nem
 * avaliação de expressão — a saída é declaração, e quem a consome são `WorkflowDefinition`,
 * `ActionDefinition`, `FieldRules` e `FieldAggregation`, que já existem.
 */

/** O nome da regra desta metade, escrito uma vez e citado por quem a aplica. */
export const A_STATE_IS_A_KEY =
  'A state is a key, never a label: the label is what the office renamed this morning.';

// ─── Vocabulário ──────────────────────────────────────────────────────────────

/**
 * De onde a transição vem.
 *
 * - `entity-event` — uma gravação ou exclusão da própria entidade. NÃO tem ator: ninguém a chamou.
 * - `user-action`  — um gesto de pessoa sobre um registro, que é a única forma de haver ator.
 * - `schedule`     — um relógio: `when` é cron. Vira consulta pelo `from` mais um laço.
 * - `date-reached` — uma data do PRÓPRIO registro chega (`field`, `offset` em dias, `at`). Vira
 *                    `<coleção>.dateReached`: o kernel acha os registros devidos, e cada um chega sozinho.
 */
export const TRIGGER_KINDS = ['entity-event', 'user-action', 'schedule', 'date-reached'] as const;
export type TriggerKind = (typeof TRIGGER_KINDS)[number];

/**
 * O que um efeito FAZ. Cada valor mapeia para um passo do catálogo do kernel, ou — no caso de
 * `total` — para nenhum passo, o que é justamente o ponto dele.
 */
export const EFFECT_KINDS = [
  'set-field',
  'create-record',
  'update-record',
  'delete-record',
  'total',
  'notify',
  'call-automation',
  'wait',
] as const;
export type EffectKind = (typeof EFFECT_KINDS)[number];

/**
 * Sobre o que o invariante vale, e é o escopo que decide ONDE ele mora:
 *
 * - `field`      — uma regra do campo, avaliada a cada digitação E no caminho de gravação.
 * - `record`     — o registro inteiro, avaliado num ponto do fluxo, depois da gravação.
 * - `transition` — a passagem. E aqui o escopo não basta: ver `INVARIANT_ENFORCEMENTS`.
 * - `collection` — entre os registros da coleção: "não pode haver dois com o mesmo código". É o
 *   único escopo cujo mecanismo NÃO é uma expressão: ele vira uma CHAVE declarada
 *   (`entity.keys` / `field.unique`), porque uma expressão vê um registro e nunca consulta os
 *   outros. Quem o declara diz quais campos, e o gate cobra que a chave exista.
 *
 * O escopo `collection` não existia, e a ausência era a resposta certa enquanto a plataforma não
 * tinha restrição de unicidade em camada nenhuma. Passou a ter: a chave reserva o valor num
 * documento cujo id vem do próprio valor, e a criação desse documento é a trava. Ver "Chave primária
 * e chave única" no ARCHITECTURE.md.
 */
export const INVARIANT_SCOPES = ['field', 'record', 'transition', 'collection'] as const;
export type InvariantScope = (typeof INVARIANT_SCOPES)[number];

/**
 * O que o invariante FAZ quando reprova — a metade que faltava ao escopo `transition`.
 *
 * - `blocks` — recusa a passagem ANTES de ela acontecer. Só existe onde há caminho de gravação em
 *   que sentar: a regra do campo, que `FirebaseRecordRepository.applyRecordRules` LANÇA antes de
 *   escrever, e o gesto da pessoa — `disabledWhen`/`hiddenWhen` da ação, mais a condição do fluxo
 *   chamável, que é avaliada antes do `upsert` do próprio fluxo.
 * - `reacts` — o registro JÁ está gravado, e o que se interrompe é o que vem depois.
 *
 * A distinção não é sutileza de vocabulário: `scope: 'transition'` mapeava, sozinho, para o par
 * condição + `exit`, e prometia recusar a passagem. Num gatilho `entity-event` isso é falso —
 * `publishWorkflowEventOnEntityChange` é um `onDocumentWritten`, então quando o evento existe a
 * escrita já foi confirmada e nada a desfaz. A invariante que precisava impedir interrompia apenas
 * o resto do fluxo, e quem leu o plano leu "recusa a passagem".
 */
export const INVARIANT_ENFORCEMENTS = ['blocks', 'reacts'] as const;
export type InvariantEnforcement = (typeof INVARIANT_ENFORCEMENTS)[number];

/**
 * O `enforcement` que o ESCOPO já decide sozinho; `undefined` quando é a declaração que decide.
 *
 * `field` bloqueia porque a regra do campo está no caminho de gravação. `record` reage porque o
 * mecanismo dele é um PASSO (`validate-object`), e um passo roda dentro de um fluxo — depois da
 * escrita que o disparou. `transition` depende do gatilho, e é por isso que ele é declarado.
 */
export const enforcementOfScope = (scope: InvariantScope): InvariantEnforcement | undefined => {
  if (scope === 'field') return 'blocks';
  if (scope === 'record') return 'reacts';
  // A chave bloqueia, e bloqueia mais cedo que qualquer regra: a gravação é recusada pelo próprio
  // Firestore, no mesmo lote — não há instante em que o registro duplicado existiu.
  if (scope === 'collection') return 'blocks';
  return undefined;
};

// ─── O modelo ─────────────────────────────────────────────────────────────────

/**
 * Uma opção do estado. A IDENTIDADE é a `key`, e o `label` é texto que o escritório renomeia sem
 * avisar ninguém — `CustomFieldOption` já é assim, e esta plataforma já foi mordida por comparar o
 * rótulo. Uma transição que compara `label` funciona no dia em que foi escrita e para de funcionar
 * na primeira tradução, sem sintoma nenhum.
 */
export interface BehaviorStateOption {
  key: string;
  label: string;
}

/**
 * A máquina de estados de UMA entidade: o campo que guarda o estado e as opções que ele admite.
 *
 * `lookup` é o nome da lista que serve o campo, e não é enfeite: opção de `select` só tem onde morar
 * num pacote quando existe uma lista (`LookupModuleTemplate.options`, semeada uma vez). Sem ela as
 * `options` daqui não chegam a artefato nenhum.
 */
export interface BehaviorState {
  entity: string;
  /** A chave do campo de estado, no próprio registro. */
  field: string;
  /** A lista de opções que serve o campo. */
  lookup?: string;
  options: BehaviorStateOption[];
  /** A `key` com que o registro nasce. */
  initial?: string;
  /** As `key`s de onde não se sai — declaradas, porque "sem saída" e "fim" se escrevem igual. */
  terminal?: string[];
}

export type BehaviorTrigger =
  | { kind: 'entity-event'; event: 'saved' | 'deleted' }
  | { kind: 'user-action'; action: string }
  | { kind: 'schedule'; when: string }
  | { kind: 'date-reached'; field: string; offset: string; at?: string };

/**
 * A condição que autoriza a passagem. É uma EXPRESSÃO sobre o registro em mãos, e só sobre ele: a
 * condição de um passo não consulta o banco. Ver `behavior.guard.needs-other-records`.
 */
export interface BehaviorGuard {
  expression: string;
}

export interface BehaviorEffect {
  kind: EffectKind;
  /** A entidade tocada. Ausente = a própria entidade da transição. */
  entity?: string;
  /** O campo gravado, em `set-field`, `create-record`, `update-record` e `total`. */
  field?: string;
  /** O valor ou a expressão gravada. Em `total` é ERRO — o total não é expressão. */
  value?: string;
  /** `total`: o agregado, na mesma forma que o modelo de domínio já declara. */
  aggregation?: DomainAggregation;
  /** `call-automation`: o nome da outra transição chamada. */
  target?: string;
  /**
   * `wait`: quanto esperar antes dos efeitos SEGUINTES (`30m`, `4h`, `2d`). Os anteriores rodam na hora. Os
   * seguintes veem o registro como estava na passagem — a espera não reconfere o estado.
   */
  duration?: string;
}

export interface BehaviorTransition {
  /** Obrigatório: é por ele que um invariante de transição e um efeito a citam. */
  name: string;
  /**
   * A frase que descreve o que esta passagem FAZ, em linguagem de negócio.
   *
   * Não é documentação: é a `description` do fluxo, e há um mecanismo que a EXIGE. O passo
   * `ai-detect-workflow` monta os candidatos com `findEnabledByEvent(tenantId, 'workflow.called')` e
   * então descarta todo fluxo cuja descrição esteja vazia — o filtro está no passo e outra vez no
   * serviço de detecção. Um fluxo chamável sem descrição instala, roda quando alguém aperta o botão,
   * e é invisível para a única superfície que o escolheria sozinho. Ver `describableTransition`.
   */
  description?: string;
  entity: string;
  /** A `key` de origem. */
  from: string;
  /** A `key` de destino. Igual a `from` = "ao gravar, faça isto e continue onde estava". */
  to: string;
  trigger: BehaviorTrigger;
  guard?: BehaviorGuard;
  effects: BehaviorEffect[];
  /**
   * O ator que a REGRA DE NEGÓCIO nomeou, nas palavras dela ("o gerente", "o financeiro").
   *
   * Ele existe para que a ausência da permissão seja VERIFICÁVEL. Decidir se "o gerente" é uma
   * permissão nova ou uma que já existe é julgamento, e julgamento fica como instrução ao modelo;
   * mas nomear um ator e não dizer o que se pergunta a ele é comparação, e é aqui que ela é feita.
   */
  actor?: string;
  /** O identificador da permissão (`recurso.acao`), nunca o de um perfil. */
  permission?: string;
}

export interface BehaviorInvariant {
  scope: InvariantScope;
  entity: string;
  /** Obrigatório em `scope: 'field'`. */
  field?: string;
  /** Obrigatório em `scope: 'transition'`: o `name` da transição. */
  transition?: string;
  /**
   * Obrigatório em `scope: 'collection'`: o `name` da CHAVE que faz a regra valer. É a única
   * invariante que não vira expressão — ela aponta para uma declaração, e o gate cobra que a
   * declaração exista. Sem isso, "não pode haver dois com o mesmo código" voltaria a ser prosa.
   */
  key?: string;
  /**
   * Obrigatório em `scope: 'transition'`: recusa a passagem, ou reage a ela já feita. Nos outros
   * escopos o mecanismo já responde — ver `enforcementOfScope`.
   */
  enforcement?: InvariantEnforcement;
  expression: string;
  /** A frase que a pessoa lê quando a regra reprova. */
  message: string;
}

export interface BehaviorModel {
  states: BehaviorState[];
  transitions: BehaviorTransition[];
  invariants: BehaviorInvariant[];
}

/** A `key` do estado de uma entidade, ou `undefined` quando ela não tem máquina de estados. */
export const stateOfEntity = (
  behavior: BehaviorModel | undefined,
  entity: string,
): BehaviorState | undefined => behavior?.states.find((one) => one.entity === entity);

/** A entidade que o efeito toca: a dele, quando declarada; a da transição, quando não. */
export const effectEntity = (effect: BehaviorEffect, transition: BehaviorTransition): string =>
  effect.entity?.trim() || transition.entity;

/** Um laço declarado de propósito — "ao gravar, faça isto e continue onde estava". */
export const isSelfLoop = (transition: BehaviorTransition): boolean => transition.from === transition.to;

// ─── Leitura tolerante ────────────────────────────────────────────────────────

/**
 * O comportamento chega do mesmo lugar que o domínio — um LLM —, então chega torto pelos mesmos
 * motivos, e a resposta é a mesma: problema em vez de exceção, e o resto do modelo segue sendo lido.
 * Uma transição malformada no meio não pode calar as outras nove.
 */
const bad = (message: string, suggestion: string, entity?: string, field?: string): DomainIssue =>
  malformedIssue('behavior.model.malformed', message, suggestion, entity, field);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

const strList = (value: unknown): string[] =>
  (Array.isArray(value) ? value.filter((one): one is string => typeof one === 'string').map((one) => one.trim()) : []);

const oneOf = <T extends string>(value: unknown, allowed: readonly T[]): T | undefined =>
  typeof value === 'string' && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;

const readOption = (raw: unknown, entity: string, issues: DomainIssue[]): BehaviorStateOption | null => {
  if (!isRecord(raw)) {
    issues.push(bad('A state option must be an object.', 'Each option is { key, label }.', entity));
    return null;
  }
  const key = str(raw.key);
  if (key === undefined) {
    issues.push(bad(
      'A state option has no "key".',
      `${A_STATE_IS_A_KEY} The label may be missing; the key may not.`,
      entity,
    ));
    return null;
  }
  return { key, label: str(raw.label) ?? key };
};

const readState = (raw: unknown, issues: DomainIssue[]): BehaviorState | null => {
  if (!isRecord(raw)) {
    issues.push(bad('A state must be an object.', 'Each entry of "states" is { entity, field, options }.'));
    return null;
  }
  const entity = str(raw.entity);
  const field = str(raw.field);
  if (entity === undefined || field === undefined) {
    issues.push(bad(
      'A state declaration is missing "entity" or "field".',
      'A state machine belongs to one entity and lives in one field of it.',
      entity,
      field,
    ));
    return null;
  }
  const options = (Array.isArray(raw.options) ? raw.options : [])
    .map((one) => readOption(one, entity, issues))
    .filter((one): one is BehaviorStateOption => one !== null);

  const state: BehaviorState = { entity, field, options };
  if (str(raw.lookup) !== undefined) state.lookup = str(raw.lookup) as string;
  if (str(raw.initial) !== undefined) state.initial = str(raw.initial) as string;
  const terminal = strList(raw.terminal).filter((one) => one !== '');
  if (terminal.length > 0) state.terminal = terminal;
  return state;
};

const readTrigger = (raw: unknown, name: string, issues: DomainIssue[]): BehaviorTrigger | null => {
  if (!isRecord(raw)) {
    issues.push(bad(
      `Transition "${name}" has no "trigger".`,
      `A transition without a trigger never happens. Use one of: ${TRIGGER_KINDS.join(', ')}.`,
    ));
    return null;
  }
  const kind = oneOf(raw.kind, TRIGGER_KINDS);
  if (kind === undefined) {
    issues.push(bad(
      `Transition "${name}" has an unknown trigger kind.`,
      `Use one of: ${TRIGGER_KINDS.join(', ')}. "entity-event" is a save or a delete, "user-action" is a person `
      + 'pressing something, "schedule" is a clock, "date-reached" is a date of the record arriving.',
    ));
    return null;
  }
  if (kind === 'entity-event') {
    const event = oneOf(raw.event, ['saved', 'deleted'] as const) ?? 'saved';
    return { kind, event };
  }
  if (kind === 'user-action') {
    const action = str(raw.action);
    if (action === undefined) {
      issues.push(bad(
        `Transition "${name}" is triggered by a person and does not say by WHICH gesture.`,
        'Give the trigger an "action" key — it becomes the key of the record action the person presses.',
      ));
      return null;
    }
    return { kind, action };
  }
  if (kind === 'date-reached') {
    const field = str(raw.field);
    if (field === undefined) {
      issues.push(bad(
        `Transition "${name}" happens when a date arrives and does not say WHICH date.`,
        'Give the trigger a "field" — the date field of the entity it watches — and an "offset" in days: "-3d" three '
        + 'days before, "0d" on the day, "+1d" the day after.',
      ));
      return null;
    }
    const at = str(raw.at);
    return { kind, field, offset: str(raw.offset) ?? '0d', ...(at === undefined ? {} : { at }) };
  }
  return { kind, when: str(raw.when) ?? '' };
};

const readEffect = (raw: unknown, name: string, issues: DomainIssue[]): BehaviorEffect | null => {
  if (!isRecord(raw)) {
    issues.push(bad(`An effect of "${name}" is not an object.`, 'Each effect is { kind, ... }.'));
    return null;
  }
  const kind = oneOf(raw.kind, EFFECT_KINDS);
  if (kind === undefined) {
    issues.push(bad(
      `An effect of "${name}" has an unknown kind.`,
      `Use one of: ${EFFECT_KINDS.join(', ')}.`,
    ));
    return null;
  }
  const effect: BehaviorEffect = { kind };
  if (str(raw.entity) !== undefined) effect.entity = str(raw.entity) as string;
  if (str(raw.field) !== undefined) effect.field = str(raw.field) as string;
  if (str(raw.value) !== undefined) effect.value = str(raw.value) as string;
  if (str(raw.target) !== undefined) effect.target = str(raw.target) as string;
  if (str(raw.duration) !== undefined) effect.duration = str(raw.duration) as string;
  if (isRecord(raw.aggregation)) {
    const from = str(raw.aggregation.from);
    const via = str(raw.aggregation.via);
    const op = str(raw.aggregation.op);
    if (from !== undefined && via !== undefined && op !== undefined) {
      effect.aggregation = {
        from,
        via,
        op: op as DomainAggregation['op'],
        ...(str(raw.aggregation.field) === undefined ? {} : { field: str(raw.aggregation.field) as string }),
        ...(str(raw.aggregation.filter) === undefined ? {} : { filter: str(raw.aggregation.filter) as string }),
        ...(Array.isArray(raw.aggregation.orderBy) ? { orderBy: readAggregationOrderBy(raw.aggregation.orderBy) } : {}),
      };
    }
  }
  return effect;
};

const readTransition = (raw: unknown, issues: DomainIssue[]): BehaviorTransition | null => {
  if (!isRecord(raw)) {
    issues.push(bad('A transition must be an object.', 'Each entry is { name, entity, from, to, trigger, effects }.'));
    return null;
  }
  const name = str(raw.name);
  const entity = str(raw.entity);
  const from = str(raw.from);
  const to = str(raw.to);
  if (name === undefined || entity === undefined || from === undefined || to === undefined) {
    issues.push(bad(
      `A transition is missing name, entity, from or to (${name ?? '?'}).`,
      `The four are what make it one definition instead of a hint. ${A_STATE_IS_A_KEY}`,
      entity,
    ));
    return null;
  }
  const trigger = readTrigger(raw.trigger, name, issues);
  if (trigger === null) return null;

  const transition: BehaviorTransition = {
    name,
    entity,
    from,
    to,
    trigger,
    effects: (Array.isArray(raw.effects) ? raw.effects : [])
      .map((one) => readEffect(one, name, issues))
      .filter((one): one is BehaviorEffect => one !== null),
  };
  if (isRecord(raw.guard) && str(raw.guard.expression) !== undefined) {
    transition.guard = { expression: str(raw.guard.expression) as string };
  } else if (str(raw.guard) !== undefined) {
    transition.guard = { expression: str(raw.guard) as string };
  }
  if (str(raw.description) !== undefined) transition.description = str(raw.description) as string;
  if (str(raw.actor) !== undefined) transition.actor = str(raw.actor) as string;
  if (str(raw.permission) !== undefined) transition.permission = str(raw.permission) as string;
  return transition;
};

const readInvariant = (raw: unknown, issues: DomainIssue[]): BehaviorInvariant | null => {
  if (!isRecord(raw)) {
    issues.push(bad('An invariant must be an object.', 'Each entry is { scope, entity, expression, message }.'));
    return null;
  }
  const scope = oneOf(raw.scope, INVARIANT_SCOPES);
  const entity = str(raw.entity);
  // O escopo `collection` é o único sem expressão: o mecanismo dele é uma CHAVE declarada, e uma
  // expressão ali seria decorativa — nada a avaliaria. Exigi-la faria quem declara escrever uma
  // frase que o gate aceita e o runtime ignora, que é a pior combinação possível.
  const expression = str(raw.expression) ?? (scope === 'collection' ? '' : undefined);
  if (scope === undefined || entity === undefined || expression === undefined) {
    issues.push(bad(
      `An invariant is missing scope, entity or expression (${entity ?? '?'}).`,
      `scope: ${INVARIANT_SCOPES.join(' | ')}, and scope "transition" also needs enforcement: `
      + `${INVARIANT_ENFORCEMENTS.join(' | ')}. Scope "collection" is the one that compares records — `
      + 'it becomes a declared KEY on the entity, never an expression.',
      entity,
    ));
    return null;
  }
  const invariant: BehaviorInvariant = { scope, entity, expression, message: str(raw.message) ?? '' };
  if (str(raw.field) !== undefined) invariant.field = str(raw.field) as string;
  if (str(raw.key) !== undefined) invariant.key = str(raw.key) as string;
  if (str(raw.transition) !== undefined) invariant.transition = str(raw.transition) as string;
  const enforcement = oneOf(raw.enforcement, INVARIANT_ENFORCEMENTS);
  if (enforcement !== undefined) invariant.enforcement = enforcement;
  return invariant;
};

/**
 * Lê o comportamento de dentro do modelo. Devolve `undefined` quando não há bloco `behavior` — a
 * ausência é legítima: um cadastro sem estado é um cadastro, não um modelo incompleto.
 */
export const parseBehaviorModel = (raw: unknown, issues: DomainIssue[]): BehaviorModel | undefined => {
  if (raw === undefined || raw === null) return undefined;
  if (!isRecord(raw)) {
    issues.push(bad(
      '"behavior" must be an object.',
      'It is { states, transitions, invariants } — read microteia://domain-model/schema.',
    ));
    return undefined;
  }
  const model: BehaviorModel = {
    states: (Array.isArray(raw.states) ? raw.states : [])
      .map((one) => readState(one, issues))
      .filter((one): one is BehaviorState => one !== null),
    transitions: (Array.isArray(raw.transitions) ? raw.transitions : [])
      .map((one) => readTransition(one, issues))
      .filter((one): one is BehaviorTransition => one !== null),
    invariants: (Array.isArray(raw.invariants) ? raw.invariants : [])
      .map((one) => readInvariant(one, issues))
      .filter((one): one is BehaviorInvariant => one !== null),
  };
  return model;
};
