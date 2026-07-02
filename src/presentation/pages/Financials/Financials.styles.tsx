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
    gap: ${({ theme }) => theme.spacing.md};
  `,

  HeaderLeft: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  SummaryBar: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  SummaryCard: styled.div<{ $color?: string }>`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ $color, theme }) => $color ?? theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  SummaryLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-weight: 500;
    text-transform: uppercase;
    letter-spacing: 0.05em;
  `,

  SummaryValue: styled.div<{ $color?: string }>`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ $color, theme }) => $color ?? theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,

  Toolbar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    flex-wrap: wrap;
    align-items: center;
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  FinancialCard: styled.div`
    position: relative;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    overflow: hidden;

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      box-shadow: 0 4px 16px ${({ theme }) => `${theme.colors.primary}15`};
      transform: translateY(-1px);
    }

    &:hover .financial-complete-btn,
    &:hover .financial-delete-btn {
      opacity: 1;
      pointer-events: auto;
    }
  `,

  CardHeader: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-right: ${({ theme }) => theme.spacing.xl};
  `,

  CardTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
  `,

  Badges: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    align-items: center;
  `,

  CardMeta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding-top: ${({ theme }) => theme.spacing.xs};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
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

  MetaLink: styled.button`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
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

  BottomRow: styled.div`
    display: flex;
    justify-content: flex-end;
    padding-top: ${({ theme }) => theme.spacing.xs};
  `,

  Amount: styled.div<{ $type: 'income' | 'expense' }>`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 700;
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme, $type }) => $type === 'income' ? theme.colors.success : theme.colors.danger};
    white-space: nowrap;
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
