import styled from 'styled-components';

export const S = {
  Wrapper: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,
  Header: styled.div`
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,
  Title: styled.h2`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,
  Description: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
  Meta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-variant-numeric: tabular-nums;
  `,
  Actions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: center;
  `,
  /** A barra dos filtros que o leitor preenche. Some da impressão: no papel vale o resultado. */
  Prompts: styled.form`
    display: flex;
    flex-wrap: wrap;
    align-items: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,
  PromptField: styled.label`
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1 1 180px;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
  Loading: styled.p`
    margin: 0;
    padding: 32px 0;
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
