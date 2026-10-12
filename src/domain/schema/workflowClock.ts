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
  year: number;
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
    year: 'numeric',
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
    year: Number(part('year')),
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

// ─── Quando uma data chega — `<coleção>.dateReached` ─────────────────────────────

/**
 * O gatilho de DATA: a automação roda para cada registro cuja data (`field`) chega, deslocada de
 * `offset` dias — `-3d` três dias antes, `0d` no dia, `+1d` no dia seguinte —, na hora `at` do fuso do
 * escritório. Uma vez por registro e por valor da data: se a data muda, ela dispara de novo para a nova.
 */
export const DATE_REACHED_ACTION = 'dateReached';

/** O kernel a partir do qual o gatilho de data existe. */
export const WORKFLOW_DATE_REACHED_SINCE_KERNEL = '2.33.0';

/** A hora do dia em que o gatilho de data olha, quando a declaração não diz. Cedo, para o aviso chegar antes do expediente. */
export const DEFAULT_DATE_REACHED_AT = '08:00';

/** O maior deslocamento aceito, em dias, para os dois lados. */
export const MAX_DATE_REACHED_OFFSET_DAYS = 365;

/**
 * Quantos dias para trás o relógio recupera quando ficou parado. Além disso, o aviso já perdeu o
 * sentido — e a recuperação sem teto, depois de uma pane longa, seria uma enxurrada de execuções.
 */
export const DATE_REACHED_CATCH_UP_DAYS = 7;

/** Por quanto tempo a marca "já disparou" é guardada. Passado isso, ninguém volta a olhar aquele dia. */
export const DATE_REACHED_MARK_TTL_DAYS = 400;

/** As marcas de "já disparou" do gatilho de data — coleção do kernel, que o cliente não lê nem escreve. */
export const WORKFLOW_TRIGGER_MARKS_COLLECTION = 'workflow_trigger_marks';

export interface WorkflowDateReached {
  /** O campo de data do registro (`dueDate`). */
  field: string;
  /** Deslocamento em dias: `-3d`, `0d`, `+1d`. */
  offset: string;
  /** `HH:mm` no fuso do escritório. Ausente, `DEFAULT_DATE_REACHED_AT`. */
  at?: string;
}

export const dateReachedEventName = (prefix: string): string => `${prefix}.${DATE_REACHED_ACTION}`;

/** O prefixo de um `<prefixo>.dateReached`, ou `null` quando o nome não é desse gatilho. */
export const dateReachedPrefix = (eventName: string): string | null => {
  const suffix = `.${DATE_REACHED_ACTION}`;
  return eventName.endsWith(suffix) && eventName.length > suffix.length ? eventName.slice(0, -suffix.length) : null;
};

const OFFSET_PATTERN = /^([+-]?)(\d{1,3})d$/;

/** `-3d` → -3. `null` quando a forma não é essa ou passa do teto. */
export const parseOffsetDays = (offset: unknown): number | null => {
  if (typeof offset !== 'string') return null;
  const match = OFFSET_PATTERN.exec(offset.trim());
  if (!match) return null;
  const days = Number(match[2]) * (match[1] === '-' ? -1 : 1);
  return Math.abs(days) <= MAX_DATE_REACHED_OFFSET_DAYS ? days : null;
};

const TIME_OF_DAY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface TimeOfDay {
  hour: number;
  minute: number;
}

export const parseTimeOfDay = (value: unknown): TimeOfDay | null => {
  if (typeof value !== 'string') return null;
  const match = TIME_OF_DAY_PATTERN.exec(value.trim());
  return match ? { hour: Number(match[1]), minute: Number(match[2]) } : null;
};

/** A hora em que o gatilho olha, como cron — e é o mesmo cálculo de próxima ocorrência do `schedule`. */
export const dateReachedCron = (spec: Pick<WorkflowDateReached, 'at'>): string => {
  const time = parseTimeOfDay(spec.at ?? DEFAULT_DATE_REACHED_AT) ?? parseTimeOfDay(DEFAULT_DATE_REACHED_AT) as TimeOfDay;
  return `${time.minute} ${time.hour} * * *`;
};

export type DateReachedIssueCode = 'field-missing' | 'field-not-date' | 'offset-invalid' | 'at-invalid';

export interface DateReachedIssue {
  code: DateReachedIssueCode;
  message: string;
  messageParams?: Record<string, string>;
}

/**
 * O que está errado num `dateReached` declarado. `dateFields`, quando quem pergunta conhece a tela,
 * são os campos de DATA dela — e um campo fora da lista é recusado: o gatilho sobre um texto nunca
 * acha registro nenhum, e ninguém saberia por quê.
 */
export const dateReachedIssues = (spec: unknown, dateFields?: readonly string[] | null): DateReachedIssue[] => {
  const declared = spec && typeof spec === 'object' ? (spec as Partial<WorkflowDateReached>) : null;
  const issues: DateReachedIssue[] = [];
  const field = typeof declared?.field === 'string' ? declared.field.trim() : '';
  if (!field) {
    issues.push({ code: 'field-missing', message: '@core.automation/date-reached.field-missing' });
  } else if (dateFields && !dateFields.includes(field)) {
    issues.push({ code: 'field-not-date', message: '@core.automation/date-reached.field-not-date', messageParams: { field } });
  }
  if (parseOffsetDays(declared?.offset) === null) {
    issues.push({
      code: 'offset-invalid',
      message: '@core.automation/date-reached.offset-invalid',
      messageParams: { offset: String(declared?.offset ?? ''), max: String(MAX_DATE_REACHED_OFFSET_DAYS) },
    });
  }
  if (declared?.at !== undefined && declared.at !== '' && !parseTimeOfDay(declared.at)) {
    issues.push({ code: 'at-invalid', message: '@core.automation/date-reached.at-invalid', messageParams: { at: String(declared.at) } });
  }
  return issues;
};

