/**
 * The agenda's rules, outside React: this file imports nothing, which is what lets a test call it.
 * What lives here is everything that can be WRONG — which day a card belongs to, what the month adds
 * up to, which contribution answers a drag — and none of it needs a rendered screen to be exercised.
 */

/**
 * Month and weekday names come from `Intl`, never from an array written by hand. A hardcoded list is
 * a language nailed into the code: it looked harmless while the product spoke one language, and it is
 * exactly what an agenda cannot afford — every office in the world keeps dates.
 */
export const monthLabelOf = (locale, date) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);

export const weekdayOf = (locale, date) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);

const pad = (value) => String(value).padStart(2, '0');

export const dateOf = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

export const dayKey = (date) => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

export const startOfDay = (date) => new Date(date.getFullYear(), date.getMonth(), date.getDate());

export const monthOf = (date, offset) => new Date(date.getFullYear(), date.getMonth() + offset, 1);

const daysOfMonth = (month) => {
  const days = [];
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= last; day += 1) days.push(new Date(month.getFullYear(), month.getMonth(), day));
  return days;
};

export const isClosed = (record) => record.status === 'closed';

/**
 * The item shows up on the day it HAPPENS — and a completed item happened on the day it was
 * completed. It is the same reading as the previous agenda: what is past is read where it was
 * resolved, not where it was scheduled.
 */
export const displayDate = (record) => {
  const finish = dateOf(record.finishDate);
  if (isClosed(record) && finish) return finish;
  return dateOf(record.date);
};

/**
 * WHERE the card appears. Normally it is the day on the data; while the origin has not answered the
 * drag, it is the day it was dragged to — otherwise the card snaps back and the gesture looks as if
 * it had failed, even though it is on its way.
 *
 * The bet undoes ITSELF, and that is what makes it safe: it only holds while the record is still
 * where it was ('from'). As soon as the write lands, the item stops matching 'from' and the data is
 * in charge again — including when the origin decides on a THIRD day, which is why the agenda cannot
 * simply trust the day the user dropped it on.
 */
export const positionOf = (record, moves) => {
  const shown = displayDate(record);
  const key = shown ? dayKey(shown) : null;
  const move = moves[record.id];
  if (move && move.from === key) return { key: move.to, pending: true };
  return { key, pending: false };
};

const PRIORITY_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };

export const byPriority = (a, b) => {
  const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : -1;
  const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : -1;
  return bp - ap;
};

export const text = (value) => (typeof value === 'string' ? value : '');

/** Does the contribution serve this item? An empty origin in the declaration means "any origin". */
export const servesRecord = (contribution, record) => {
  const origem = text(contribution.metadata.origem);
  return origem === '' || origem === record.origem;
};

/**
 * The month, one column per day, each carrying the items that fall on it. `now` is a parameter and not
 * a call to the clock, so the same month always produces the same columns in a test.
 */
export const daysOf = (records, month, moves, locale, now) => {
  const todayKey = dayKey(now);
  return daysOfMonth(month).map((date) => {
    const key = dayKey(date);
    const items = records
      .map((record) => ({ record, position: positionOf(record, moves) }))
      .filter((item) => item.position.key === key)
      .sort((a, b) => byPriority(a.record, b.record));
    return {
      date,
      key,
      dayNumber: date.getDate(),
      weekday: weekdayOf(locale, date),
      isToday: key === todayKey,
      items,
    };
  });
};

/**
 * What the month adds up to. Late is counted from the DUE date, not from where the card is shown: an
 * item resolved today was never late, and one still open with yesterday's date is — which is why the
 * pending count has the late ones taken out of it instead of counting them twice.
 */
export const statsOf = (records, month, now) => {
  const prefix = month.getFullYear() + '-' + pad(month.getMonth() + 1);
  const today = startOfDay(now).getTime();
  const inMonth = records.filter((record) => {
    const shown = displayDate(record);
    return !!shown && dayKey(shown).indexOf(prefix) === 0;
  });
  const late = inMonth.filter((record) => {
    const due = dateOf(record.date);
    return !isClosed(record) && !!due && startOfDay(due).getTime() < today;
  });
  return {
    total: inMonth.length,
    pending: inMonth.filter((record) => !isClosed(record)).length - late.length,
    closed: inMonth.filter(isClosed).length,
    late: late.length,
  };
};

