/**
 * The noticeboard's rules, outside React: this file imports nothing, so a test can call it. Reading
 * status is the reason it exists — it is not a field, it is the relation between an item and whoever
 * is looking at the screen, and getting it wrong shows the wrong noticeboard to everybody.
 */

/**
 * The value as a Date, for the locale formatter to render. Formatting used to happen in the view, with
 * `toLocaleString('pt-BR', ...)` written into it — a whole language nailed into a date.
 */
export const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

export const listOf = (value) => (Array.isArray(value) ? value : []);
export const has = (value, id) => !!id && listOf(value).indexOf(id) !== -1;
const without = (value, id) => listOf(value).filter((item) => item !== id);
const withValue = (value, id) => (has(value, id) ? listOf(value) : listOf(value).concat([id]));

/** Whoever is in leaves, whoever is out enters — the one gesture behind liking and saving. */
export const toggled = (value, id) => (has(value, id) ? without(value, id) : withValue(value, id));

export const removed = (value, id) => without(value, id);

// The useful view for whoever opens the noticeboard is what they have not read yet.
export const UNREAD_TOKENS = [{ key: 'readStatus', values: ['UNREAD'] }];

/**
 * Reading status resolves HERE and not in the filter derived from the schema, because there is no field
 * to filter on: the same item is unread for one person and read for the next.
 */
export const matchesReadStatus = (record, statuses, userId) => {
  if (statuses.length === 0) return true;
  return statuses.some((status) => {
    if (status === 'UNREAD') return !has(record.readBy, userId);
    if (status === 'READ') return has(record.readBy, userId);
    if (status === 'SAVED') return has(record.savedBy, userId);
    return false;
  });
};

export const commentCountsOf = (comments) => {
  const counts = {};
  for (const comment of comments) {
    const key = comment.newsId;
    if (key) counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
};

/** What the badge counts. Your own item is never unread to you — you wrote it. */
export const unreadCountOf = (records, userId) => records
  .filter((record) => !has(record.readBy, userId) && record.createdBy !== userId)
  .length;

export const indexById = (items) => {
  const index = {};
  for (const item of items) index[item.id] = item;
  return index;
};

export const tagsOf = (record, index) => listOf(record.tagIds).map((id) => index[id]).filter(Boolean);

export const categoryLabelOf = (categories, record, fallback) => {
  const option = categories.find((item) => item.key === record.category);
  return option ? option.label : record.category || fallback;
};
