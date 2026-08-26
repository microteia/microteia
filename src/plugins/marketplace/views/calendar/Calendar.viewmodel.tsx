import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTheme } from 'styled-components';
import {
  useEntityList, useContributions, useRunAction, useActionVisible, useOpenRecord, useLookup, useNotify,
} from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { useSettingValue } from '@microteia/settings';
import { useLocale, useT } from '@microteia/i18n';
import {
  daysOf,
  dayKey,
  displayDate,
  isClosed,
  labelOf,
  monthLabelOf,
  monthOf,
  moveHandlerFor,
  statsOf,
  text,
  withoutMove,
} from './Calendar.rules';

const SOURCE_ID = 'microteia:calendar';
const COLLECTION = 'calendar';
const MOVE_POINT = 'calendar.moveaction';
const MOVE_SETTING = 'calendar.moveActions';

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
  const notify = useNotify();
  const statusOptions = useLookup('calendarStatuses');
  const priorityOptions = useLookup('calendarPriorities');

  const [month, setMonth] = useState(() => monthOf(new Date(), 0));
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  // The drag in flight: { [id]: { from, to } }. See positionOf.
  const [moves, setMoves] = useState({});
  const scrollerRef = useRef(null);

  const records = list.filteredRecords;

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
    cardTooltip: (record) => text(record.title),
    cardTitle: (record) => list.getCardTitle(record),
    cardItems: (record) => list.getCardItems(record),
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
