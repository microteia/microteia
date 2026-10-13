// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/time/businessDays.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { dayInTimeZone } from '../i18n/timeZone';

/**
 * DIAS ÚTEIS — a conta, sem saber o que cada dia significa.
 *
 * Um CALENDÁRIO é um documento: os dias da semana que nunca são úteis e, por ANO, a lista dos dias
 * que também não são. "Feriado", "recesso", "ponto facultativo" são palavras de quem marcou o dia; o
 * kernel só enxerga "não útil". A coleção onde os calendários moram é declarada por uma extensão no
 * ponto `time.business.calendar` — o kernel não escreve o nome dela em lugar nenhum.
 *
 * Uma conta recebe UM OU MAIS calendários e usa a UNIÃO deles: um dia é não útil se qualquer um diz
 * que é. É o que permite ao escritório manter "nacional", "estadual" e "do tribunal" separados e
 * combiná-los por registro, sem que a plataforma conheça a hierarquia entre eles.
 *
 * As contas são PURAS e SÍNCRONAS — o avaliador de expressões não espera I/O. Quem avalia já traz os
 * calendários carregados (`BusinessCalendarSet`), pelo contexto ou pelo gate de `businessDaysGate.ts`.
 *
 * E nunca respondem por omissão. Calendário que não existe, ano que não foi cadastrado, extensão que
 * não está instalada: tudo isso é ERRO NOMEADO (`BusinessDaysError`). Devolver a data como se não
 * houvesse dia não útil é a falha que um prazo não pode ter — ela não tem sintoma.
 */

/** O documento de um calendário, como a coleção declarada o guarda. */
export interface BusinessCalendar {
  /** O id do documento. */
  id: string;
  /** O identificador legível que uma fórmula cita (`"national"`), quando o calendário tem um. */
  key?: string;
  /** O nome que o escritório deu — só para a mensagem de erro dizer de qual calendário se trata. */
  name?: string;
  /** Dias da semana nunca úteis: 0 = domingo … 6 = sábado. */
  weekend: number[];
  /** Ano (`"2026"`) → dias não úteis daquele ano (`YYYY-MM-DD`). Ano ausente = ano NÃO cadastrado. */
  years: Record<string, string[]>;
}

/** Os campos do documento que a conta lê. São o contrato do ponto `time.business.calendar`. */
export const BUSINESS_CALENDAR_FIELDS = {
  key: 'key',
  name: 'name',
  weekend: 'weekend',
  years: 'years',
} as const;

/**
 * Os calendários do escritório, já carregados. `ready: false` é "ainda carregando" — distinto de
 * "carregado e vazio", e a conta recusa os dois de jeitos diferentes.
 */
export interface BusinessCalendarSet {
  readonly ready: boolean;
  readonly calendars: readonly BusinessCalendar[];
}

export const BUSINESS_DAYS_ERROR_CODES = [
  'unavailable',
  'loading',
  'no-calendar',
  'not-found',
  'year-missing',
  'invalid-date',
  'invalid-count',
  'too-far',
] as const;
export type BusinessDaysErrorCode = (typeof BUSINESS_DAYS_ERROR_CODES)[number];

/** O catálogo dono das frases de erro — o do núcleo de registros, que é quem mostra a recusa. */
export const BUSINESS_DAYS_MESSAGE_NAMESPACE = 'core.records';

export const businessDaysErrorMessage = (code: BusinessDaysErrorCode): string =>
  `@${BUSINESS_DAYS_MESSAGE_NAMESPACE}/business-days.error.${code}`;

const BUSINESS_DAYS_ERROR_NAME = 'BusinessDaysError';

/**
 * A recusa da conta. A mensagem é a REFERÊNCIA da frase (`@core.records/business-days.error.…`) e
 * `params` traz o que ela interpola — o mesmo par de `RuleIssue.error`/`errorParams`.
 *
 * Reconhecida pelo `name`, e não por `instanceof`: a mesma classe existe em duas cópias (a do app e a
 * gerada em `functions/`), e o erro atravessa a ponte do sandbox como objeto comum.
 */
export class BusinessDaysError extends Error {
  readonly code: BusinessDaysErrorCode;
  readonly params: Record<string, string>;

