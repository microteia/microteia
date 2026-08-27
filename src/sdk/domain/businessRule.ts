import type { DomainIssue, DomainModel } from './domainModel';
import { malformedIssue } from './domainModel';
import type { DomainIssueCode } from './detectors';
import { collectionOfEntity } from './toPlatform';

/**
 * A REGRA DE NEGÓCIO COMO ARTEFATO — o enunciado que o resto do pipeline consome, guardado em vez de
 * dissolvido.
 *
 * O precedente é da casa e é explícito: a `description` de um workflow é o CONTRATO DE CLASSIFICAÇÃO
 * do detector de automação — é o único texto que a decisão lê, e por isso ela não é comentário, é
 * artefato. A regra de negócio tem o mesmo estatuto. Ela chega como três linhas colhidas numa
 * conversa, é ela que decide quais entidades existem e o que acontece com elas, e até aqui ela
 * desaparecia: o modelo ficava no disco, o plano ficava na resposta da tool, e a frase que originou
 * os dois não ficava em lugar nenhum. Quando ela mudava, ninguém conseguia dizer o que ELA tinha
 * gerado — e a sessão seguinte propunha uma segunda leva de telas parecidas com as primeiras.
 *
 * O que ela NÃO é: uma segunda modelagem. Não há aqui entidade, campo nem transição — há o enunciado,
 * quem age, de que conceitos ele fala, o que tem de valer, o que acontece e como se sabe que foi
 * atendido. As checagens comparam ESSAS listas com o modelo, e nenhuma delas bloqueia: uma regra é
 * prosa, e prosa não valida — ela é o que o modelo tem de dar conta.
 */

export interface BusinessRule {
  /** Identidade estável, e é ela que a rastreabilidade guarda. Nunca o enunciado. */
  id: string;
  /** A regra nas palavras de quem a trouxe. Obrigatório: sem ela não há a que rastrear. */
  statement: string;
  /** Quem age, nas palavras da regra ("o gerente", "o financeiro"). */
  actors: string[];
  /** Os substantivos de negócio que a regra usa. Viram, ou não, entidades. */
  concepts: string[];
  /** O que tem de valer sempre, uma frase cada. */
  invariants: string[];
  /** O que acontece — cada passagem que a regra descreve. */
  processes: string[];
  /** Como se sabe que a regra foi atendida. Sem isto, "pronto" é opinião. */
  acceptance: string[];
}

const make = (code: DomainIssueCode, severity: DomainIssue['severity'], draft: Omit<DomainIssue, 'code' | 'severity'>): DomainIssue => ({
  code,
  severity,
  ...draft,
});

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const str = (value: unknown): string | undefined =>
  (typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined);

const strList = (value: unknown): string[] =>
  (Array.isArray(value) ? value : [])
    .filter((one): one is string => typeof one === 'string')
    .map((one) => one.trim())
    .filter((one) => one !== '');

export interface ParsedBusinessRule {
  rule: BusinessRule | null;
  issues: DomainIssue[];
}

/**
 * Leitura tolerante, pela mesma razão do modelo: a regra chega de um LLM que acabou de ler uma
 * conversa, então ela chega torta. `id` ausente é derivável — o enunciado é o que importa, e sem ele
 * não sobra artefato nenhum.
 */
export const parseBusinessRule = (raw: unknown, fallbackId = 'rule'): ParsedBusinessRule => {
  const issues: DomainIssue[] = [];
  let value: unknown = raw;

  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      // Uma string que não é JSON é o próprio enunciado. É o caso mais comum de todos: alguém colou a
      // regra. Recusá-la por forma seria recusar exatamente o gesto que este arquivo existe para servir.
      value = { statement: raw };
    }
  }

  if (!isRecord(value)) {
    return {
      rule: null,
      issues: [malformedIssue(
        'rule.statement-missing',
        'A business rule must be an object, or the sentence itself.',
        'It is { id, statement, actors, concepts, invariants, processes, acceptance } — and a bare sentence is read as '
        + 'the statement.',
      )],
    };
  }

  const statement = str(value.statement);
  if (statement === undefined) {
    return {
      rule: null,
      issues: [make('rule.statement-missing', 'error', {
        message: 'This business rule has no statement.',
        suggestion: 'The statement is the rule in the words it arrived in. Everything else here is a reading of it, and '
          + 'a reading with no original is not traceable to anything.',
        howToDeclareException: 'None. Without the sentence there is nothing for a later change to be a diff against.',
      })],
    };
  }

  return {
    rule: {
      id: str(value.id) ?? fallbackId,
      statement,
      actors: strList(value.actors),
      concepts: strList(value.concepts),
      invariants: strList(value.invariants),
      processes: strList(value.processes),
      acceptance: strList(value.acceptance),
    },
    issues,
  };
};

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();

