// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportPeriod.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Os períodos NOMEADOS — os que o seletor oferece quando o filtro não declara `periods`.
 *
 * Ao lado deles há a família PARAMETRIZADA (`last-<n>-<unit>`, `previous-<n>-<unit>`), e a fronteira é
 * a mesma: cada token é uma afirmação sobre o CALENDÁRIO que o servidor resolve no fuso do escritório.
 * Um período escrito à mão ("últimos 45 dias úteis") continua sendo expressão — tem lugar em
 * `dataset.includeWhen`, não aqui.
 */
export const REPORT_PERIODS = [
  'today',
  'yesterday',
  'this-week',
  'last-week',
  'this-month',
  'last-month',
  'this-quarter',
  'last-quarter',
  'this-year',
  'last-year',
  'last-7-days',
  'last-30-days',
  'last-90-days',
  'year-to-date',
] as const;

export type ReportPeriod = typeof REPORT_PERIODS[number];

export const isNamedReportPeriod = (value: unknown): value is ReportPeriod =>
  typeof value === 'string' && (REPORT_PERIODS as readonly string[]).includes(value);

/**
 * As unidades da família parametrizada. Dias são JANELA MÓVEL contada de hoje; as demais são períodos
 * de CALENDÁRIO inteiros — semana ISO (segunda), mês, trimestre, ano —, a mesma régua dos baldes de
 * `granularity`: o filtro e o agrupamento não podem discordar sobre onde um mês começa (#4).
 */
export const REPORT_PERIOD_UNITS = ['days', 'weeks', 'months', 'quarters', 'years'] as const;
export type ReportPeriodUnit = typeof REPORT_PERIOD_UNITS[number];

/**
 * `last` termina no período CORRENTE, inclusive (`last-12-months` em novembro: de dezembro do ano
 * passado a novembro); `previous` são os n períodos FECHADOS antes dele. É o par que mantém o nome
 * antigo honesto: `last-month` é o mês anterior e equivale a `previous-1-months`, não a `last-1-months`.
 */
export const REPORT_PERIOD_DIRECTIONS = ['last', 'previous'] as const;
export type ReportPeriodDirection = typeof REPORT_PERIOD_DIRECTIONS[number];

/**
 * O teto de `n` em cada unidade — cerca de vinte anos em todas. Sem teto, `last-99999999-days` viraria
 * uma data que o `Date` não representa, e o relatório rodaria sem recorte do mesmo jeito que o período
 * desconhecido rodava. Vale também para `n × (deslocamento + 1)`: a janela deslocada não escapa dele.
 */
export const REPORT_PERIOD_MAX_COUNT: Readonly<Record<ReportPeriodUnit, number>> = {
  days: 7305,
  weeks: 1044,
  months: 240,
  quarters: 80,
  years: 20,
};

export interface RelativeReportPeriod {
  direction: ReportPeriodDirection;
  count: number;
  unit: ReportPeriodUnit;
  /**
   * Quantas janelas do MESMO tamanho para trás. Só a comparação o usa (`previousReportPeriod`): é o que
   * põe "os 12 meses antes dos últimos 12" ao lado deles. Não é declarável — o seletor não tem nome
   * para ele.
   */
  offset: number;
}

/** Forma canônica: sem zero à esquerda, para que dois tokens do mesmo período sejam o mesmo texto. */
const RELATIVE_PERIOD_PATTERN =
  /^(last|previous)-([1-9]\d{0,4})-(days|weeks|months|quarters|years)(?:-offset-([1-9]\d{0,4}))?$/;

export const parseRelativeReportPeriod = (value: unknown): RelativeReportPeriod | null => {
  if (typeof value !== 'string') return null;
  const match = RELATIVE_PERIOD_PATTERN.exec(value);
  if (!match) return null;
  const unit = match[3] as ReportPeriodUnit;
  const count = Number(match[2]);
  const offset = match[4] === undefined ? 0 : Number(match[4]);
  if (count * (offset + 1) > REPORT_PERIOD_MAX_COUNT[unit]) return null;
  return { direction: match[1] as ReportPeriodDirection, count, unit, offset };
};