  constructor(code: BusinessDaysErrorCode, params: Record<string, string> = {}) {
    super(businessDaysErrorMessage(code));
    this.name = BUSINESS_DAYS_ERROR_NAME;
    this.code = code;
    this.params = params;
  }
}

export const isBusinessDaysError = (error: unknown): error is BusinessDaysError =>
  error instanceof Error && error.name === BUSINESS_DAYS_ERROR_NAME;

// ─── Normalização do documento ────────────────────────────────────────────────

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;
const MS_PER_DAY = 86_400_000;

const dayNumberOf = (day: string): number | null => {
  if (!DAY_PATTERN.test(day)) return null;
  const [year, month, date] = day.split('-').map(Number);
  const value = Date.UTC(year, month - 1, date);
  const back = new Date(value);
  if (back.getUTCFullYear() !== year || back.getUTCMonth() !== month - 1 || back.getUTCDate() !== date) return null;
  return value / MS_PER_DAY;
};

const dayTextOf = (dayNumber: number): string => new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);

const weekdayOf = (dayNumber: number): number => new Date(dayNumber * MS_PER_DAY).getUTCDay();

const yearOf = (dayNumber: number): string => dayTextOf(dayNumber).slice(0, 4);

const textOf = (value: unknown): string | undefined =>
  typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;

/**
 * O documento como chegou → o calendário que a conta usa. Entrada malformada é DESCARTADA item a
 * item (um dia do ano errado, um dia da semana fora de 0–6), nunca o documento inteiro: um calendário
 * com um dia digitado errado continua valendo para os outros dias.
 */
export const businessCalendarOf = (id: string, data: Record<string, unknown>): BusinessCalendar => {
  const weekendRaw = data[BUSINESS_CALENDAR_FIELDS.weekend];
  const weekend = Array.isArray(weekendRaw)
    ? [...new Set(weekendRaw.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6))].sort()
    : [];

  const years: Record<string, string[]> = {};
  const yearsRaw = data[BUSINESS_CALENDAR_FIELDS.years];
  if (yearsRaw && typeof yearsRaw === 'object' && !Array.isArray(yearsRaw)) {
    for (const [year, days] of Object.entries(yearsRaw as Record<string, unknown>)) {
      if (!YEAR_PATTERN.test(year)) continue;
      const list = Array.isArray(days) ? days : [];
      years[year] = [
        ...new Set(
          list.filter(
            (day): day is string => typeof day === 'string' && day.startsWith(`${year}-`) && dayNumberOf(day) !== null,
          ),
        ),
      ].sort();
    }
  }

  return {
    id,
    key: textOf(data[BUSINESS_CALENDAR_FIELDS.key]),
    name: textOf(data[BUSINESS_CALENDAR_FIELDS.name]),
    weekend,
    years,
  };
};

export const createBusinessCalendarSet = (
  calendars: readonly BusinessCalendar[],
  ready = true,
): BusinessCalendarSet => ({ ready, calendars });

// ─── A união dos calendários pedidos ──────────────────────────────────────────

interface MergedCalendar {
  calendars: BusinessCalendar[];
  weekend: Set<number>;
  offDays: Set<number>;
}

const labelOf = (calendar: BusinessCalendar): string => calendar.name ?? calendar.key ?? calendar.id;

/**
 * O que a fórmula passou como calendário → os identificadores. Aceita um texto, uma lista de textos e
 * — nos slots em que a referência já vem hidratada — o registro (`{ id }`) ou uma lista deles. É o
 * que deixa um campo de referência múltipla ser passado direto: `addBusinessDays(d, 15, calendars)`.
 */
const referencesOf = (value: unknown): string[] => {
  const one = (item: unknown): string | undefined => {
    if (typeof item === 'string') return textOf(item);
    if (item && typeof item === 'object') return textOf((item as { id?: unknown }).id);
    return undefined;
  };
  const list = Array.isArray(value) ? value.map(one) : [one(value)];
  return [...new Set(list.filter((item): item is string => item !== undefined))];
};

/**
 * A união é guardada por conjunto carregado e pela lista pedida: uma lista de 500 registros chama a
 * mesma conta 500 vezes com os mesmos calendários. `WeakMap` porque um conjunto novo (o escritório
 * marcou um dia) substitui o objeto inteiro, e o velho vai embora com o cache dele.
 */
const mergedCache = new WeakMap<BusinessCalendarSet, Map<string, MergedCalendar>>();

