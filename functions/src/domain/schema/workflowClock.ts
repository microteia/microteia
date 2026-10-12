// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/workflowClock.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/workflowClock.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { isValidTimeZone } from './i18n/timeZone';

/**
 * O GATILHO POR HORÁRIO de uma automação — `eventName: 'schedule'` com `schedule: { cron }`.
 *
 * Mora no schema compartilhado porque três pontas fazem a MESMA pergunta: o editor mostra as próximas
 * execuções, o `check`/`validate_plugin` recusa a expressão inválida, e o backend calcula quando o
 * relógio do kernel acorda a automação. Duas implementações de cron discordariam justamente no caso
 * que ninguém testa à mão — fuso, virada de mês, dia da semana junto com dia do mês.
 */
export const WORKFLOW_SCHEDULE_EVENT = 'schedule';

/** O kernel a partir do qual o relógio existe. Num kernel anterior a automação instala e nunca dispara. */
export const WORKFLOW_SCHEDULE_SINCE_KERNEL = '2.32.0';

/**
 * Onde o kernel guarda o estado do relógio de cada automação temporal (`tenants/{t}/workflow_clock/{id}`).
 * É coleção do KERNEL: a definição é gravada pelo navegador, e o próximo disparo não pode ser um número
 * que o navegador escreveu.
 */
export const WORKFLOW_CLOCK_COLLECTION = 'workflow_clock';

/** De quanto em quanto tempo o relógio do kernel acorda. É a precisão de qualquer gatilho temporal. */
export const WORKFLOW_CLOCK_TICK_MINUTES = 5;

/**
 * O menor intervalo entre dois disparos que uma expressão pode pedir. Abaixo disso o gatilho deixa de
 * ser "um horário" e vira laço — e cada volta é uma execução gravada, em todo escritório que instalou.
 */
export const MIN_SCHEDULE_INTERVAL_MINUTES = 15;

export interface WorkflowSchedule {
  /** Cron de cinco campos (`minuto hora dia mês dia-da-semana`), ou `@daily`/`@hourly`/`@weekly`/`@monthly`. */
  cron: string;
  /**
   * Fuso IANA que SOBRESCREVE o do escritório. Quase nunca é o que se quer: uma extensão viaja para
   * escritórios em fusos diferentes, e "às 8h" quer dizer às 8h de cada um deles.
   */
  timeZone?: string;
}

export interface ParsedCron {
  minutes: ReadonlySet<number>;
  hours: ReadonlySet<number>;
  daysOfMonth: ReadonlySet<number>;
  months: ReadonlySet<number>;
  daysOfWeek: ReadonlySet<number>;
  /** Restringido = não é `*`. Com os dois restringidos, vale o dia que satisfizer QUALQUER um (regra do cron). */
  dayOfMonthRestricted: boolean;
  dayOfWeekRestricted: boolean;
}

export type ScheduleIssueCode = 'missing' | 'cron-invalid' | 'too-frequent' | 'time-zone-invalid';

export interface ScheduleIssue {
  code: ScheduleIssueCode;
  /** Mensagem de catálogo (`@core.automation/…`). */
  message: string;
  messageParams?: Record<string, string>;
}

const MACROS: Record<string, string> = {
  '@hourly': '0 * * * *',
  '@daily': '0 0 * * *',
  '@midnight': '0 0 * * *',
  '@weekly': '0 0 * * 0',
  '@monthly': '0 0 1 * *',
  '@yearly': '0 0 1 1 *',
  '@annually': '0 0 1 1 *',
};

const MONTH_NAMES = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKDAY_NAMES = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

interface FieldSpec {
  min: number;
  max: number;
  names?: string[];
  namesFrom?: number;
}

const FIELDS: FieldSpec[] = [
  { min: 0, max: 59 },
  { min: 0, max: 23 },
  { min: 1, max: 31 },
  { min: 1, max: 12, names: MONTH_NAMES, namesFrom: 1 },
  { min: 0, max: 7, names: WEEKDAY_NAMES, namesFrom: 0 },
];

const parseValue = (raw: string, spec: FieldSpec): number | null => {
  const upper = raw.toUpperCase();
  const named = spec.names?.indexOf(upper) ?? -1;
  if (named >= 0) return named + (spec.namesFrom ?? 0);
  if (!/^\d+$/.test(raw)) return null;
  const value = Number(raw);
  return value >= spec.min && value <= spec.max ? value : null;
};