/**
 * The office's say over the contributions of a point, as Settings stores it: `{ key, enabled }[]`. An
 * entry the office never saw (a contribution that arrived after the list was saved) is ON and goes to
 * the end — installing an extension must be enough for it to take part.
 */
const keyOfContribution = (contribution) => text(contribution.metadata.key) || contribution.id;

const layoutOf = (layout) => {
  const entries = Array.isArray(layout) ? layout : [];
  const indexOf = (contribution) => entries.findIndex((item) => item.key === keyOfContribution(contribution));
  return {
    isEnabled: (contribution) => {
      const index = indexOf(contribution);
      return index === -1 ? true : entries[index].enabled !== false;
    },
    order: (contribution) => {
      const index = indexOf(contribution);
      return index === -1 ? entries.length : index;
    },
  };
};

/**
 * Which contribution answers a drag: the office's list in Settings decides, and the FIRST one that
 * serves that origin wins. Running them all would hand the Finance extension the drag of a deadline.
 */
export const moveHandlerFor = (contributions, record, layout, isVisible) => {
  const office = layoutOf(layout);
  return contributions
    .filter((contribution) => (
      servesRecord(contribution, record)
        && office.isEnabled(contribution)
        && isVisible(contribution.metadata.hiddenWhen, record, 'calendar')
    ))
    .sort((a, b) => office.order(a) - office.order(b))[0];
};

/**
 * The declaration an origin made of ITSELF on the agenda (`calendar.source`), or undefined. Unlike a
 * move handler, a source names its origin exactly: "every origin" would let one extension dress the
 * cards of all the others. When two declare the same origin, the office's order decides.
 */
export const sourceFor = (contributions, origem, layout) => {
  if (!origem) return undefined;
  const office = layoutOf(layout);
  return contributions
    .filter((contribution) => text(contribution.metadata.origem) === origem)
    .sort((a, b) => office.order(a) - office.order(b))[0];
};

/**
 * Is this origin switched off in Settings › Calendar? Switching it off HIDES its items: the origin
 * keeps writing them, so switching it back on is instant and needs no catch-up run. An origin that
 * declared nothing cannot be switched off — and keeps showing, as it always did.
 */
export const isOriginHidden = (contributions, origem, layout) => {
  const declared = sourceFor(contributions, origem, layout);
  return !!declared && !layoutOf(layout).isEnabled(declared);
};

/** A declared list of field keys, with anything that is not a key left out. */
export const fieldKeysOf = (value) =>
  (Array.isArray(value) ? value.filter((key) => typeof key === 'string' && key !== '') : []);

/**
 * A field value written as a Markdown link — `[label](href)`, the whole value and nothing else — is a
 * link to another record. It is the format notes already use, and whoever writes the item (the origin's
 * automation) is who knows the address: the agenda only recognizes the shape. `/microteia/<tab>` opens a
 * tab of the workspace and `http(s)://` a new window; any other href stays plain text, because the value
 * is data and a `javascript:` address must not become something to click.
 */
const LINK = /^\[([^\]]+)\]\(([^()\s]+)\)$/;
const LINK_TARGET = /^(\/microteia\/|https?:\/\/)/;

export const linkOf = (value) => {
  const match = LINK.exec(text(value).trim());
  return match && LINK_TARGET.test(match[2]) ? { label: match[1], href: match[2] } : null;
};

/** One piece of a card line: its text, and the href when the value was written as a link. */
export const partOf = (key, value) => {
  const link = linkOf(value);
  return link ? { key, text: link.label, href: link.href } : { key, text: text(value), href: null };
};

/**
 * The subtitle a source asked for: one piece per field it named, in order, the empty ones skipped — the
 * view draws them side by side, separated by ` · `. The source names FIELDS and never writes the line
 * itself — a template with words in it would be a phrase no catalog translates.
 */
export const subtitleOf = (record, keys, fieldText) =>
  keys.map((key) => partOf(key, fieldText(record, key))).filter((part) => part.text !== '');

/** The origins present in the records, each once, in the order they first appear. */
export const originsOf = (records) => {
  const seen = [];
  for (const record of records) {
    const origem = text(record.origem);
    if (origem && seen.indexOf(origem) === -1) seen.push(origem);
  }
  return seen;
};

export const labelOf = (options, key) => {
  const found = options.find((option) => option.key === key);
  return found ? found.label : key;
};

export const withoutMove = (moves, recordId) => {
  const next = {};
  for (const id of Object.keys(moves)) if (id !== recordId) next[id] = moves[id];
  return next;
};
