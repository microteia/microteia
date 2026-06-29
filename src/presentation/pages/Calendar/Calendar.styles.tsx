import styled from 'styled-components';

export const S = {
  StatsBar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
  `,

  StatItem: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    flex: 1;
    padding: ${({ theme }) => theme.spacing.sm};
  `,

  StatValue: styled.div<{ $colorToken?: string }>`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme, $colorToken }) =>
      $colorToken ? (theme.colors as Record<string, string>)[$colorToken] : theme.colors.primary};
    line-height: 1;
  `,

  StatLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 4px;
  `,

  CalendarCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    display: flex;
    flex-direction: column;
    overflow: hidden;
    height: calc(100vh - 200px);
    min-height: 500px;
  `,

  MonthNav: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  NavButton: styled.button`
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
    transition: background ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;
    &:hover { background: ${({ theme }) => theme.colors.cardHover}; }
  `,

  MonthLabel: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    text-transform: capitalize;
    flex: 1;
    text-align: center;
    margin: 0;
  `,

  TodayButton: styled.button`
    background: ${({ theme }) => `${theme.colors.primary}18`};
    border: 1px solid ${({ theme }) => `${theme.colors.primary}40`};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    padding: 4px 14px;
    flex-shrink: 0;
    transition: background ${({ theme }) => theme.transitions.fast};
    &:hover { background: ${({ theme }) => `${theme.colors.primary}28`}; }
  `,

  DayColumnsScroller: styled.div`
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
  `,

  DayColumn: styled.div<{ $isToday: boolean }>`
    display: flex;
    flex-direction: column;
    min-width: 170px;
    flex-shrink: 0;
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme, $isToday }) =>
      $isToday ? `${theme.colors.primary}06` : 'transparent'};

    &:last-child { border-right: none; }
  `,

  DayHeader: styled.div<{ $isToday: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    background: ${({ theme, $isToday }) =>
      $isToday ? `${theme.colors.primary}10` : theme.colors.background};
    gap: 4px;
  `,

  DayNumber: styled.div<{ $isToday: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    line-height: 1;
    color: ${({ theme, $isToday }) => $isToday ? theme.colors.primary : theme.colors.text};
    width: 34px;
    height: 34px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 50%;
    background: ${({ theme, $isToday }) => $isToday ? `${theme.colors.primary}22` : 'transparent'};
  `,

  DayName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: capitalize;
  `,

  DayEvents: styled.div`
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
  `,

  SideEventCard: styled.div<{ $color: string; $done: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 4px;
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border-left: 3px solid ${({ $color }) => $color};
    border-right: 3px solid ${({ $color }) => $color};
    background: ${({ theme, $done }) => $done ? theme.colors.background : `${theme.colors.primary}08`};
    opacity: ${({ $done }) => $done ? 0.72 : 1};
  `,

  SideEventTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.35;
  `,

  SideEventMeta: styled.div`
    font-size: 0.65rem;
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  SideEventActions: styled.div`
    display: flex;
    gap: 6px;
    margin-top: 2px;
  `,

  Legend: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.lg};
    flex-wrap: wrap;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  LegendSeparator: styled.div`
    width: 1px;
    height: 16px;
    background: ${({ theme }) => theme.colors.border};
    margin: 0 4px;
    flex-shrink: 0;
  `,

  LegendLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    opacity: 0.6;
    margin-right: 4px;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  LegendItem: styled.div<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    padding: 4px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    cursor: pointer;
    transition: all ${({ theme }) => theme.transitions.fast};
    &:hover { background: ${({ theme }) => theme.colors.cardHover}; }
  `,

  LegendDot: styled.span<{ $color: string }>`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  StatusDot: styled.span<{ $colorToken: string }>`
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: ${({ theme, $colorToken }) => (theme.colors as Record<string, string>)[$colorToken]};
    flex-shrink: 0;
  `,

  QualityScore: styled.span<{ $quality: number }>`
    color: ${({ theme, $quality }) => {
      if ($quality <= 1) return theme.colors.danger;
      if ($quality === 2) return theme.colors.secondary;
      if ($quality === 3) return theme.colors.warning;
      if ($quality === 4) return theme.colors.success;
      return theme.colors.primary;
    }};
  `,
};
