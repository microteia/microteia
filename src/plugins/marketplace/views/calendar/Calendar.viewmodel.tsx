import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'styled-components';
import {
  useEntityList, useContributions, useRunAction, useActionVisible, useOpenRecord, useCollectionIdentity,
  useLookup, useNotify,
} from '@microteia/data';
import { getConfigColor, resolveColor } from '@microteia/theme';
import { useSettingValue } from '@microteia/settings';
import { useLabel, useLocale, useT } from '@microteia/i18n';
import {
  daysOf,
  dayKey,
  displayDate,
  fieldKeysOf,
  isClosed,
  isOriginHidden,
  labelOf,
  monthLabelOf,
  monthOf,
  moveHandlerFor,
  originsOf,
  partOf,
  sourceFor,
  statsOf,
  subtitleOf,
  text,
  withoutMove,
} from './Calendar.rules';

const SOURCE_ID = 'microteia:calendar';
const COLLECTION = 'calendar';
const MOVE_POINT = 'calendar.moveaction';
const MOVE_SETTING = 'calendar.moveActions';
const SOURCE_POINT = 'calendar.source';
const SOURCE_SETTING = 'calendar.sources';

/**
 * The state, the data and the gestures — and no JSX. Everything the agenda DECIDES is either here or,
 * when it is a function of its arguments and nothing else, in `Calendar.rules.ts` next door.
 */
