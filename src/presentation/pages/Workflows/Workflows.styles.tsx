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

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Row: styled.div<{ $clickable?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md};
    cursor: ${({ $clickable = true }) => ($clickable ? 'pointer' : 'default')};
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme, $clickable = true }) => ($clickable ? theme.colors.primary : theme.colors.border)};
    }
  `,

  RowIcon: styled.div`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  RowInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  RowName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  RowEvent: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 2px;
  `,

  EnabledBadge: styled.span<{ $enabled: boolean }>`
    display: inline-flex;
    align-items: center;
    cursor: pointer;
    padding: 3px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    background: ${({ $enabled, theme }) => ($enabled ? `${theme.colors.success}20` : `${theme.colors.danger}20`)};
    color: ${({ $enabled, theme }) => ($enabled ? theme.colors.success : theme.colors.danger)};
    border: 1px solid ${({ $enabled, theme }) => ($enabled ? `${theme.colors.success}44` : `${theme.colors.danger}44`)};
    flex-shrink: 0;
  `,

  DeleteBtn: styled.button`
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    flex-shrink: 0;
    transition: ${({ theme }) => theme.transitions.fast};

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