const DAY_MS = 86_400_000;

/** `YYYY-MM-DD` + n dias, no calendário — sem fuso, porque um dia não tem fuso. */
export const addDays = (day: string, days: number): string =>
  new Date(Date.parse(`${day}T00:00:00Z`) + days * DAY_MS).toISOString().slice(0, 10);

/** O dia da DATA do registro em que a automação dispara: `-3d` sobre 20/10 é 17/10. */
export const dateReachedFireDay = (recordDay: string, offsetDays: number): string => addDays(recordDay, offsetDays);

/** O dia de DATA que dispara HOJE: com `-3d`, hoje (17/10) dispara os registros de 20/10. */
export const dateReachedTargetDay = (today: string, offsetDays: number): string => addDays(today, -offsetDays);

/**
 * O instante em que o relógio de parede do fuso marca `hour:minute` do dia dado. É a meia-noite que
 * delimita a consulta por dia, e a hora `at` que decide se o gatilho já olhou hoje.
 */
export const zonedInstant = (day: string, time: TimeOfDay, timeZone: string): Date => {
  const zone = isValidTimeZone(timeZone) ? timeZone.trim() : 'UTC';
  const [year, month, date] = day.split('-').map(Number);
  const wall = Date.UTC(year, month - 1, date, time.hour, time.minute);
  const offsetAt = (instant: number): number => {
    const clock = wallClockAt(new Date(instant), zone);
    return Date.UTC(clock.year, clock.month - 1, clock.day, clock.hour, clock.minute) - instant;
  };
  const first = wall - offsetAt(wall);
  return new Date(wall - offsetAt(first));
};

// ─── Esperar — o passo `delay` ──────────────────────────────────────────────────

/** O kernel a partir do qual o passo `delay` existe. */
export const WORKFLOW_DELAY_SINCE_KERNEL = '2.34.0';

/** A espera mais longa que um passo pode pedir. Além disso, a automação já não é a mesma que alguém escreveu. */
export const MAX_DELAY_DAYS = 365;

/**
 * Onde a execução que espera guarda o que precisa para continuar: no MESMO relógio, como entrada de
 * `workflow_clock` com este prefixo — o id da definição é de outra natureza, e as duas não podem colidir.
 */
export const RESUME_CLOCK_ID_PREFIX = 'resume_';

const DURATION_PATTERN = /^(\d{1,4})\s*([mhd])$/;

const DURATION_UNIT_MS: Record<string, number> = { m: 60_000, h: 3_600_000, d: 86_400_000 };

/** `30m`, `4h`, `2d` → milissegundos. `null` quando a forma não é essa, é zero ou passa do teto. */
export const parseDelayDuration = (value: unknown): number | null => {
  if (typeof value !== 'string') return null;
  const match = DURATION_PATTERN.exec(value.trim().toLowerCase());
  if (!match) return null;
  const ms = Number(match[1]) * DURATION_UNIT_MS[match[2]];
  return ms > 0 && ms <= MAX_DELAY_DAYS * DURATION_UNIT_MS.d ? ms : null;
};

export type DelayResolution =
  | { resumeAt: Date }
  | { message: string; messageParams?: Record<string, string> };

const toInstant = (value: unknown): Date | null => {
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (typeof value === 'string' || typeof value === 'number') {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
};

const isBlank = (value: unknown): boolean => value === undefined || value === null || value === '';

/**
 * ATÉ QUANDO o passo `delay` espera: `duration` (`30m`, `4h`, `2d`) a partir de agora, OU `until` (um
 * instante). Os dois juntos são ambíguos e recusados; nenhum dos dois também. Um `until` que já passou
 * devolve o próprio instante — quem chama segue sem esperar.
 */
export const resolveDelay = (inputs: { duration?: unknown; until?: unknown }, now: Date): DelayResolution => {
  const hasDuration = !isBlank(inputs.duration);
  const hasUntil = !isBlank(inputs.until);
  if (hasDuration === hasUntil) return { message: '@core.automation/step.delay.one-of' };

  const limit = now.getTime() + MAX_DELAY_DAYS * 86_400_000;
  if (hasDuration) {
    const ms = parseDelayDuration(inputs.duration);
    return ms === null
      ? { message: '@core.automation/step.delay.duration-invalid', messageParams: { duration: String(inputs.duration), max: String(MAX_DELAY_DAYS) } }
      : { resumeAt: new Date(now.getTime() + ms) };
  }

  const until = toInstant(inputs.until);
  if (!until) return { message: '@core.automation/step.delay.until-invalid', messageParams: { until: String(inputs.until) } };
  if (until.getTime() > limit) {
    return { message: '@core.automation/step.delay.too-far', messageParams: { max: String(MAX_DELAY_DAYS) } };
  }
  return { resumeAt: until };
};
