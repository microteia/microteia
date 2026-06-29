import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Toolbar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    flex-wrap: wrap;
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  DeadlineCard: styled.div`
    position: relative;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    display: flex;
    flex-direction: column;
    gap: 0;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    overflow: hidden;

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      box-shadow: 0 4px 16px ${({ theme }) => `${theme.colors.primary}15`};
      transform: translateY(-1px);
    }

    &:hover .deadline-delete-btn,
    &:hover .deadline-complete-btn {
      opacity: 1;
      pointer-events: auto;
    }
  `,

  PriorityBar: styled.div<{ $color: string }>`
    height: 3px;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  CardBody: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CardTop: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CardAvatar: styled.div<{ $color: string }>`
    width: 42px;
    height: 42px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ $color }) => `${$color}20`};
    border: 1px solid ${({ $color }) => `${$color}44`};
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ $color }) => $color};
    font-size: 20px;
    flex-shrink: 0;
  `,

  CardInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  CardType: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  CardCaseRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: 2px;
    min-width: 0;
  `,

  CardCaseNumber: styled.button`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-family: ${({ theme }) => theme.fonts.mono};
    background: none;
    border: none;
    padding: 0;
    cursor: pointer;
    text-align: left;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover { color: ${({ theme }) => theme.colors.primary}; text-decoration: underline; }
  `,

  DaysChip: styled.span<{ $overdue?: boolean; $today?: boolean; $completed?: boolean }>`
    display: inline-flex;
    align-items: center;
    flex-shrink: 0;
    margin-left: auto;
    padding: 1px 7px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: 10px;
    font-weight: 600;
    font-family: ${({ theme }) => theme.fonts.mono};
    white-space: nowrap;
    background: ${({ $overdue, $today, $completed, theme }) =>
      $completed ? `${theme.colors.success}20` :
      $overdue ? `${theme.colors.danger}20` :
      $today ? `${theme.colors.warning}20` :
      theme.colors.surfaceHover};
    color: ${({ $overdue, $today, $completed, theme }) =>
      $completed ? theme.colors.success :
      $overdue ? theme.colors.danger :
      $today ? theme.colors.warning :
      theme.colors.textMuted};
    border: 1px solid ${({ $overdue, $today, $completed, theme }) =>
      $completed ? `${theme.colors.success}44` :
      $overdue ? `${theme.colors.danger}44` :
      $today ? `${theme.colors.warning}44` :
      theme.colors.border};
  `,

  CardDivider: styled.div`
    height: 1px;
    background: ${({ theme }) => theme.colors.border};
    margin: 0;
  `,

  CardMeta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    flex-direction: column;
    gap: 3px;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  `,

  MetaRow: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
  `,

  MetaText: styled.span`
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  MetaBadge: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    padding: 1px 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: 10px;
    font-weight: 500;
    background: ${({ $color }) => `${$color}20`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}40`};
    flex-shrink: 0;
  `,

  CompleteBtn: styled.button`
    position: absolute;
    top: ${({ theme }) => theme.spacing.sm};
    right: calc(${({ theme }) => theme.spacing.sm} + 34px);
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: ${({ theme }) => theme.transitions.fast};
    z-index: 1;

    &:hover {
      background: ${({ theme }) => theme.colors.success};
      color: #fff;
      border-color: ${({ theme }) => theme.colors.success};
    }
  `,

  DeleteBtn: styled.button`
    position: absolute;
    top: ${({ theme }) => theme.spacing.sm};
    right: ${({ theme }) => theme.spacing.sm};
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    opacity: 0;
    pointer-events: none;
    transition: ${({ theme }) => theme.transitions.fast};
    z-index: 1;

    &:hover {
      background: ${({ theme }) => theme.colors.danger};
      color: #fff;
      border-color: ${({ theme }) => theme.colors.danger};
    }
  `,

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing['2xl']};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  EmptyIcon: styled.div`
    font-size: 48px;
    opacity: 0.3;
  `,

  EmptyTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,
};
