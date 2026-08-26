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
 * Which contribution answers a drag: the office's list in Settings decides, and the FIRST one that
 * serves that origin wins. Running them all would hand the Finance extension the drag of a deadline.
 */
export const moveHandlerFor = (contributions, record, layout, isVisible) => {
  const enabled = Array.isArray(layout) ? layout : [];
  const keyOf = (contribution) => text(contribution.metadata.key) || contribution.id;
  const isEnabled = (contribution) => {
    const entry = enabled.find((item) => item.key === keyOf(contribution));
    return entry ? entry.enabled !== false : true;
  };
  const order = (contribution) => {
    const index = enabled.findIndex((item) => item.key === keyOf(contribution));
    return index === -1 ? enabled.length : index;
  };

  return contributions
    .filter((contribution) => (
      servesRecord(contribution, record)
        && isEnabled(contribution)
        && isVisible(contribution.metadata.hiddenWhen, record, 'calendar')
    ))
    .sort((a, b) => order(a) - order(b))[0];
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
