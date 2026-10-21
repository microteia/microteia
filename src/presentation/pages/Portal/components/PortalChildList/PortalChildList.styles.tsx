import styled from 'styled-components';

/** O filtro e o "+" numa linha; abaixo, linhas compactas — dentro do registro aberto, não cartões soltos. */
export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  FilterSlot: styled.div`
    flex: 1;
    min-width: 0;
  `,

  Note: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  `,

  Row: styled.button`
    display: flex;
    flex-direction: column;
    gap: 2px;
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    text-align: left;
    color: ${({ theme }) => theme.colors.text};
    transition: background ${({ theme }) => theme.transitions.fast};

    & + & {
      border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    }

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  RowTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
  `,

  RowMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.lg} 0;
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
