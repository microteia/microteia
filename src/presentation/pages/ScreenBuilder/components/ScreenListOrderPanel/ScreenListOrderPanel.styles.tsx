import styled from 'styled-components';

export const S = {
  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    grid-column: 1 / -1;
  `,

  SectionTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Hint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.5;
  `,

  KeyRow: styled.div`
    display: grid;
    grid-template-columns: 2fr 1fr auto;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};

    @media (max-width: 640px) {
      grid-template-columns: 1fr auto;
    }
  `,

  RemoveButton: styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xs};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    background: transparent;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerLight};
      color: ${({ theme }) => theme.colors.danger};
    }
  `,

  Actions: styled.div`
    display: flex;
  `,
};
