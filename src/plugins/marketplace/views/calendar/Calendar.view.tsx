import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { styled, useTheme } from 'styled-components';
import { CompositeFilter, EntityListModals, Icon, InfoBanner, cardActionIcon } from '@microteia/ui';
import {
  useEntityList, useContributions, useRunAction, useActionVisible, useOpenRecord, useLookup, useNotify,
} from '@microteia/data';
import { getConfigColor } from '@microteia/theme';
import { useSettingValue } from '@microteia/settings';
import { useLocale, useT } from '@microteia/i18n';

const SOURCE_ID = 'microteia:calendar';
const COLLECTION = 'calendar';
const MOVE_POINT = 'calendar.moveaction';
const MOVE_SETTING = 'calendar.moveActions';

const StatsBar = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  margin-bottom: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
`;

const StatItem = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  flex: 1;
  padding: ${({ theme }) => theme.spacing.sm};
`;

const StatValue = styled.div`
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  line-height: 1;
  color: ${({ $color, theme }) => $color || theme.colors.primary};
`;

const StatLabel = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  margin-top: 4px;
`;

const CalendarCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  display: flex;
  flex-direction: column;
  overflow: hidden;
  height: calc(100vh - 260px);
  min-height: 500px;
`;

const MonthNav = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const NavButton = styled.button`
  background: none;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text};
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.transitions.fast};
  &:hover { background: ${({ theme }) => theme.colors.cardHover}; }
`;

const MonthLabel = styled.h2`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  text-transform: capitalize;
  flex: 1;
  text-align: center;
  margin: 0;
`;

const TodayButton = styled.button`
  background: ${({ theme }) => theme.colors.primary + '18'};
  border: 1px solid ${({ theme }) => theme.colors.primary + '40'};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 600;
  padding: 4px 14px;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.transitions.fast};
  &:hover { background: ${({ theme }) => theme.colors.primary + '28'}; }
`;

const FilterRow = styled.div`
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const DayColumnsScroller = styled.div`
  display: flex;
  overflow-x: auto;
  overflow-y: hidden;
  flex: 1;

  &::-webkit-scrollbar { height: 6px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 3px;
  }
`;

const DayColumn = styled.div`
  display: flex;
  flex-direction: column;
  min-width: 170px;
  flex-shrink: 0;
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme, $isToday, $isDragOver }) =>
    $isDragOver ? theme.colors.primary + '12' : $isToday ? theme.colors.primary + '06' : 'transparent'};
  box-shadow: ${({ theme, $isDragOver }) => $isDragOver ? 'inset 0 0 0 2px ' + theme.colors.primary : 'none'};
  transition: background ${({ theme }) => theme.transitions.fast}, box-shadow ${({ theme }) => theme.transitions.fast};

  &:last-child { border-right: none; }
`;

const DayHeader = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: ${({ theme }) => theme.spacing.sm};
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
  gap: 4px;
  background: ${({ theme, $isToday }) => $isToday ? theme.colors.primary + '10' : theme.colors.background};
`;

const DayNumber = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.lg};
  font-weight: 700;
  line-height: 1;
  width: 34px;
  height: 34px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  color: ${({ theme, $isToday }) => $isToday ? theme.colors.primary : theme.colors.text};
  background: ${({ theme, $isToday }) => $isToday ? theme.colors.primary + '22' : 'transparent'};
`;

const DayName = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  text-transform: capitalize;
`;

const DayEvents = styled.div`
  padding: ${({ theme }) => theme.spacing.sm};
  display: flex;
  flex-direction: column;
  gap: 6px;
  overflow-y: auto;
  flex: 1;

  &::-webkit-scrollbar { width: 4px; }
  &::-webkit-scrollbar-track { background: transparent; }
  &::-webkit-scrollbar-thumb {
    background: ${({ theme }) => theme.colors.border};
    border-radius: 2px;
  }
`;

const EventCard = styled.div`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 4px;
  padding: 8px 10px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  border-left: 3px solid ${({ $color }) => $color};
  border-right: 3px solid ${({ $color }) => $color};
  background: ${({ theme, $done }) => $done ? theme.colors.background : theme.colors.primary + '08'};
  opacity: ${({ $done, $dragging, $pending }) => $dragging ? 0.35 : $pending ? 0.5 : $done ? 0.72 : 1};
  cursor: ${({ $dragging }) => $dragging ? 'grabbing' : 'grab'};
  /* In flight: the card already sits on the new day, but the origin is what confirms it. */
  border-top: 1px dashed ${({ $pending, theme }) => $pending ? theme.colors.primary : 'transparent'};
  transition: opacity ${({ theme }) => theme.transitions.fast}, transform ${({ theme }) => theme.transitions.fast}, box-shadow ${({ theme }) => theme.transitions.fast};

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 2px 8px ${({ theme }) => theme.colors.primary + '10'};
  }

  &:hover .calendar-card-actions {
    opacity: 1;
    pointer-events: auto;
  }
`;