const findCalendar = (set: BusinessCalendarSet, reference: string): BusinessCalendar | undefined =>
  set.calendars.find((calendar) => calendar.id === reference) ??
  set.calendars.find((calendar) => calendar.key === reference);

const mergedCalendarOf = (set: BusinessCalendarSet | null, reference: unknown): MergedCalendar => {
  if (!set) throw new BusinessDaysError('unavailable');
  if (!set.ready) throw new BusinessDaysError('loading');

  const references = referencesOf(reference);
  if (references.length === 0) throw new BusinessDaysError('no-calendar');

  const cacheKey = references.join('\u0000');
  let bySet = mergedCache.get(set);
  const cached = bySet?.get(cacheKey);
  if (cached) return cached;

  const calendars: BusinessCalendar[] = [];
  for (const item of references) {
    const calendar = findCalendar(set, item);
    if (!calendar) throw new BusinessDaysError('not-found', { calendar: item });
    if (!calendars.includes(calendar)) calendars.push(calendar);
  }

  const weekend = new Set<number>();
  const offDays = new Set<number>();
  for (const calendar of calendars) {
    for (const day of calendar.weekend) weekend.add(day);
    for (const days of Object.values(calendar.years)) {
      for (const day of days) {
        const number = dayNumberOf(day);
        if (number !== null) offDays.add(number);
      }
    }
  }

  const merged: MergedCalendar = { calendars, weekend, offDays };
  if (!bySet) {
    bySet = new Map();
    mergedCache.set(set, bySet);
  }
  bySet.set(cacheKey, merged);
  return merged;
};

/**
 * Um dia é útil quando não cai num dia da semana não útil de NENHUM calendário e não está marcado em
 * NENHUM deles. Antes disso, o ano precisa existir em TODOS: um ano não cadastrado não é "ano sem
 * feriados", é ano que ninguém conferiu.
 */
const isBusinessDayNumber = (merged: MergedCalendar, dayNumber: number): boolean => {
  const year = yearOf(dayNumber);
  for (const calendar of merged.calendars) {
    if (!calendar.years[year]) {
      throw new BusinessDaysError('year-missing', { calendar: labelOf(calendar), year });
    }
  }
  return !merged.weekend.has(weekdayOf(dayNumber)) && !merged.offDays.has(dayNumber);
};

// ─── As contas ────────────────────────────────────────────────────────────────

/**
 * Quantos dias a busca por um dia útil percorre antes de desistir — dez anos. Um conjunto que marca
 * tudo como não útil (um período digitado errado) faria a conta girar para sempre; aqui ela recusa.
 */
export const BUSINESS_DAYS_MAX_SCAN = 3660;

const isTimestampLike = (value: unknown): value is { toDate: () => Date } =>
  !!value && typeof value === 'object' && typeof (value as { toDate?: unknown }).toDate === 'function';

/**
 * Qualquer forma de data → o DIA, no fuso do escritório. Texto de dia (`YYYY-MM-DD`, o que um campo de
 * data guarda e o que `today()` devolve) é o próprio dia; um instante é o dia em que ele cai no fuso —
 * o mesmo raciocínio de `today()`. A data gravada ao meio-dia UTC cai no mesmo dia em qualquer fuso.
 */
const dayNumberFrom = (value: unknown, timeZone: string): number => {
  const fail = (): never => {
    throw new BusinessDaysError('invalid-date', { value: String(value ?? '') });
  };
  if (typeof value === 'string' && DAY_PATTERN.test(value.trim())) {
    return dayNumberOf(value.trim()) ?? fail();
  }
  let instant: Date | null = null;
  if (value instanceof Date) instant = value;
  else if (isTimestampLike(value)) instant = value.toDate();
  else if (typeof value === 'number' && Number.isFinite(value)) instant = new Date(value);
  else if (typeof value === 'string' && value.trim() !== '') instant = new Date(value.trim());
  if (!instant || Number.isNaN(instant.getTime())) return fail();
  return dayNumberOf(dayInTimeZone(instant, timeZone)) ?? fail();
};

const countFrom = (value: unknown): number => {
  const count = typeof value === 'number' ? value : typeof value === 'string' && value.trim() !== '' ? Number(value) : NaN;
  if (!Number.isInteger(count)) throw new BusinessDaysError('invalid-count', { value: String(value ?? '') });
  return count;
};