/** "o gerente" casa com "gerente" e com "Gerente de vendas" — comparação por contenção, nos dois sentidos. */
const mentions = (haystack: string, needle: string): boolean => {
  const a = normalize(haystack);
  const b = normalize(needle);
  return a !== '' && b !== '' && (a.includes(b) || b.includes(a));
};

/**
 * A regra CONTRA o modelo. Nenhuma destas checagens bloqueia, e a razão é dura: a regra é prosa, e
 * comparar prosa com declaração dá falso positivo por construção. O que elas fazem é apontar a
 * DISTÂNCIA entre as duas — e uma distância apontada é o que se revisa; uma distância silenciosa é o
 * que se descobre quando o escritório usa o sistema.
 */
export const checkBusinessRule = (rule: BusinessRule, model: DomainModel): DomainIssue[] => {
  const issues: DomainIssue[] = [];
  const names = model.entities.flatMap((one) => [one.name, collectionOfEntity(one)]);
  const transitions = model.behavior?.transitions ?? [];

  for (const concept of rule.concepts) {
    if (names.some((name) => mentions(name, concept))) continue;
    issues.push(make('rule.concept-without-entity', 'warning', {
      message: `The rule speaks of "${concept}", and no entity and no collection of this model carries that name.`,
      suggestion: 'Either it is an entity nobody modelled yet, or it is a word — an attribute, a state, a moment. Both '
        + 'are legitimate; which one it is decides whether something is missing.',
      howToDeclareException: 'Drop it from `concepts`. The list is a reading of the sentence, and a reading may be '
        + 'revised — but revise it on purpose.',
    }));
  }

  for (const actor of rule.actors) {
    if (transitions.some((one) => one.actor !== undefined && mentions(one.actor, actor))) continue;
    issues.push(make('rule.actor-without-transition', 'warning', {
      message: `The rule names "${actor}" and no transition asks anything of them.`,
      suggestion: 'An actor exists in a rule because somebody may do something others may not. Put the actor on the '
        + 'transition they cause, with the permission it asks for — naming an actor and asking nothing is the same '
        + 'system as having no actor at all.',
      howToDeclareException: 'The actor is the person who merely READS. Then they belong in no transition, and dropping '
        + 'them from `actors` says so.',
    }));
  }

  if (rule.invariants.length > (model.behavior?.invariants ?? []).length) {
    issues.push(make('rule.invariant-not-modelled', 'warning', {
      message: `The rule states ${rule.invariants.length} invariant(s) and the behavior declares `
        + `${(model.behavior?.invariants ?? []).length}.`,
      suggestion: 'Every "cannot", "must" and "only" in the sentence is an invariant, and one that is not declared is '
        + 'enforced by whoever remembers it. Declare each one with its scope and, on a transition, its enforcement.',
      howToDeclareException: 'Two sentences of the rule may be one invariant. Merge them in `invariants` and the count '
        + 'closes honestly.',
    }));
  }

  if (rule.processes.length > transitions.length) {
    issues.push(make('rule.process-not-modelled', 'warning', {
      message: `The rule describes ${rule.processes.length} process(es) and the behavior declares ${transitions.length} `
        + 'transition(s).',
      suggestion: 'A process that moves a record from one state to another is a transition. One that does not move '
        + 'anything is a self-loop (from equal to to) — which is also declarable, and says "do this and stay put".',
      howToDeclareException: 'A process may be entirely outside the system (someone phones someone). Then it is not a '
        + 'transition, and it should not be in `processes` either.',
    }));
  }

  if (rule.acceptance.length === 0) {
    issues.push(make('rule.acceptance-missing', 'warning', {
      message: 'This rule has no acceptance criteria.',
      suggestion: 'Write what somebody would DO to see the rule working — "a ticket with no answer cannot be resolved", '
        + '"the total of the appointment equals the sum of its procedures". It is what turns "done" from an opinion '
        + 'into a check, and it is the part of the sentence that survives being re-read in six months.',
      howToDeclareException: 'None worth taking. A rule with nothing to verify cannot be shown to have been met.',
    }));
  }

  return issues;
};

/** Uma linha por regra, para quem lê o plano. */
export const businessRuleSummary = (rule: BusinessRule): string =>
  `${rule.id}: ${rule.statement}`
  + ` (${rule.concepts.length} concept(s), ${rule.processes.length} process(es), ${rule.invariants.length} invariant(s))`;