const EventTitle = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.35;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const EventMeta = styled.div`
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.textMuted};
  display: flex;
  flex-direction: column;
  gap: 3px;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.textMuted};

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const BadgeRow = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-wrap: wrap;
`;

const Badge = styled.span`
  display: inline-flex;
  align-items: center;
  padding: 1px 5px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: 9px;
  font-weight: 500;
  background: ${({ $color }) => $color + '20'};
  color: ${({ $color }) => $color};
  border: 1px solid ${({ $color }) => $color + '40'};
  flex-shrink: 0;
  white-space: nowrap;
`;

const EventDescription = styled.div`
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  max-width: 150px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;

const CardActions = styled.div`
  position: absolute;
  top: 6px;
  right: 6px;
  display: flex;
  gap: 4px;
  opacity: 0;
  pointer-events: none;
  transition: ${({ theme }) => theme.transitions.fast};
  z-index: 1;
`;

const CardActionButton = styled.button`
  width: 20px;
  height: 20px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: 1px solid ${({ theme }) => theme.colors.border};
  background: ${({ theme }) => theme.colors.surface};
  color: ${({ theme }) => theme.colors.textMuted};
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: ${({ theme }) => theme.transitions.fast};

  &:disabled { opacity: 0.5; cursor: progress; }
  &:hover:not(:disabled) {
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    border-color: ${({ theme }) => theme.colors.primary};
  }
`;

const Legend = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
  flex-wrap: wrap;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const LegendLabel = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  opacity: 0.6;
  margin-right: 4px;
  color: ${({ theme }) => theme.colors.textMuted};
`;

const LegendItem = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textSecondary};
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.md};
  cursor: pointer;
  transition: all ${({ theme }) => theme.transitions.fast};
  opacity: ${({ $dimmed }) => $dimmed ? 0.4 : 1};
  &:hover { background: ${({ theme }) => theme.colors.cardHover}; }
`;

const LegendDot = styled.span`
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: ${({ $color }) => $color};
  flex-shrink: 0;
