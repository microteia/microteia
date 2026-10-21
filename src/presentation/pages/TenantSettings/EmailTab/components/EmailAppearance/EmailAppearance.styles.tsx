import styled from 'styled-components';

/** Os campos de um lado, o e-mail como vai chegar do outro — empilhados quando não cabem. */
export const S = {
  Layout: styled.div`
    display: grid;
    grid-template-columns: minmax(260px, 1fr) minmax(300px, 1.1fr);
    gap: ${({ theme }) => theme.spacing.lg};
    align-items: start;

    @media (max-width: 1100px) {
      grid-template-columns: 1fr;
    }
  `,

  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Label: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Hint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.45;
  `,

  ColorRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  DefaultChip: styled.button<{ $active: boolean }>`
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
  `,

  Preview: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    position: sticky;
    top: 0;
  `,

  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
