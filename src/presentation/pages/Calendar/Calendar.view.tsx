import React from 'react';
import { RiArrowLeftSLine, RiArrowRightSLine } from 'react-icons/ri';
import { useCalendarViewModel } from './Calendar.viewmodel';
import { S } from './Calendar.styles';
import type { DeadlinePriority } from '../../../domain/entities';
import type { PriorityFilter } from './Calendar.viewmodel';

export const CalendarView: React.FC = () => {
  const vm = useCalendarViewModel();

  return (
    <>
      <S.StatsBar>
        <S.StatItem>
          <S.StatValue>{vm.stats.total}</S.StatValue>
          <S.StatLabel>No mês</S.StatLabel>
        </S.StatItem>
        <S.StatItem>
          <S.StatValue $colorToken="warning">{vm.stats.pending}</S.StatValue>
          <S.StatLabel>Pendentes</S.StatLabel>
        </S.StatItem>
        <S.StatItem>
          <S.StatValue $colorToken="success">{vm.stats.completed}</S.StatValue>
          <S.StatLabel>Concluídos</S.StatLabel>
        </S.StatItem>
        <S.StatItem>
          <S.StatValue $colorToken="danger">{vm.stats.overdue}</S.StatValue>
          <S.StatLabel>Vencidos</S.StatLabel>
        </S.StatItem>
      </S.StatsBar>

      <S.CalendarCard>
        <S.MonthNav>
          <S.NavButton onClick={vm.goToPrevMonth} aria-label="Mês anterior">
            <RiArrowLeftSLine size={20} />
          </S.NavButton>
          <S.MonthLabel>{vm.monthLabel}</S.MonthLabel>
          <S.NavButton onClick={vm.goToNextMonth} aria-label="Próximo mês">
            <RiArrowRightSLine size={20} />
          </S.NavButton>
          <S.TodayButton onClick={vm.goToToday}>Hoje</S.TodayButton>
        </S.MonthNav>

        <S.DayColumnsScroller data-calendar-scroller>
          {vm.daysInMonth.map((day) => (
            <S.DayColumn
              key={day.dayNumber}
              $isToday={day.isToday}
              data-today={day.isToday ? 'true' : undefined}
            >
              <S.DayHeader $isToday={day.isToday}>
                <S.DayNumber $isToday={day.isToday}>{day.dayNumber}</S.DayNumber>
                <S.DayName>{day.weekdayAbbr}</S.DayName>
              </S.DayHeader>

              <S.DayEvents>
                {day.items.map(({ deadline, color, isOverdue, isCompleted }) => (
                  <S.SideEventCard key={deadline.id} $color={isOverdue ? '#ef4444' : color} $done={isCompleted}>
                    <S.SideEventTitle>{deadline.description || deadline.type}</S.SideEventTitle>
                    <S.SideEventMeta>
                      <span>{deadline.caseNumber}</span>
                      <span>{deadline.status}</span>
                      {deadline.responsibleLawyerName && <span>{deadline.responsibleLawyerName}</span>}
                    </S.SideEventMeta>
                  </S.SideEventCard>
                ))}
              </S.DayEvents>
            </S.DayColumn>
          ))}
        </S.DayColumnsScroller>

        <S.Legend>
          <S.LegendLabel>Prioridade:</S.LegendLabel>
          <S.LegendItem
            $active={vm.filterPriority === 'all'}
            onClick={() => vm.setFilterPriority('all' as PriorityFilter)}
          >
            <span>Todas</span>
          </S.LegendItem>
          {vm.priorityOptions.map((opt) => (
            <S.LegendItem
              key={opt.key}
              $active={vm.filterPriority === opt.key}
              onClick={() => vm.setFilterPriority(opt.key as DeadlinePriority)}
            >
              <S.LegendDot $color={opt.color} style={{ opacity: vm.filterPriority === 'all' || vm.filterPriority === opt.key ? 1 : 0.3 }} />
              <span>{opt.label}</span>
            </S.LegendItem>
          ))}
        </S.Legend>
      </S.CalendarCard>
    </>
  );
};
