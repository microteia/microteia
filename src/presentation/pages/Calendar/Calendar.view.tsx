import React from 'react';
import { useTheme } from 'styled-components';
import { RiArrowLeftSLine, RiArrowRightSLine, RiScalesLine, RiCheckLine } from 'react-icons/ri';
import { useCalendarViewModel } from './Calendar.viewmodel';
import { S } from './Calendar.styles';
import type { DeadlinePriority } from '../../../domain/entities';
import type { PriorityFilter } from './Calendar.viewmodel';

export const CalendarView: React.FC = () => {
  const vm = useCalendarViewModel();
  const theme = useTheme();

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
              $isDragOver={vm.dragOverDayKey === day.dateKey}
              data-today={day.isToday ? 'true' : undefined}
              onDragOver={(e) => { e.preventDefault(); vm.handleDayDragOver(day.dateKey); }}
              onDragLeave={() => vm.handleDayDragLeave(day.dateKey)}
              onDrop={(e) => { e.preventDefault(); void vm.handleDayDrop(day.date, e.dataTransfer.getData('text/plain')); }}
            >
              <S.DayHeader $isToday={day.isToday}>
                <S.DayNumber $isToday={day.isToday}>{day.dayNumber}</S.DayNumber>
                <S.DayName>{day.weekdayAbbr}</S.DayName>
              </S.DayHeader>

              <S.DayEvents>
                {day.items.map((item) => (
                  <S.SideEventCard
                    key={item.deadline.id}
                    $color={item.isOverdue ? theme.colors.deadlineStatusOverdue : item.color}
                    $done={item.isCompleted}
                    $dragging={vm.draggingDeadlineId === item.deadline.id}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.deadline.id);
                      e.dataTransfer.effectAllowed = 'move';
                      vm.handleDragStart(item.deadline.id);
                    }}
                    onDragEnd={vm.handleDragEnd}
                    onClick={() => vm.handleOpenDeadline(item.deadline.id)}
                  >
                    <S.SideEventType>{item.deadline.type}</S.SideEventType>

                    <S.SideEventMeta>
                      {item.caseExists && (
                        <S.SideEventCaseLink
                          onClick={(e) => {
                            e.stopPropagation();
                            vm.handleOpenCase(item.caseId);
                          }}
                          title={`Abrir processo ${item.deadline.caseNumber}`}
                        >
                          {item.deadline.caseNumber}
                        </S.SideEventCaseLink>
                      )}

                      <S.SideEventBadgeRow>
                        <S.SideEventBadge $color={item.statusColor}>
                          {item.deadline.status}
                        </S.SideEventBadge>
                        <S.SideEventBadge $color={item.color}>
                          {item.deadline.priority}
                        </S.SideEventBadge>
                      </S.SideEventBadgeRow>

                      {item.deadline.responsibleLawyerName && (
                        <S.SideEventLawyer>
                          <RiScalesLine size={10} />
                          <span>{item.deadline.responsibleLawyerName}</span>
                        </S.SideEventLawyer>
                      )}

                      {item.deadline.description && (
                        <S.SideEventDescription>
                          {item.deadline.description}
                        </S.SideEventDescription>
                      )}
                    </S.SideEventMeta>

                    {item.deadline.status !== 'Concluído' && item.deadline.status !== 'Cancelado' && (
                      <S.SideEventCompleteBtn
                        className="calendar-complete-btn"
                        title="Marcar como concluído"
                        onClick={(e) => {
                          e.stopPropagation();
                          void vm.handleCompleteDeadline(item.deadline.id);
                        }}
                      >
                        <RiCheckLine size={11} />
                      </S.SideEventCompleteBtn>
                    )}
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
