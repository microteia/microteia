import styled from 'styled-components';

export const S = {
  Panel: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    min-width: 0;
  `,

  Heading: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Title: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Arrangement: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.xl}`};
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
  `,

  SectionTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Hint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  PreviewHeader: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  PreviewPicker: styled.div`
    flex: 0 1 ${({ theme }) => theme.listCard.minWidth.sm};
    min-width: 0;
  `,

  Preview: styled.div`
    max-width: ${({ theme }) => theme.listCard.minWidth.lg};
  `,
};