const tooFar = (): never => {
  throw new BusinessDaysError('too-far', { limit: String(BUSINESS_DAYS_MAX_SCAN) });
};

/** O que cada conta precisa além dos argumentos da fórmula. */
export interface BusinessDaysEnvironment {
  calendars: BusinessCalendarSet | null;
  timeZone: string;
}

export const isBusinessDay = (env: BusinessDaysEnvironment, date: unknown, calendars: unknown): boolean => {
  const merged = mergedCalendarOf(env.calendars, calendars);
  return isBusinessDayNumber(merged, dayNumberFrom(date, env.timeZone));
};

/**
 * O N-ÉSIMO dia útil DEPOIS da data (antes, se `count` é negativo). O dia inicial nunca conta, seja ele
 * útil ou não — é "a partir do dia seguinte", que é como se conta prazo em qualquer domínio. `0`
 * devolve a própria data, sem mover: quem quer o útil mais próximo usa `nextBusinessDay`.
 */
export const addBusinessDays = (
  env: BusinessDaysEnvironment,
  date: unknown,
  count: unknown,
  calendars: unknown,
): string => {
  const merged = mergedCalendarOf(env.calendars, calendars);
  const start = dayNumberFrom(date, env.timeZone);
  const amount = countFrom(count);
  const step = amount < 0 ? -1 : 1;
  let remaining = Math.abs(amount);
  let current = start;
  while (remaining > 0) {
    current += step;
    if (Math.abs(current - start) > BUSINESS_DAYS_MAX_SCAN) tooFar();
    if (isBusinessDayNumber(merged, current)) remaining -= 1;
  }
  return dayTextOf(current);
};

/**
 * Quantos dias úteis há de `from` até `to`: os de `(from, to]` quando `to` vem depois, e o negativo
 * dos de `[to, from)` quando vem antes. A assimetria é o que fecha a conta com a anterior —
 * `businessDaysBetween(d, addBusinessDays(d, n)) == n` para todo `n`, positivo ou negativo.
 */
export const businessDaysBetween = (
  env: BusinessDaysEnvironment,
  from: unknown,
  to: unknown,
  calendars: unknown,
): number => {
  const merged = mergedCalendarOf(env.calendars, calendars);
  const start = dayNumberFrom(from, env.timeZone);
  const end = dayNumberFrom(to, env.timeZone);
  if (Math.abs(end - start) > BUSINESS_DAYS_MAX_SCAN) tooFar();
  let count = 0;
  if (end >= start) {
    for (let day = start + 1; day <= end; day += 1) if (isBusinessDayNumber(merged, day)) count += 1;
    return count;
  }
  for (let day = end; day < start; day += 1) if (isBusinessDayNumber(merged, day)) count += 1;
  return -count;
};

/**
 * A própria data, se ela for útil; senão, o primeiro dia útil depois dela. É o "prorroga para o
 * próximo útil" de um prazo contado em dias corridos: `nextBusinessDay(addDays(d, 15), calendars)`.
 */
export const nextBusinessDay = (env: BusinessDaysEnvironment, date: unknown, calendars: unknown): string => {
  const merged = mergedCalendarOf(env.calendars, calendars);
  const start = dayNumberFrom(date, env.timeZone);
  let current = start;
  while (!isBusinessDayNumber(merged, current)) {
    current += 1;
    if (current - start > BUSINESS_DAYS_MAX_SCAN) tooFar();
  }
  return dayTextOf(current);
};

/** Os nomes, como as fórmulas os chamam. Fonte única para os dois catálogos e para quem precisa saber se uma expressão os cita. */
export const BUSINESS_DAYS_FUNCTION_NAMES = [
  'addBusinessDays',
  'businessDaysBetween',
  'isBusinessDay',
  'nextBusinessDay',
] as const;

const MENTION_PATTERN = new RegExp(`\\b(?:${BUSINESS_DAYS_FUNCTION_NAMES.join('|')})\\s*\\(`);

/**
 * A expressão (ou qualquer declaração serializada) chama alguma das contas? É o que deixa o servidor
 * carregar os calendários SÓ para a avaliação que precisa deles — e não a cada gravação do escritório.
 */
export const mentionsBusinessDays = (text: string | null | undefined): boolean =>
  typeof text === 'string' && MENTION_PATTERN.test(text);
