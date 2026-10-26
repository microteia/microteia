// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/recordSequence.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/recordSequence.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { wallClockInTimeZone } from './i18n/timeZone';

/**
 * A SEQUÊNCIA de um campo: o número que o registro recebe ao NASCER, contado por um contador que
 * avança na mesma transação que grava o registro. É o modo de `autoValue` para o protocolo, o número
 * da comunicação, o número do pedido — o identificador que precisa ser sequencial e que não pode, em
 * hipótese nenhuma, se repetir.
 *
 * O `autoValue` sem `sequence` continua o que sempre foi: um SORTEIO que o formulário sugere e a
 * pessoa edita. Os dois modos não se misturam, e a diferença não é de grau:
 *
 * | | sorteio (`pattern`) | sequência (`pattern` + `sequence`) |
 * |---|---|---|
 * | quem atribui | o formulário, como sugestão | o caminho de gravação, ao criar |
 * | repetição | evitada só na janela carregada | impossível: o contador é transacional |
 * | depois de gravado | editável | imutável |
 *
 * Por que um CONTADOR e não uma reserva por valor (`recordKeys`): a reserva prova que o valor é
 * livre, mas não diz QUAL é o próximo — achar o próximo livre seria consultar, e consultar tem
 * corrida. O contador responde as duas perguntas num documento só, e a regra do Firestore impede
 * que ele recue, salte ou seja apagado.
 */
export const RECORD_SEQUENCE_SCOPES = ['tenant', 'parent'] as const;
export type RecordSequenceScope = (typeof RECORD_SEQUENCE_SCOPES)[number];

export const RECORD_SEQUENCE_RESETS = ['never', 'year'] as const;
export type RecordSequenceReset = (typeof RECORD_SEQUENCE_RESETS)[number];

export interface AutoValueSequence {
  /** `tenant` (padrão): um contador para o escritório. `parent`: um por registro-pai. */
  scope?: RecordSequenceScope;
  /** `never` (padrão): conta para sempre. `year`: recomeça em 1 a cada ano, no fuso do escritório. */
  resetBy?: RecordSequenceReset;
}

export interface AutoValueSpec {
  /**
   * No sorteio, a forma caractere a caractere (`A`, `0`, `*`). Na sequência, `YYYY` é o ano e a
   * sequência de `0` é o número com zeros à esquerda; o resto é literal. Vazio = o número puro.
   */
  pattern: string;
  sequence?: AutoValueSequence | null;
}

/** Os contadores, sob o tenant. Coleção reservada: nenhuma tela pode nascer com este nome. */
export const RECORD_SEQUENCES_COLLECTION = 'recordSequences';

/** A primeira versão do kernel que atribui a sequência — antes dela, o padrão viraria sorteio. */
export const RECORD_SEQUENCE_SINCE_KERNEL = '2.76.0';

/**
 * O separador do id do contador. A regra do Firestore RECOMPÕE o id a partir do corpo do documento
 * (`coleção|campo|pai|período`) — é isso que impede alguém de criar, sob o id do contador de uma
 * coleção, um documento que diga pertencer a outra.
 */
const COUNTER_ID_SEPARATOR = '|';

const YEAR_TOKEN = 'YYYY';
const ZEROS = /^0+$/;
const PATTERN_TOKENS = /(YYYY|0+)/;

/** A sequência declarada, com os padrões aplicados; `null` quando o campo não é sequencial. */
export const readAutoValueSequence = (
  autoValue: unknown,
): { scope: RecordSequenceScope; resetBy: RecordSequenceReset } | null => {
  if (autoValue === null || typeof autoValue !== 'object') return null;
  const sequence = (autoValue as { sequence?: unknown }).sequence;
  if (sequence === null || typeof sequence !== 'object' || Array.isArray(sequence)) return null;
  const raw = sequence as { scope?: unknown; resetBy?: unknown };
  return {
    scope: raw.scope === 'parent' ? 'parent' : 'tenant',
    resetBy: raw.resetBy === 'year' ? 'year' : 'never',
  };
};

/**
 * O campo é numerado pelo sistema? É a pergunta de todos os pontos que tratam o campo como somente
 * leitura: o formulário, a obrigatoriedade, a automação e o portal.
 */
export const isSequenceField = (field: { autoValue?: unknown }): boolean =>
  readAutoValueSequence(field.autoValue) !== null;

export interface RecordSequenceField {
  key: string;
  pattern: string;
  scope: RecordSequenceScope;
  resetBy: RecordSequenceReset;
  /** Campo `number`: grava o inteiro, e o padrão não se aplica. */
  numeric: boolean;
  /** O campo que guarda o pai, quando o escopo é `parent`. */
  parentFieldKey: string | null;
}