export const formatRelativeReportPeriod = (period: RelativeReportPeriod): string =>
  `${period.direction}-${period.count}-${period.unit}${period.offset > 0 ? `-offset-${period.offset}` : ''}`;

/** Todo período que o servidor resolve: nomeado ou parametrizado, deslocado inclusive. */
export const isReportPeriod = (value: unknown): value is string =>
  isNamedReportPeriod(value) || parseRelativeReportPeriod(value) !== null;

/**
 * O período que um AUTOR pode escrever — em `default` ou em `periods`. O deslocado fica de fora: ele
 * existe para a comparação, e um seletor que o oferecesse mostraria uma opção sem nome.
 */
export const isDeclarableReportPeriod = (value: unknown): value is string =>
  isNamedReportPeriod(value) || (parseRelativeReportPeriod(value)?.offset ?? -1) === 0;

/**
 * O controle que pede um PERÍODO em vez de um valor. É o único controle que muda a forma da pergunta
 * — os outros herdam o do campo —, e por isso é o único que este kernel nomeia.
 */
export const REPORT_PROMPT_PERIOD_CONTROL = 'period';

/** Intervalo SEMIABERTO de dias: `from` incluso, `until` excluído — os dois em `AAAA-MM-DD`. */
export interface ReportDayRange {
  from: string;
  until: string;
}

const DAY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;

const toUtcDate = (day: string): Date | null => {
  const match = DAY_PATTERN.exec(day);
  if (!match) return null;
  const date = new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3])));
  return Number.isNaN(date.getTime()) ? null : date;
};

const dayOf = (date: Date): string => date.toISOString().slice(0, 10);

const addDays = (date: Date, days: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate() + days));

const startOfMonth = (year: number, month: number): Date => new Date(Date.UTC(year, month, 1));

const addMonths = (date: Date, months: number): Date =>
  new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, date.getUTCDate()));

/** Recua `amount` unidades. Mês, trimestre e ano só recebem dia 1º, e por isso a conta de mês é segura. */
const back = (date: Date, unit: ReportPeriodUnit, amount: number): Date => {
  switch (unit) {
    case 'days': return addDays(date, -amount);
    case 'weeks': return addDays(date, -7 * amount);
    case 'months': return addMonths(date, -amount);
    case 'quarters': return addMonths(date, -3 * amount);
    case 'years': return addMonths(date, -12 * amount);
  }
};

/** O início do período de calendário (ou do dia) que contém `base`. */
const startOfUnit = (base: Date, unit: ReportPeriodUnit): Date => {
  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  switch (unit) {
    case 'days': return base;
    case 'weeks': return addDays(base, -((base.getUTCDay() + 6) % 7));
    case 'months': return startOfMonth(year, month);
    case 'quarters': return startOfMonth(year, Math.floor(month / 3) * 3);
    case 'years': return startOfMonth(year, 0);
  }
};

/**
 * A janela parametrizada. `last` termina no FIM do período corrente; `previous`, no INÍCIO dele — e a
 * janela tem `count` unidades para trás a partir daí, recuada `offset` janelas inteiras.
 */
const relativeRange = (period: RelativeReportPeriod, base: Date): ReportDayRange => {
  const current = startOfUnit(base, period.unit);
  const end = period.direction === 'last' ? back(current, period.unit, -1) : current;
  const until = back(end, period.unit, period.count * period.offset);
  const from = back(until, period.unit, period.count);
  return { from: dayOf(from), until: dayOf(until) };
};

/**
 * O intervalo de dias que um período designa, contado a partir de `today` — o dia de HOJE no fuso do
 * escritório, que quem chama já resolveu.
 *
 * Recebe o dia, e não um instante, porque a conta de "este mês" é de calendário: no dia 1º às 22h em
 * São Paulo já é dia 2 em UTC, e o mês de quem lê não pode depender do fuso do servidor.
 *
 * A semana começa na SEGUNDA, a mesma régua ISO do balde `week` — o filtro e o agrupamento não podem
 * discordar sobre onde uma semana termina.
 */