`;

/**
 * Month and weekday names come from `Intl`, never from an array written by hand. A hardcoded list is
 * a language nailed into the code: it looked harmless while the product spoke one language, and it is
 * exactly what an agenda cannot afford — every office in the world keeps dates.
 */
const monthLabelOf = (locale, date) =>
  new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric' }).format(date);

const weekdayOf = (locale, date) =>
  new Intl.DateTimeFormat(locale, { weekday: 'short' }).format(date);

const pad = (value) => String(value).padStart(2, '0');

const dateOf = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

const dayKey = (date) => date.getFullYear() + '-' + pad(date.getMonth() + 1) + '-' + pad(date.getDate());

const startOfToday = () => {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
};

const daysOfMonth = (month) => {
  const days = [];
  const last = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  for (let day = 1; day <= last; day += 1) days.push(new Date(month.getFullYear(), month.getMonth(), day));
  return days;
};

const isClosed = (record) => record.status === 'closed';

/**
 * The item shows up on the day it HAPPENS — and a completed item happened on the day it was
 * completed. It is the same reading as the previous agenda: what is past is read where it was
 * resolved, not where it was scheduled.
 */
const displayDate = (record) => {
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
const positionOf = (record, moves) => {
  const shown = displayDate(record);
  const key = shown ? dayKey(shown) : null;
  const move = moves[record.id];
  if (move && move.from === key) return { key: move.to, pending: true };
  return { key, pending: false };
};

const PRIORITY_ORDER = { critical: 3, high: 2, medium: 1, low: 0 };

const byPriority = (a, b) => {
  const ap = PRIORITY_ORDER[a.priority] != null ? PRIORITY_ORDER[a.priority] : -1;
  const bp = PRIORITY_ORDER[b.priority] != null ? PRIORITY_ORDER[b.priority] : -1;
  return bp - ap;
};

const text = (value) => (typeof value === 'string' ? value : '');

/** Does the contribution serve this item? An empty origin in the declaration means "any origin". */
const servesRecord = (contribution, record) => {
  const origem = text(contribution.metadata.origem);
  return origem === '' || origem === record.origem;
};

export default function CalendarView() {
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

  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });
  const [draggingId, setDraggingId] = useState(null);
  const [dragOverKey, setDragOverKey] = useState(null);
  // The drag in flight: { [id]: { from, to } }. See positionOf.
  const [moves, setMoves] = useState({});
  const scrollerRef = useRef(null);

  const records = list.filteredRecords;

  const monthLabel = monthLabelOf(locale, month);

  const days = useMemo(() => {
    const todayKey = dayKey(new Date());
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
  }, [month, records, moves, locale]);

  const stats = useMemo(() => {
    const prefix = month.getFullYear() + '-' + pad(month.getMonth() + 1);
    const today = startOfToday().getTime();
    const inMonth = records.filter((record) => {
      const shown = displayDate(record);
      return !!shown && dayKey(shown).indexOf(prefix) === 0;
    });
    const late = inMonth.filter((record) => {
      const due = dateOf(record.date);
      return !isClosed(record) && !!due && new Date(due.getFullYear(), due.getMonth(), due.getDate()).getTime() < today;
    });
    return {
      total: inMonth.length,
      pending: inMonth.filter((record) => !isClosed(record)).length - late.length,
      closed: inMonth.filter(isClosed).length,
      late: late.length,
    };
  }, [records, month]);

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

  const labelOf = (options, key) => {
    const found = options.find((option) => option.key === key);
    return found ? found.label : key;
  };

  const goToMonth = (offset) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + offset, 1));
  const goToToday = () => {
    const now = new Date();
    setMonth(new Date(now.getFullYear(), now.getMonth(), 1));
  };

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
   * office turns entries on and off and orders them — and the FIRST one that serves that origin wins.
   * Running them all would hand the Finance extension the drag of a deadline.
   */
  const handleDrop = useCallback(async (day, recordId) => {
    setDraggingId(null);
    setDragOverKey(null);
    if (!recordId) return;

    const record = records.find((item) => item.id === recordId);
    if (!record) return;
    const shown = displayDate(record);
    if (shown && dayKey(shown) === day.key) return;

    const enabled = Array.isArray(moveLayout) ? moveLayout : [];
    const isEnabled = (contribution) => {
      const key = text(contribution.metadata.key) || contribution.id;
      const entry = enabled.find((item) => item.key === key);
      return entry ? entry.enabled !== false : true;
    };
    const order = (contribution) => {
      const key = text(contribution.metadata.key) || contribution.id;
      const index = enabled.findIndex((item) => item.key === key);
      return index === -1 ? enabled.length : index;
    };

    const handler = moveActions
      .filter((contribution) => (
        servesRecord(contribution, record)
          && isEnabled(contribution)
          && isVisible(contribution.metadata.hiddenWhen, record, 'calendar')
      ))
      .sort((a, b) => order(a) - order(b))[0];

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
    if (!ok) {
      setMoves((prev) => {
        const next = {};
        for (const id of Object.keys(prev)) if (id !== record.id) next[id] = prev[id];
        return next;
      });
    }
  }, [records, moveActions, moveLayout, runMoveAction, notify, isVisible, t]);

  if (!list.definition) {
    return (
      <div style={{ padding: '24px' }}>
        <InfoBanner message={t('view.screen-missing')} variant="warning" />
      </div>
    );
  }

  return (
    <>
      <StatsBar>
        <StatItem>
          <StatValue>{stats.total}</StatValue>
          <StatLabel>{t('view.stat.month')}</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={theme.colors.warning}>{stats.pending}</StatValue>
          <StatLabel>{t('view.stat.pending')}</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={theme.colors.success}>{stats.closed}</StatValue>
          <StatLabel>{t('view.stat.closed')}</StatLabel>
        </StatItem>
        <StatItem>
          <StatValue $color={theme.colors.danger}>{stats.late}</StatValue>
          <StatLabel>{t('view.stat.late')}</StatLabel>
        </StatItem>
      </StatsBar>

      <CalendarCard>
        <MonthNav>
          <NavButton onClick={() => goToMonth(-1)} aria-label={t('view.previous-month')}>
            <Icon name="arrowLeft" size={20} />
          </NavButton>
          <MonthLabel>{monthLabel}</MonthLabel>
          <NavButton onClick={() => goToMonth(1)} aria-label={t('view.next-month')}>
            <Icon name="arrowRight" size={20} />
          </NavButton>
          <TodayButton onClick={goToToday}>{t('view.today')}</TodayButton>
        </MonthNav>

        <FilterRow>
          <CompositeFilter
            defs={list.filterDefs}
            tokens={list.filterTokens}
            onChange={list.setFilterTokens}
            screenKey={list.savedFiltersScreenKey}
            placeholder={t('view.filter.placeholder')}
          />
        </FilterRow>

        <DayColumnsScroller ref={scrollerRef}>
          {days.map((day) => (
            <DayColumn
              key={day.key}
              $isToday={day.isToday}
              $isDragOver={dragOverKey === day.key}
              data-today={day.isToday ? 'true' : undefined}
              onDragOver={(e) => { e.preventDefault(); setDragOverKey(day.key); }}
              onDragLeave={() => setDragOverKey((prev) => (prev === day.key ? null : prev))}
              onDrop={(e) => { e.preventDefault(); handleDrop(day, e.dataTransfer.getData('text/plain')); }}
            >
              <DayHeader $isToday={day.isToday}>
                <DayNumber $isToday={day.isToday}>{day.dayNumber}</DayNumber>
                <DayName>{day.weekday}</DayName>
              </DayHeader>

              <DayEvents>
                {day.items.map(({ record, position }) => (
                  <EventCard
                    key={record.id}
                    $color={priorityColor(record)}
                    $done={isClosed(record)}
                    $dragging={draggingId === record.id}
                    $pending={position.pending}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', record.id);
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggingId(record.id);
                    }}
                    onDragEnd={() => { setDraggingId(null); setDragOverKey(null); }}
                    onClick={() => {
                      if (record.origem && record.origemId) openRecord(record.origem, record.origemId);
                    }}
                    title={text(record.title)}
                  >
                    <EventTitle>{list.getCardTitle(record)}</EventTitle>

                    <EventMeta>
                      {record.hour ? (
                        <MetaRow><Icon name="time" size={10} /><span>{record.hour}</span></MetaRow>
                      ) : null}

                      {/*
                        The card lines come from the SCREEN configuration — the fields marked to
                        appear in the list. This is how a field added by another extension (the case
                        of a deadline, the person of a hearing) reaches the card without the agenda
                        knowing it by name.
                      */}
                      {list.getCardItems(record).map((item) => (
                        <MetaRow key={item.key}>
                          <span>{item.value}</span>
                        </MetaRow>
                      ))}

                      <BadgeRow>
                        <Badge $color={getConfigColor(statusOptions, record.status, theme)}>
                          {labelOf(statusOptions, record.status)}
                        </Badge>
                        <Badge $color={priorityColor(record)}>
                          {labelOf(priorityOptions, record.priority)}
                        </Badge>
                      </BadgeRow>

                      {record.description ? (
                        <EventDescription>{record.description}</EventDescription>
                      ) : null}
                    </EventMeta>

                    {/*
                      The card gestures come from the SCREEN configuration — "Card actions in the
                      list" in the Form Design — resolved through the same path as any list: the
                      native actions the screen enabled plus the office's own, with the visibility
                      expression already evaluated record by record. The agenda knows none of them by
                      name, and the user adds or removes as many as they like without touching this
                      code.
                    */}
                    {list.getCardActions(record).length > 0 ? (
                      <CardActions className="calendar-card-actions">
                        {list.getCardActions(record).map((action) => (
                          <CardActionButton
                            key={action.key}
                            type="button"
                            title={action.title}
                            disabled={action.disabled}
                            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                          >
                            {cardActionIcon(action, 11)}
                          </CardActionButton>
                        ))}
                      </CardActions>
                    ) : null}
                  </EventCard>
                ))}
              </DayEvents>
            </DayColumn>
          ))}
        </DayColumnsScroller>

        <Legend>
          <LegendLabel>{t('view.legend.priority')}</LegendLabel>
          <LegendItem onClick={() => filterByPriority(null)}>
            <span>{t('view.legend.all')}</span>
          </LegendItem>
          {priorityOptions.map((option) => (
            <LegendItem
              key={option.key}
              $dimmed={priorityToken !== null && priorityToken !== option.key}
              onClick={() => filterByPriority(option.key)}
            >
              <LegendDot $color={getConfigColor(priorityOptions, option.key, theme)} />
              <span>{option.label}</span>
            </LegendItem>
          ))}
        </Legend>
      </CalendarCard>

      {/* An action that asks for parameters before running, the delete confirmation and the tags —
          the same modals as the default list. Without them, an action with parameters would wait for
          a question nobody draws. */}
      <EntityListModals vm={list} />
    </>
  );
}
