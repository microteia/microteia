import styled from 'styled-components';

export const S = {
  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,
  Field: styled.label`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
  Row: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};

    & > * {
      flex: 1 1 160px;
      min-width: 0;
    }
  `,
  /** O alerta é opcional: fica recuado sob a caixa que o liga, para ler como condição dela. */
  Alert: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,
};
