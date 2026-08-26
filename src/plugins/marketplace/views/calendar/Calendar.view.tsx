import { CompositeFilter, EntityListModals, Icon, InfoBanner, cardActionIcon } from '@microteia/ui';
import { useCalendarViewModel } from './Calendar.viewmodel';
import { S } from './Calendar.styles';

/**
 * The agenda, in four files: this one renders, `Calendar.viewmodel.tsx` holds the state and the
 * gestures, `Calendar.styles.tsx` holds the styles and `Calendar.rules.ts` holds what a test can call.
 * They travel as a LIST in the plugin's `source`, merged into the one module the runtime evaluates.
 *
 * Nothing here decides anything: no state, no effect, no computation. That is what makes the screen
 * readable at a glance — and what makes the day a card belongs to testable without a browser.
 */
/* eslint-disable react-hooks/refs -- the view model exposes a ref only to hand to the DOM; nothing reads .current in render */
export default function CalendarView() {
  const vm = useCalendarViewModel();

  if (vm.screenMissing) {
    return (
      <S.Missing>
        <InfoBanner message={vm.t('view.screen-missing')} variant="warning" />
      </S.Missing>
    );
  }

  return (
    <>
      <S.StatsBar>
        <S.StatItem>
          <S.StatValue>{vm.stats.total}</S.StatValue>
          <S.StatLabel>{vm.t('view.stat.month')}</S.StatLabel>
        </S.StatItem>
        <S.StatItem>
          <S.StatValue $color={vm.statColors.pending}>{vm.stats.pending}</S.StatValue>
          <S.StatLabel>{vm.t('view.stat.pending')}</S.StatLabel>
        </S.StatItem>
        <S.StatItem>
          <S.StatValue $color={vm.statColors.closed}>{vm.stats.closed}</S.StatValue>
          <S.StatLabel>{vm.t('view.stat.closed')}</S.StatLabel>
        </S.StatItem>
        <S.StatItem>
          <S.StatValue $color={vm.statColors.late}>{vm.stats.late}</S.StatValue>
          <S.StatLabel>{vm.t('view.stat.late')}</S.StatLabel>
        </S.StatItem>
      </S.StatsBar>

      <S.CalendarCard>
        <S.MonthNav>
          <S.NavButton onClick={() => vm.goToMonth(-1)} aria-label={vm.t('view.previous-month')}>
            <Icon name="arrowLeft" size={20} />
          </S.NavButton>
          <S.MonthLabel>{vm.monthLabel}</S.MonthLabel>
          <S.NavButton onClick={() => vm.goToMonth(1)} aria-label={vm.t('view.next-month')}>
            <Icon name="arrowRight" size={20} />
          </S.NavButton>
          <S.TodayButton onClick={vm.goToToday}>{vm.t('view.today')}</S.TodayButton>
        </S.MonthNav>

        <S.FilterRow>
          <CompositeFilter
            defs={vm.filter.defs}
            tokens={vm.filter.tokens}
            onChange={vm.filter.onChange}
            screenKey={vm.filter.screenKey}
            placeholder={vm.t('view.filter.placeholder')}
          />
        </S.FilterRow>

        <S.DayColumnsScroller ref={vm.scrollerRef}>
          {vm.days.map((day) => (
            <S.DayColumn
              key={day.key}
              $isToday={day.isToday}
              $isDragOver={vm.isDragOver(day.key)}
              data-today={day.isToday ? 'true' : undefined}
              onDragOver={(e) => vm.dragOverDay(e, day.key)}
              onDragLeave={() => vm.dragLeaveDay(day.key)}
              onDrop={(e) => vm.dropOnDay(e, day)}
            >
              <S.DayHeader $isToday={day.isToday}>
                <S.DayNumber $isToday={day.isToday}>{day.dayNumber}</S.DayNumber>
                <S.DayName>{day.weekday}</S.DayName>
              </S.DayHeader>

              <S.DayEvents>
                {day.items.map(({ record, position }) => (
                  <S.EventCard
                    key={record.id}
                    $color={vm.priorityColor(record)}
                    $done={vm.isDone(record)}
                    $dragging={vm.isDragging(record.id)}
                    $pending={position.pending}
                    draggable
                    onDragStart={(e) => vm.dragStart(e, record.id)}
                    onDragEnd={vm.dragEnd}
                    onClick={() => vm.openOrigin(record)}
                    title={vm.cardTooltip(record)}
                  >
                    <S.EventTitle>{vm.cardTitle(record)}</S.EventTitle>

                    <S.EventMeta>
                      {record.hour ? (
                        <S.MetaRow><Icon name="time" size={10} /><span>{record.hour}</span></S.MetaRow>
                      ) : null}

                      {/*
                        The card lines come from the SCREEN configuration — the fields marked to
                        appear in the list. This is how a field added by another extension (the case
                        of a deadline, the person of a hearing) reaches the card without the agenda
                        knowing it by name.
                      */}
                      {vm.cardItems(record).map((item) => (
                        <S.MetaRow key={item.key}>
                          <span>{item.value}</span>
                        </S.MetaRow>
                      ))}

                      <S.BadgeRow>
                        <S.Badge $color={vm.statusBadge(record).color}>
                          {vm.statusBadge(record).label}
                        </S.Badge>
                        <S.Badge $color={vm.priorityBadge(record).color}>
                          {vm.priorityBadge(record).label}
                        </S.Badge>
                      </S.BadgeRow>

                      {record.description ? (
                        <S.EventDescription>{record.description}</S.EventDescription>
                      ) : null}
                    </S.EventMeta>

                    {/*
                      The card gestures come from the SCREEN configuration — "Card actions in the
                      list" in the Form Design — resolved through the same path as any list: the
                      native actions the screen enabled plus the office's own, with the visibility
                      expression already evaluated record by record. The agenda knows none of them by
                      name, and the user adds or removes as many as they like without touching this
                      code.
                    */}
                    {vm.cardActions(record).length > 0 ? (
                      <S.CardActions className="calendar-card-actions">
                        {vm.cardActions(record).map((action) => (
                          <S.CardActionButton
                            key={action.key}
                            type="button"
                            title={action.title}
                            disabled={action.disabled}
                            onClick={(e) => { e.stopPropagation(); action.onClick(); }}
                          >
                            {cardActionIcon(action, 11)}
                          </S.CardActionButton>
                        ))}
                      </S.CardActions>
                    ) : null}
                  </S.EventCard>
                ))}
              </S.DayEvents>
            </S.DayColumn>
          ))}
        </S.DayColumnsScroller>

        <S.Legend>
          <S.LegendLabel>{vm.t('view.legend.priority')}</S.LegendLabel>
          <S.LegendItem onClick={() => vm.filterByPriority(null)}>
            <span>{vm.t('view.legend.all')}</span>
          </S.LegendItem>
          {vm.legend.map((option) => (
            <S.LegendItem
              key={option.key}
              $dimmed={option.dimmed}
              onClick={() => vm.filterByPriority(option.key)}
            >
              <S.LegendDot $color={option.color} />
              <span>{option.label}</span>
            </S.LegendItem>
          ))}
        </S.Legend>
      </S.CalendarCard>

      {/* An action that asks for parameters before running, the delete confirmation and the tags —
          the same modals as the default list. Without them, an action with parameters would wait for
          a question nobody draws. */}
      <EntityListModals vm={vm.list} />
    </>
  );
}