/**
 * Os campos sequenciais entre os campos dados — os RESOLVIDOS da coleção, que são os mesmos que a
 * gravação lê (`resolveRecordSequences`, em `screenEntity.ts`). Só os de primeiro nível: o contador é
 * do registro, e um campo aninhado não tem endereço estável nele.
 */
export const recordSequenceFields = (
  fields: readonly { key: string; type: string; autoValue?: { pattern?: string } | null }[],
  parentFieldKey: string | null,
): RecordSequenceField[] =>
  fields.flatMap((spec) => {
    const sequence = readAutoValueSequence(spec.autoValue);
    if (!sequence || spec.key.includes('.')) return [];
    return [{
      key: spec.key,
      pattern: (spec.autoValue?.pattern ?? '').trim(),
      scope: sequence.scope,
      resetBy: sequence.resetBy,
      numeric: spec.type === 'number',
      parentFieldKey: sequence.scope === 'parent' ? parentFieldKey : null,
    }];
  });

/** O que o documento do contador carrega além do valor — e de onde a regra recompõe o id. */
export interface RecordSequenceCounter {
  collection: string;
  field: string;
  /** Id do registro-pai; vazio no escopo do escritório. */
  parent: string;
  /** O ano (`2026`) quando a sequência recomeça a cada ano; vazio quando nunca recomeça. */
  period: string;
}

export const recordSequenceCounterId = (counter: RecordSequenceCounter): string =>
  [counter.collection, counter.field, counter.parent, counter.period].join(COUNTER_ID_SEPARATOR);

/** Um número a atribuir: o contador a avançar e como o valor sai dele. */
export interface RecordSequenceEntry {
  field: string;
  counterId: string;
  counter: RecordSequenceCounter;
  pattern: string;
  numeric: boolean;
  /** O ano da atribuição, no fuso do escritório — é o `YYYY` do padrão. */
  year: number;
}

/** O campo cujo contador é por pai, num registro sem pai. Recusa, não número a menos. */
export interface RecordSequenceGap {
  field: string;
  parentField: string;
}

export interface RecordSequencePlan {
  entries: RecordSequenceEntry[];
  gaps: RecordSequenceGap[];
}

/**
 * O id do pai como segmento de caminho. Um id com `/` não é id de documento do Firestore, e um
 * contador montado com ele mudaria de coleção — tratar como ausente é a única leitura segura.
 */
const parentSegment = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed.includes('/') ? '' : trimmed;
};

/**
 * Os contadores que a CRIAÇÃO de um registro avança. Pura: o instante e o fuso vêm de quem grava,
 * porque é ele quem sabe em que escritório está — e é isso que faz o front e o backend chegarem ao
 * mesmo contador para o mesmo registro.
 */
export const planRecordSequences = (
  fields: readonly RecordSequenceField[],
  record: Record<string, unknown>,
  collection: string,
  at: Date,
  timeZone: string,
): RecordSequencePlan => {
  const year = wallClockInTimeZone(at, timeZone).year;
  const entries: RecordSequenceEntry[] = [];
  const gaps: RecordSequenceGap[] = [];
  for (const field of fields) {
    let parent = '';
    if (field.scope === 'parent') {
      parent = field.parentFieldKey ? parentSegment(record[field.parentFieldKey]) : '';
      if (!parent) {
        gaps.push({ field: field.key, parentField: field.parentFieldKey ?? '' });
        continue;
      }
    }
    const counter: RecordSequenceCounter = {
      collection,
      field: field.key,
      parent,
      period: field.resetBy === 'year' ? String(year) : '',
    };
    entries.push({
      field: field.key,
      counterId: recordSequenceCounterId(counter),
      counter,
      pattern: field.pattern,
      numeric: field.numeric,
      year,
    });
  }
  return { entries, gaps };
};

/** O próximo número, dado o que o contador guarda. Contador ausente ou ilegível começa do zero. */
export const nextRecordSequenceValue = (stored: unknown): number =>
  (typeof stored === 'number' && Number.isInteger(stored) && stored > 0 ? stored : 0) + 1;

/**
 * O valor gravado no campo. Os zeros são LARGURA MÍNIMA, nunca máxima: `000` com o número 1234 sai
 * `1234`. Cortar produziria o mesmo valor para 1234 e 2234 — exatamente a repetição que a sequência
 * existe para impedir.
 *
 * Só a PRIMEIRA sequência de zeros é o número; a autoria recusa um padrão com duas, e aqui a segunda
 * fica literal em vez de virar outra cópia do número. Um padrão sem zeros põe o número no fim.
 */