const parseField = (raw: string, spec: FieldSpec): Set<number> | null => {
  const values = new Set<number>();
  for (const part of raw.split(',')) {
    const [rangePart, stepPart, ...extra] = part.split('/');
    if (extra.length > 0 || rangePart === '') return null;
    const step = stepPart === undefined ? 1 : /^\d+$/.test(stepPart) ? Number(stepPart) : 0;
    if (step < 1) return null;

    let from: number;
    let to: number;
    if (rangePart === '*') {
      from = spec.min;
      to = spec.max;
    } else {
      const bounds = rangePart.split('-');
      if (bounds.length > 2) return null;
      const start = parseValue(bounds[0], spec);
      const end = bounds.length === 2 ? parseValue(bounds[1], spec) : stepPart === undefined ? start : spec.max;
      if (start === null || end === null || end < start) return null;
      from = start;
      to = end;
    }
    for (let value = from; value <= to; value += step) values.add(value);
  }
  return values.size > 0 ? values : null;
};

/** Lê uma expressão cron. `null` quando ela não é válida — a razão não importa a quem chama. */
export const parseCron = (expression: unknown): ParsedCron | null => {
  if (typeof expression !== 'string') return null;
  const trimmed = expression.trim();
  const expanded = MACROS[trimmed.toLowerCase()] ?? trimmed;
  const parts = expanded.split(/\s+/);
  if (parts.length !== 5) return null;

  const sets = parts.map((part, index) => parseField(part, FIELDS[index]));
  if (sets.some((set) => set === null)) return null;
  const [minutes, hours, daysOfMonth, months, rawDaysOfWeek] = sets as Set<number>[];

  const daysOfWeek = new Set([...rawDaysOfWeek].map((day) => (day === 7 ? 0 : day)));
  return {
    minutes,
    hours,
    daysOfMonth,
    months,
    daysOfWeek,
    dayOfMonthRestricted: parts[2] !== '*',
    dayOfWeekRestricted: parts[4] !== '*',
  };
};

interface WallClock {
  month: number;
  day: number;
  weekday: number;
  hour: number;
  minute: number;
}

const wallClockFormatters = new Map<string, Intl.DateTimeFormat>();

const wallClockFormatter = (timeZone: string): Intl.DateTimeFormat => {
  const cached = wallClockFormatters.get(timeZone);
  if (cached) return cached;
  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    month: 'numeric',
    day: 'numeric',
    weekday: 'short',
    hour: 'numeric',
    minute: 'numeric',
  });
  wallClockFormatters.set(timeZone, created);
  return created;
};

const wallClockAt = (instant: Date, timeZone: string): WallClock => {
  const parts = wallClockFormatter(timeZone).formatToParts(instant);
  const part = (type: Intl.DateTimeFormatPartTypes): string => parts.find((entry) => entry.type === type)?.value ?? '';
  return {
    month: Number(part('month')),
    day: Number(part('day')),
    weekday: WEEKDAY_NAMES.indexOf(part('weekday').toUpperCase().slice(0, 3)),
    hour: Number(part('hour')),
    minute: Number(part('minute')),
  };
};

const dayMatches = (cron: ParsedCron, clock: WallClock): boolean => {
  const byMonthDay = cron.daysOfMonth.has(clock.day);
  const byWeekday = cron.daysOfWeek.has(clock.weekday);
  if (cron.dayOfMonthRestricted && cron.dayOfWeekRestricted) return byMonthDay || byWeekday;
  if (cron.dayOfMonthRestricted) return byMonthDay;
  if (cron.dayOfWeekRestricted) return byWeekday;
  return true;
};

const MINUTE_MS = 60_000;

/** Quantos minutos andar até o próximo valor permitido do conjunto, ou até `wrap` quando não há mais nenhum. */
const minutesToNext = (allowed: ReadonlySet<number>, current: number, wrap: number): number => {
  for (let value = current + 1; value < wrap; value += 1) {
    if (allowed.has(value)) return value - current;
  }
  return wrap - current;
};

/**
 * Teto de passos da busca. Cada passo salta um mês, um dia, uma hora ou até o próximo minuto válido, e
 * a expressão mais rara que se escreve (29 de fevereiro numa segunda-feira) cabe com folga. Sem teto,
 * uma expressão que nunca casa (31 de fevereiro) giraria para sempre.
 */
const MAX_SEARCH_STEPS = 20_000;

/**
 * O primeiro instante ESTRITAMENTE posterior a `after` em que a expressão casa no fuso dado — ou `null`
 * quando ela nunca casa. A comparação é feita no RELÓGIO DE PAREDE do fuso, e por isso "8h" é 8h no
 * horário de verão e fora dele; uma hora que não existe no dia em que o relógio adianta simplesmente
 * não acontece.
 */
