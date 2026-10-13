/**
 * The grid's rules, outside React: this file imports nothing, which is what lets a test call it.
 *
 * Every day here is a `YYYY-MM-DD` text and every computation is done in UTC: a day is a name, not an
 * instant, and a grid drawn from local midnight would shift a whole column the day the office's
 * daylight-saving rule changes.
 */

export interface CalendarDraft {
  name: string;
  key: string;
  /** Weekdays that are never business days: 0 = Sunday … 6 = Saturday. */
  weekend: number[];
  /** Year (`"2026"`) → the days of that year that are not business days. */
  years: Record<string, string[]>;
}

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const YEAR_PATTERN = /^\d{4}$/;
const KEY_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]*$/;

const pad = (value: number): string => String(value).padStart(2, '0');

export const dayText = (year: number, month: number, day: number): string => `${year}-${pad(month)}-${pad(day)}`;

const utcOf = (day: string): Date => new Date(`${day}T12:00:00.000Z`);

const isRealDay = (day: string): boolean => DAY_PATTERN.test(day) && utcOf(day).toISOString().slice(0, 10) === day;

export const weekdayOf = (day: string): number => utcOf(day).getUTCDay();

/**
 * One month as the rows of a week grid starting on Sunday: `null` fills the cells before the first
 * day and after the last one, so every row has seven cells.
 */
export const monthGridOf = (year: number, month: number): (string | null)[][] => {
  const lead = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const length = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length }, (_, index) => dayText(year, month, index + 1)),
  ];
  while (cells.length % 7 !== 0) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, row) => cells.slice(row * 7, row * 7 + 7));
};

/** Month and weekday names come from `Intl`, never from a list written by hand. */
export const monthNameOf = (locale: string, year: number, month: number): string =>
  new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(year, month - 1, 1, 12)));

/** Sunday first: 2026-01-04 is a Sunday. */
export const weekdayNamesOf = (locale: string, width: 'narrow' | 'short'): string[] =>
  Array.from({ length: 7 }, (_, index) =>
    new Intl.DateTimeFormat(locale, { weekday: width, timeZone: 'UTC' }).format(utcOf(dayText(2026, 1, 4 + index))),
  );

const sortedUnique = (days: string[]): string[] => [...new Set(days)].sort();

/** The stored record → the draft the grid edits. What is malformed is dropped item by item. */
export const draftOf = (record: Record<string, unknown> | null | undefined): CalendarDraft => {
  const weekendRaw = record?.weekend;
  const weekend = Array.isArray(weekendRaw)
    ? weekendRaw.map(Number).filter((day) => Number.isInteger(day) && day >= 0 && day <= 6)
    : [];
  const years: Record<string, string[]> = {};
  const yearsRaw = record?.years;
  if (yearsRaw && typeof yearsRaw === 'object' && !Array.isArray(yearsRaw)) {
    for (const [year, days] of Object.entries(yearsRaw as Record<string, unknown>)) {
      if (!YEAR_PATTERN.test(year)) continue;
      const list = Array.isArray(days) ? days : [];
      years[year] = sortedUnique(
        list.filter((day): day is string => typeof day === 'string' && day.startsWith(`${year}-`) && isRealDay(day)),
      );
    }
  }
  return {
    name: typeof record?.name === 'string' ? record.name : '',
    key: typeof record?.key === 'string' ? record.key : '',
    weekend: [...new Set(weekend)].sort(),
    years,
  };
};

export const sameDraft = (left: CalendarDraft, right: CalendarDraft): boolean =>
  JSON.stringify(left) === JSON.stringify(right);

export const yearsOf = (draft: CalendarDraft): string[] => Object.keys(draft.years).sort();

/** The day marked or unmarked — the only edit the grid makes, by click or by drag. */
export const withDay = (draft: CalendarDraft, day: string, marked: boolean): CalendarDraft => {
  const year = day.slice(0, 4);
  const current = draft.years[year];
  if (!current) return draft;
  const next = marked ? sortedUnique([...current, day]) : current.filter((item) => item !== day);
  return { ...draft, years: { ...draft.years, [year]: next } };
};

export const withWeekday = (draft: CalendarDraft, weekday: number, off: boolean): CalendarDraft => ({
  ...draft,
  weekend: off
    ? [...new Set([...draft.weekend, weekday])].sort()
    : draft.weekend.filter((item) => item !== weekday),
});

export const withYear = (draft: CalendarDraft, year: number): CalendarDraft =>
  draft.years[String(year)] ? draft : { ...draft, years: { ...draft.years, [String(year)]: [] } };

export const withoutYear = (draft: CalendarDraft, year: string): CalendarDraft => {
  const years = { ...draft.years };
  delete years[year];
  return { ...draft, years };
};

/**
 * The next year, as a COPY of this one: same day and month. A day that does not exist in the target
 * year (29 February) is dropped. Holidays that move every year land on the wrong day and are the
 * office's to review — the copy cannot know which ones they are.
 */
export const copyYear = (draft: CalendarDraft, from: string, to: string): CalendarDraft => {
  const days = (draft.years[from] ?? [])
    .map((day) => `${to}${day.slice(4)}`)
    .filter(isRealDay);
  return { ...draft, years: { ...draft.years, [to]: sortedUnique(days) } };
};

export const isValidKey = (key: string): boolean => KEY_PATTERN.test(key.trim());

/** A key derived from a name: lower case, accents dropped, anything else becomes `-`. */
export const keyFromName = (name: string): string =>
  name
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

/** A key no other calendar uses, from a base: `calendar`, `calendar-2`, `calendar-3` … */
export const freeKey = (base: string, taken: string[]): string => {
  const root = keyFromName(base) || 'calendar';
  const used = new Set(taken.map((key) => key.toLowerCase()));
  if (!used.has(root)) return root;
  let index = 2;
  while (used.has(`${root}-${index}`)) index += 1;
  return `${root}-${index}`;
};

export const isKeyTaken = (key: string, others: string[]): boolean =>
  others.some((other) => other.trim().toLowerCase() === key.trim().toLowerCase());
