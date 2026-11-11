// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportPeriod.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Os períodos RELATIVOS que um filtro do leitor oferece.
 *
 * Fechados de propósito: cada um é uma afirmação sobre o calendário que o servidor resolve no fuso do
 * escritório, e um período escrito à mão ("últimos 45 dias úteis") é expressão — tem lugar em
 * `dataset.includeWhen`, não aqui. Uma lista aberta seria uma segunda gramática de datas.
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

export const isReportPeriod = (value: unknown): value is ReportPeriod =>
  typeof value === 'string' && (REPORT_PERIODS as readonly string[]).includes(value);

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
export const reportPeriodRange = (period: ReportPeriod, today: string): ReportDayRange | null => {
  const base = toUtcDate(today);
  if (!base) return null;

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
    case 'last-7-days': return range(addDays(base, -6), tomorrow);
    case 'last-30-days': return range(addDays(base, -29), tomorrow);
    case 'last-90-days': return range(addDays(base, -89), tomorrow);
    case 'year-to-date': return range(startOfMonth(year, 0), tomorrow);
    default: return null;
  }
};