export const formatRecordSequenceValue = (entry: RecordSequenceEntry, value: number): string | number => {
  if (entry.numeric) return value;
  if (!entry.pattern) return String(value);
  let placed = false;
  const text = entry.pattern
    .split(PATTERN_TOKENS)
    .map((part) => {
      if (part === YEAR_TOKEN) return String(entry.year);
      if (!placed && ZEROS.test(part)) {
        placed = true;
        return String(value).padStart(part.length, '0');
      }
      return part;
    })
    .join('');
  return placed ? text : `${text}${value}`;
};

/** O documento do contador depois de avançar. `updatedAt` é de quem grava — cada lado tem o seu relógio. */
export const recordSequenceCounterData = (
  entry: RecordSequenceEntry,
  value: number,
): RecordSequenceCounter & { value: number } => ({ ...entry.counter, value });

/**
 * O payload sem os campos sequenciais. É a imutabilidade nos caminhos de gravação: o número só é
 * escrito por quem o atribui, e uma alteração qualquer — inclusive a que reenvia o registro inteiro,
 * como o formulário faz — nunca o toca.
 */
export const omitSequenceFields = <T extends Record<string, unknown>>(
  data: T,
  fields: readonly { key: string }[],
): T => {
  if (fields.length === 0) return data;
  const next: Record<string, unknown> = { ...data };
  for (const field of fields) delete next[field.key];
  return next as T;
};

// ─── Validação de autoria ─────────────────────────────────────────────────────

export type RecordSequenceIssueCode =
  | 'shape'
  | 'scope'
  | 'reset'
  | 'nested'
  | 'field-type'
  | 'pattern-slot'
  | 'pattern-numeric'
  | 'pattern-year'
  | 'scope-needs-parent';

export interface RecordSequenceIssue {
  code: RecordSequenceIssueCode;
  field: string;
}

const SEQUENCE_FIELD_TYPES: ReadonlySet<string> = new Set(['text', 'number']);

const countNumberSlots = (pattern: string): number =>
  pattern.split(PATTERN_TOKENS).filter((part) => ZEROS.test(part)).length;

/**
 * O que reprova uma sequência ANTES de ela existir. Cada recusa aqui é uma forma de o número sair
 * REPETIDO ou ilegível, e por isso ela é dura: o ano que recomeça sem `YYYY` no padrão produz
 * `000001` em 2026 e de novo em 2027; o campo `number` que recomeça por ano, idem; e dois lugares
 * para o número no padrão deixam ambíguo qual deles conta.
 */
export const recordSequenceIssues = (
  fields: readonly { key: string; type?: string; autoValue?: unknown }[],
  ctx: { hasParent: boolean },
): RecordSequenceIssue[] => {
  const issues: RecordSequenceIssue[] = [];
  for (const field of fields) {
    const autoValue = field.autoValue as { pattern?: unknown; sequence?: unknown } | null | undefined;
    if (!autoValue || typeof autoValue !== 'object' || autoValue.sequence === undefined || autoValue.sequence === null) {
      continue;
    }
    const raw = autoValue.sequence;
    if (typeof raw !== 'object' || Array.isArray(raw)) {
      issues.push({ code: 'shape', field: field.key });
      continue;
    }
    const sequence = raw as { scope?: unknown; resetBy?: unknown };
    if (sequence.scope !== undefined && !(RECORD_SEQUENCE_SCOPES as readonly unknown[]).includes(sequence.scope)) {
      issues.push({ code: 'scope', field: field.key });
    }
    if (sequence.resetBy !== undefined && !(RECORD_SEQUENCE_RESETS as readonly unknown[]).includes(sequence.resetBy)) {
      issues.push({ code: 'reset', field: field.key });
    }
    if (field.key.includes('.')) issues.push({ code: 'nested', field: field.key });
    if (!SEQUENCE_FIELD_TYPES.has(field.type ?? '')) {
      issues.push({ code: 'field-type', field: field.key });
      continue;
    }
    const pattern = typeof autoValue.pattern === 'string' ? autoValue.pattern.trim() : '';
    const resetsYearly = sequence.resetBy === 'year';
    if (field.type === 'number') {
      if (pattern) issues.push({ code: 'pattern-numeric', field: field.key });
      if (resetsYearly) issues.push({ code: 'pattern-year', field: field.key });
    } else {
      if (pattern && countNumberSlots(pattern) !== 1) issues.push({ code: 'pattern-slot', field: field.key });
      if (resetsYearly && !pattern.includes(YEAR_TOKEN)) issues.push({ code: 'pattern-year', field: field.key });
    }
    if (sequence.scope === 'parent' && !ctx.hasParent) {
      issues.push({ code: 'scope-needs-parent', field: field.key });
    }
  }
  return issues;
};