export const useCalendarViewModel = () => {
  const theme = useTheme();
  const t = useT('com.microteia.calendar');
  const { locale } = useLocale();
  const list = useEntityList(SOURCE_ID);
  const moveActions = useContributions(MOVE_POINT);
  const moveLayout = useSettingValue(MOVE_SETTING);
  const runAction = useRunAction();
  const isVisible = useActionVisible();
  const openRecord = useOpenRecord();
  const identityOf = useCollectionIdentity();
  const sourceDeclarations = useContributions(SOURCE_POINT);
  const sourceLayout = useSettingValue(SOURCE_SETTING);
  const label = useLabel();
  const notify = useNotify();
  const statusOptions = useLookup('calendarStatuses');
  const priorityOptions = useLookup('calendarPriorities');

  const [month, setMonth] = useState(() => monthOf(new Date(), 0));
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  // The drag in flight: { [id]: { from, to } }. See positionOf.
  const [moves, setMoves] = useState({});
  const [originFilter, setOriginFilter] = useState(null);
  const scrollerRef = useRef(null);

  /**
   * Where each origin's cards say they come from, and how they are dressed. Two layers, the second
   * optional: the IDENTITY is derived from the screen that presents the collection today (its icon and
   * name), and the DECLARATION an origin made on `calendar.source` refines it. Both are read now, never
   * written on the item — which is why changing either reaches the items already on the agenda.
   */
  const sources = useMemo(() => {
    const byOrigin = {};
    for (const origem of originsOf(list.records)) {
      const declared = sourceFor(sourceDeclarations, origem, sourceLayout);
      const meta = declared ? declared.metadata : {};
      const identity = identityOf(origem);
      const metaFields = fieldKeysOf(meta.metaFields);
      byOrigin[origem] = {
        key: origem,
        label: text(meta.label) ? label(meta.label) : identity ? identity.title : '',
        icon: text(meta.icon) || (identity && identity.icon) || null,
        color: text(meta.color) ? resolveColor(meta.color, theme) : theme.colors.textMuted,
        subtitleFields: fieldKeysOf(meta.subtitleFields),
        metaFields: Array.isArray(meta.metaFields) ? metaFields : null,
        hidden: isOriginHidden(sourceDeclarations, origem, sourceLayout),
      };
    }
    return byOrigin;
  }, [list.records, sourceDeclarations, sourceLayout, identityOf, label, theme]);

  const records = useMemo(() => list.filteredRecords.filter((record) => {
    const source = sources[record.origem];
    if (source && source.hidden) return false;
    return originFilter === null || record.origem === originFilter;
  }), [list.filteredRecords, sources, originFilter]);

  const sourceOf = useCallback((record) => sources[record.origem] || null, [sources]);

  const days = useMemo(() => daysOf(records, month, moves, locale, new Date()), [month, records, moves, locale]);
  const stats = useMemo(() => statsOf(records, month, new Date()), [records, month]);

  // The agenda opens on today, not on the 1st: that is what is useful about the current month.
  // Reading the node only inside the effect is the rule — during render the measure does not exist yet.
  useEffect(() => {
    const container = scrollerRef.current;
    if (!container) return;
    const todayEl = container.querySelector('[data-today="true"]');
    if (!todayEl) {
      container.scrollLeft = 0;
      return;
    }
    container.scrollLeft = Math.max(0, todayEl.offsetLeft - container.clientWidth / 2 + todayEl.offsetWidth / 2);
  }, [month]);

  const priorityColor = useCallback(
    (record) => getConfigColor(priorityOptions, record.priority, theme),
    [priorityOptions, theme],
  );

  const goToMonth = useCallback((offset) => setMonth((current) => monthOf(current, offset)), []);
  const goToToday = useCallback(() => setMonth(monthOf(new Date(), 0)), []);

  const priorityToken = useMemo(() => {
    const found = list.filterTokens.find((token) => token.key === 'priority');
    return found && found.values.length === 1 ? found.values[0] : null;
  }, [list.filterTokens]);

  const filterByPriority = useCallback((key) => {
    const others = list.filterTokens.filter((token) => token.key !== 'priority');
    list.setFilterTokens(key === null ? others : others.concat([{ key: 'priority', values: [key] }]));
  }, [list]);

  const runMoveAction = useCallback(async (contribution, record, params) => {
    const result = await runAction({
      actionSourceId: text(contribution.metadata.actionSourceId),
      collection: COLLECTION,
      recordId: record.id,
      record,
      params,
    });
    if (!result.ok && result.message) notify(result.message, 'error');
    return result.ok;
  }, [runAction, notify]);

  /**
   * Dragging does not write: it asks. The list of who answers a move is the one in Settings — the
   * office turns entries on and off and orders them — and `moveHandlerFor` is what picks one.
   */
  const handleDrop = useCallback(async (day, recordId) => {
    setDraggingId(null);
    setDragOverKey(null);
    if (!recordId) return;

    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    const shown = displayDate(record);
    if (shown && dayKey(shown) === day.key) return;

    const handler = moveHandlerFor(moveActions, record, moveLayout, isVisible);
    if (!handler) {
      notify(t('view.move.no-handler'), 'info');
      return;
    }

    /**
     * The bet is placed BEFORE the call, and it is purely visual: the card appears on the new day
     * while the origin decides. Refused, it is undone at once and the card returns; accepted, it
     * undoes itself when the record arrives written (see positionOf).
     *
     * An origin that answers "success" without moving anything would leave the card ahead until the
     * next read of the collection. That is the price of not inventing a clock here — and the right
     * signal is still the data, not a timeout the agenda would arbitrate.
     */
    setMoves((prev) => ({ ...prev, [record.id]: { from: shown ? dayKey(shown) : null, to: day.key } }));

    const ok = await runMoveAction(handler, record, { targetDate: day.key });
    if (!ok) setMoves((prev) => withoutMove(prev, record.id));
  }, [records, moveActions, moveLayout, runMoveAction, notify, isVisible, t]);

  const dragOverDay = useCallback((event, key) => {
    event.preventDefault();
    setDragOverKey(key);
  }, []);

  const dragLeaveDay = useCallback((key) => {
    setDragOverKey((prev) => (prev === key ? null : prev));
  }, []);

  const dropOnDay = useCallback((event, day) => {
    event.preventDefault();
    handleDrop(day, event.dataTransfer.getData('text/plain'));
  }, [handleDrop]);

  const dragStart = useCallback((event, recordId) => {
    event.dataTransfer.setData('text/plain', recordId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggingId(recordId);
  }, []);

  const dragEnd = useCallback(() => {
    setDraggingId(null);
    setDragOverKey(null);
  }, []);

  const openOrigin = useCallback((record) => {
    if (record.origem && record.origemId) openRecord(record.origem, record.origemId);
  }, [openRecord]);

  const filterByOrigin = useCallback((origem) => setOriginFilter(origem), []);

  const stopClick = useCallback((event) => event.stopPropagation(), []);

  /**
   * The origin legend only earns its place when there is something to tell apart: with a single
   * origin on the agenda, it would repeat on every line what the card already says.
   */
  const originLegend = useMemo(() => {
    const shown = Object.keys(sources)
      .map((origem) => sources[origem])
      .filter((source) => !source.hidden && source.label !== '');
    if (shown.length < 2) return [];
    return shown
      .sort((a, b) => a.label.localeCompare(b.label, locale))
      .map((source) => ({
        key: source.key,
        label: source.label,
        icon: source.icon,
        dimmed: originFilter !== null && originFilter !== source.key,
      }));
  }, [sources, originFilter, locale]);

  /**
   * The lines under the title. A source that named its fields gets exactly those, formatted by the
   * field's type; one that named none gets the screen's list fields, as every card always did. Either
   * way a value written as a Markdown link comes out as a link (see `linkOf`).
   */
  const cardItems = useCallback((record) => {
    const source = sourceOf(record);
    const items = !source || source.metaFields === null
      ? list.getCardItems(record)
      : source.metaFields.map((key) => ({ key, value: list.getFieldText(record, key) }));
    return items.map((item) => partOf(item.key, item.value)).filter((part) => part.text !== '');
  }, [sourceOf, list]);

  const cardSubtitle = useCallback((record) => {
    const source = sourceOf(record);
    return source ? subtitleOf(record, source.subtitleFields, list.getFieldText) : [];
  }, [sourceOf, list]);

  const cardSource = useCallback((record) => {
    const source = sourceOf(record);
    return source && source.label !== '' ? source : null;
  }, [sourceOf]);

  const legend = useMemo(() => priorityOptions.map((option) => ({
    key: option.key,
    label: option.label,
    color: getConfigColor(priorityOptions, option.key, theme),
    dimmed: priorityToken !== null && priorityToken !== option.key,
  })), [priorityOptions, priorityToken, theme]);

  return {
    t,
    list,
    screenMissing: !list.definition,
    monthLabel: monthLabelOf(locale, month),
    goToMonth,
    goToToday,
    stats,
    statColors: {
      pending: theme.colors.warning,
      closed: theme.colors.success,
      late: theme.colors.danger,
    },
    filter: {
      defs: list.filterDefs,
      tokens: list.filterTokens,
      onChange: list.setFilterTokens,
      screenKey: list.savedFiltersScreenKey,
    },
    scrollerRef,
    days,
    isDragOver: (key) => dragOverKey === key,
    isDragging: (recordId) => draggingId === recordId,
    dragOverDay,
    dragLeaveDay,
    dropOnDay,
    dragStart,
    dragEnd,
    isDone: isClosed,
    openOrigin,
    stopClick,
    cardTooltip: (record) => text(record.title),
    cardTitle: (record) => list.getCardTitle(record),
    cardItems,
    cardSubtitle,
    cardSource,
    originLegend,
    filterByOrigin,
    cardActions: (record) => list.getCardActions(record),
    statusBadge: (record) => ({
      color: getConfigColor(statusOptions, record.status, theme),
      label: labelOf(statusOptions, record.status),
    }),
    priorityBadge: (record) => ({
      color: priorityColor(record),
      label: labelOf(priorityOptions, record.priority),
    }),
    priorityColor,
    legend,
    filterByPriority,
  };
};