export const reportPeriodRange = (period: string, today: string): ReportDayRange | null => {
  const base = toUtcDate(today);
  if (!base) return null;
  const relative = parseRelativeReportPeriod(period);
  if (relative) return relativeRange(relative, base);

  const year = base.getUTCFullYear();
  const month = base.getUTCMonth();
  const tomorrow = addDays(base, 1);
  const range = (from: Date, until: Date): ReportDayRange => ({ from: dayOf(from), until: dayOf(until) });

  const isoWeekday = (base.getUTCDay() + 6) % 7;
  const weekStart = addDays(base, -isoWeekday);
  const quarterStartMonth = Math.floor(month / 3) * 3;

  switch (period) {
    case 'today': return range(base, tomorrow);
    case 'yesterday': return range(addDays(base, -1), base);
    case 'this-week': return range(weekStart, addDays(weekStart, 7));
    case 'last-week': return range(addDays(weekStart, -7), weekStart);
    case 'this-month': return range(startOfMonth(year, month), startOfMonth(year, month + 1));
    case 'last-month': return range(startOfMonth(year, month - 1), startOfMonth(year, month));
    case 'this-quarter':
      return range(startOfMonth(year, quarterStartMonth), startOfMonth(year, quarterStartMonth + 3));
    case 'last-quarter':
      return range(startOfMonth(year, quarterStartMonth - 3), startOfMonth(year, quarterStartMonth));
    case 'this-year': return range(startOfMonth(year, 0), startOfMonth(year + 1, 0));
    case 'last-year': return range(startOfMonth(year - 1, 0), startOfMonth(year, 0));
    // `last-7-days`, `last-30-days` e `last-90-days` já saíram pela forma parametrizada, acima.
    case 'year-to-date': return range(startOfMonth(year, 0), tomorrow);
    default: return null;
  }
};

/**
 * O período ANTERIOR — o que a comparação de um indicador põe ao lado: a janela de MESMO tamanho logo
 * antes. Os correntes têm par nomeado; os demais viram a forma parametrizada deslocada uma janela, que
 * é o que faltava para comparar "os últimos 12 meses" com os 12 antes deles (#4). `year-to-date` não
 * tem anterior de mesmo tamanho que seja um período de calendário, e não compara.
 */
const PREVIOUS_PERIOD: Partial<Record<ReportPeriod, string>> = {
  today: 'yesterday',
  'this-week': 'last-week',
  'this-month': 'last-month',
  'this-quarter': 'last-quarter',
  'this-year': 'last-year',
  yesterday: 'previous-1-days-offset-1',
  'last-week': 'previous-1-weeks-offset-1',
  'last-month': 'previous-1-months-offset-1',
  'last-quarter': 'previous-1-quarters-offset-1',
  'last-year': 'previous-1-years-offset-1',
};

export const previousReportPeriod = (period: unknown): string | null => {
  if (isNamedReportPeriod(period) && PREVIOUS_PERIOD[period]) return PREVIOUS_PERIOD[period] ?? null;
  const relative = parseRelativeReportPeriod(period);
  if (!relative) return null;
  const shifted = formatRelativeReportPeriod({ ...relative, offset: relative.offset + 1 });
  return parseRelativeReportPeriod(shifted) ? shifted : null;
};

/**
 * A chave de mensagem (em `core.reports`) que nomeia um período, com o `count` do plural. O deslocado
 * não tem nome — só a comparação o produz, e ela não o mostra —, e por isso devolve `null`.
 */
export const reportPeriodLabel = (period: unknown): { key: string; params?: { count: number } } | null => {
  if (isNamedReportPeriod(period)) return { key: `period.${period}` };
  const relative = parseRelativeReportPeriod(period);
  if (!relative || relative.offset > 0) return null;
  return { key: `period.${relative.direction}.${relative.unit}`, params: { count: relative.count } };
};
