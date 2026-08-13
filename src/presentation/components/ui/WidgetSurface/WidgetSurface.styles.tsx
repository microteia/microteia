import styled from 'styled-components';

export const S = {
  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: ${({ theme }) => theme.spacing.md};
    align-items: start;

    @media (max-width: 1100px) { grid-template-columns: repeat(2, 1fr); }
    @media (max-width: 760px)  { grid-template-columns: 1fr; }
  `,

  Slot: styled.div<{ $span: number }>`
    grid-column: span ${({ $span }) => $span};
    min-width: 0;

    @media (max-width: 1100px) { grid-column: span ${({ $span }) => Math.min($span, 2)}; }
    @media (max-width: 760px)  { grid-column: span 1; }
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  Failure: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,
};
