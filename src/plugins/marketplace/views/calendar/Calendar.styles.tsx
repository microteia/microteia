import { styled } from 'styled-components';

/**
 * Every colour, size, space and radius comes from the theme: a literal stops matching the office the
 * day it changes theme, and the agenda is a screen people keep open all day.
 */
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

const SourceTag = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  max-width: 150px;
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.02em;
  text-transform: uppercase;
  color: ${({ $color }) => $color};

  span {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
`;

const EventSubtitle = styled.div`
  font-size: 0.65rem;
  color: ${({ theme }) => theme.colors.textSecondary};
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

const Missing = styled.div`
  padding: ${({ theme }) => theme.spacing.lg};
`;

export const S = {
  Missing,
  StatsBar,
  StatItem,
  StatValue,
  StatLabel,
  CalendarCard,
  MonthNav,
  NavButton,
  MonthLabel,
  TodayButton,
  FilterRow,
  DayColumnsScroller,
  DayColumn,
  DayHeader,
  DayNumber,
  DayName,
  DayEvents,
  EventCard,
  SourceTag,
  EventTitle,
  EventSubtitle,
  EventMeta,
  MetaRow,
  BadgeRow,
  Badge,
  EventDescription,
  CardActions,
  CardActionButton,
  Legend,
  LegendLabel,
  LegendItem,
  LegendDot,
};
