import styled from 'styled-components';
import { Card } from '../../components/ui/Card';

export const S = {
  Page: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    overflow-y: auto;
    height: 100%;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xl};
  `,

  KPIGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  KPICard: styled(Card)<{ $clickable?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    cursor: ${({ $clickable }) => $clickable ? 'pointer' : 'default'};
    transition: ${({ theme }) => theme.transitions.fast};
    &:hover {
      border-color: ${({ theme, $clickable }) => $clickable ? theme.colors.primary : theme.colors.border};
    }
  `,

  KPIIcon: styled.div<{ $color: string }>`
    width: 48px;
    height: 48px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ $color }) => `${$color}22`};
    color: ${({ $color }) => $color};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  KPIValue: styled.div`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.2;
  `,

  KPILabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  BottomGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    @media (max-width: 900px) { grid-template-columns: 1fr; }
  `,

  FinancialHeaderControls: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  PeriodGroup: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: 2px;
  `,

  PeriodButton: styled.button<{ $active?: boolean }>`
    background: ${({ $active, theme }) =>
      $active ? theme.colors.primary : 'transparent'};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? '#fff' : theme.colors.textSecondary)};
    cursor: pointer;
    transition: all 0.2s;
    min-width: 36px;

    &:hover {
      background: ${({ $active, theme }) =>
        $active ? theme.colors.primaryHover : theme.colors.surfaceHover};
    }
  `,

  FinancialRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.sm} 0;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    &:last-child { border-bottom: none; }
  `,

  FinancialLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  FinancialValue: styled.div<{ $color: string }>`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ $color }) => $color};
  `,

  DeadlineItem: styled.div<{ $overdue?: boolean; $today?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $overdue, $today }) =>
      $overdue ? 'rgba(239,68,68,0.08)' : $today ? 'rgba(245,158,11,0.08)' : theme.colors.background};
    border: 1px solid ${({ theme, $overdue, $today }) =>
      $overdue ? 'rgba(239,68,68,0.25)' : $today ? 'rgba(245,158,11,0.25)' : theme.colors.border};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    &:hover { border-color: ${({ theme }) => theme.colors.primary}; }
  `,

  DeadlineInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  DeadlineTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  DeadlineSub: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  DaysChip: styled.span<{ $overdue?: boolean; $today?: boolean }>`
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    padding: 1px 7px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: 10px;
    font-weight: 600;
    font-family: ${({ theme }) => theme.fonts.mono};
    white-space: nowrap;
    background: ${({ $overdue, $today, theme }) =>
      $overdue ? `${theme.colors.danger}20` :
      $today ? `${theme.colors.warning}20` :
      theme.colors.surfaceHover};
    color: ${({ $overdue, $today, theme }) =>
      $overdue ? theme.colors.danger :
      $today ? theme.colors.warning :
      theme.colors.textMuted};
    border: 1px solid ${({ $overdue, $today, theme }) =>
      $overdue ? `${theme.colors.danger}44` :
      $today ? `${theme.colors.warning}44` :
      theme.colors.border};
  `,

  PriorityBadge: styled.span<{ $color: string }>`
    display: inline-block;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    padding: 1px 6px;
    border-radius: 4px;
    background: ${({ $color }) => `${$color}22`};
    color: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  DeadlineCaseLink: styled.button`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-family: ${({ theme }) => theme.fonts.mono};
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    transition: ${({ theme }) => theme.transitions.fast};
    &:hover { color: ${({ theme }) => theme.colors.primary}; text-decoration: underline; }
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  EmptyState: styled.div`
    text-align: center;
    padding: ${({ theme }) => theme.spacing.xl};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,
};
