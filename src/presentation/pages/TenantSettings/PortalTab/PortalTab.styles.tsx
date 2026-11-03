import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  InviteRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr 1fr auto;
    gap: ${({ theme }) => theme.spacing.md};
    align-items: end;

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  ClaimRow: styled.div`
    grid-column: 1 / -1;
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 900px) {
      grid-template-columns: 1fr;
    }
  `,

  Column: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Empty: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

};
