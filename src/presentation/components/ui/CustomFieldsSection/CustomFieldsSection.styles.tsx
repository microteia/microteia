import styled from 'styled-components';

export const S = {
  Wrapper: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    padding-bottom: ${({ theme }) => theme.spacing.xs};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,

  FormGroup: styled.div<{ $fullWidth?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: 6px;
    ${({ $fullWidth }) => $fullWidth && 'grid-column: 1 / -1;'}
  `,

  FieldError: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.danger};
  `,
};
