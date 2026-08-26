/**
 * The rules of reading one item: this file imports nothing, so a test can call it. The thread order,
 * what counts as long enough to fold, and how a like count is abbreviated are all functions of their
 * arguments — and all of them used to live inside the component.
 */

const READ_TAB_PREFIX = 'news-read:';

/** How much of a comment shows before it is folded. */
export const TRUNCATE = 500;

export const listOf = (value) => (Array.isArray(value) ? value : []);
export const has = (value, id) => !!id && listOf(value).indexOf(id) !== -1;
const without = (value, id) => listOf(value).filter((item) => item !== id);
const withValue = (value, id) => (has(value, id) ? listOf(value) : listOf(value).concat([id]));

/** Whoever is in leaves, whoever is out enters — liking, saving and marking as read are all this. */
export const toggled = (value, id) => (has(value, id) ? without(value, id) : withValue(value, id));

export const added = (value, id) => withValue(value, id);
export const removed = (value, id) => without(value, id);

export const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

/** The item this tab is reading. The tab key carries it, and nothing else does. */
export const newsIdOf = (tabKey) => String(tabKey || '').slice(READ_TAB_PREFIX.length);

/**
 * Dates are rendered by the LOCALE formatter, never by `toLocaleString('pt-BR', ...)`. Three
 * hardcoded formats lived in the view, and each one was a language nailed into a screen that any
 * office in the world can install.
 */
export const formatLikes = (count) => {
  if (count < 1000) return String(count);
  const k = count / 1000;
  return k % 1 === 0 ? k + 'k' : k.toFixed(1) + 'k';
};

/**
 * The thread: most liked first, and the newest first among equals. Ordering by likes is what keeps the
 * answer people found useful at the top of a long thread instead of buried by whatever came after it.
 */
export const threadOf = (comments, newsId) => comments
  .filter((item) => item.newsId === newsId)
  .sort((a, b) => {
    const likes = listOf(b.likedBy).length - listOf(a.likedBy).length;
    if (likes !== 0) return likes;
    const at = asDate(a.createdAt);
    const bt = asDate(b.createdAt);
    return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
  });

export const isTruncatable = (content) => content.length > TRUNCATE;

export const tagsOf = (record, tags) => listOf(record.tagIds)
  .map((id) => tags.find((tag) => tag.id === id))
  .filter(Boolean);

export const categoryLabelOf = (categories, record, fallback) => {
  const option = categories.find((item) => item.key === record.category);
  return option ? option.label : record.category || fallback;
};

export const withExpanded = (expanded, id) => {
  const next = Object.assign({}, expanded);
  next[id] = !next[id];
  return next;
};