export const nextCronOccurrence = (cron: ParsedCron, after: Date, timeZone: string): Date | null => {
  const zone = isValidTimeZone(timeZone) ? timeZone.trim() : 'UTC';
  let cursor = Math.floor(after.getTime() / MINUTE_MS) * MINUTE_MS + MINUTE_MS;

  for (let step = 0; step < MAX_SEARCH_STEPS; step += 1) {
    const clock = wallClockAt(new Date(cursor), zone);
    const minutesLeftInHour = 60 - clock.minute;
    const minutesLeftInDay = (23 - clock.hour) * 60 + minutesLeftInHour;

    if (!cron.months.has(clock.month) || !dayMatches(cron, clock)) {
      cursor += minutesLeftInDay * MINUTE_MS;
      continue;
    }
    if (!cron.hours.has(clock.hour)) {
      cursor += minutesLeftInHour * MINUTE_MS;
      continue;
    }
    if (!cron.minutes.has(clock.minute)) {
      cursor += minutesToNext(cron.minutes, clock.minute, 60) * MINUTE_MS;
      continue;
    }
    return new Date(cursor);
  }
  return null;
};

/** As próximas `count` ocorrências, para o editor mostrar o que a expressão quer dizer. */
export const nextCronOccurrences = (cron: ParsedCron, after: Date, timeZone: string, count: number): Date[] => {
  const result: Date[] = [];
  let cursor = after;
  while (result.length < count) {
    const next = nextCronOccurrence(cron, cursor, timeZone);
    if (!next) break;
    result.push(next);
    cursor = next;
  }
  return result;
};

/**
 * O menor intervalo, em minutos, entre dois horários do MESMO dia que a expressão permite — e da volta
 * do último horário para o primeiro do dia seguinte. É conservador: trata todo dia como permitido, e por
 * isso nunca deixa passar uma expressão frequente demais por causa do dia em que se fez a conta.
 */
export const minCronIntervalMinutes = (cron: ParsedCron): number => {
  const times: number[] = [];
  for (const hour of [...cron.hours].sort((a, b) => a - b)) {
    for (const minute of [...cron.minutes].sort((a, b) => a - b)) times.push(hour * 60 + minute);
  }
  if (times.length <= 1) return 24 * 60;
  let smallest = times[0] + 24 * 60 - times[times.length - 1];
  for (let index = 1; index < times.length; index += 1) {
    smallest = Math.min(smallest, times[index] - times[index - 1]);
  }
  return smallest;
};

/** Ponto de partida fixo da pergunta "esta expressão casa alguma vez?" — fixo para a resposta não depender do dia. */
const NEVER_FIRES_REFERENCE = new Date(Date.UTC(2026, 0, 1));

/**
 * O que está errado num `schedule` declarado — a MESMA resposta no editor, no `check` e no backend.
 * Uma automação `schedule` sem expressão válida nunca dispara, e dizer isso na hora de salvar é a
 * diferença entre um erro e uma automação que ninguém percebe que está parada.
 */
export const scheduleIssues = (schedule: unknown): ScheduleIssue[] => {
  const declared = schedule && typeof schedule === 'object' ? (schedule as Partial<WorkflowSchedule>) : null;
  if (!declared || typeof declared.cron !== 'string' || declared.cron.trim() === '') {
    return [{ code: 'missing', message: '@core.automation/schedule.missing' }];
  }

  const issues: ScheduleIssue[] = [];
  const parsed = parseCron(declared.cron);
  if (!parsed || !nextCronOccurrence(parsed, NEVER_FIRES_REFERENCE, 'UTC')) {
    issues.push({ code: 'cron-invalid', message: '@core.automation/schedule.cron-invalid', messageParams: { cron: declared.cron } });
  } else if (minCronIntervalMinutes(parsed) < MIN_SCHEDULE_INTERVAL_MINUTES) {
    issues.push({
      code: 'too-frequent',
      message: '@core.automation/schedule.too-frequent',
      messageParams: { cron: declared.cron, minutes: String(MIN_SCHEDULE_INTERVAL_MINUTES) },
    });
  }

  if (declared.timeZone !== undefined && declared.timeZone !== '' && !isValidTimeZone(declared.timeZone)) {
    issues.push({
      code: 'time-zone-invalid',
      message: '@core.automation/schedule.time-zone-invalid',
      messageParams: { timeZone: String(declared.timeZone) },
    });
  }
  return issues;
};

/** O fuso que vale para um `schedule`: o declarado, quando é válido; senão o do escritório. */
export const scheduleTimeZone = (schedule: WorkflowSchedule, officeTimeZone: string): string =>
  schedule.timeZone && isValidTimeZone(schedule.timeZone) ? schedule.timeZone.trim() : officeTimeZone;
