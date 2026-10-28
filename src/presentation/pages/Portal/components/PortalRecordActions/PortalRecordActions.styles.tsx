import styled from 'styled-components';

export const S = {
  Box: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Bar: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Feedback: styled.p<{ $tone: 'success' | 'warning' | 'error' }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $tone }) => ($tone === 'success'
      ? theme.colors.success
      : $tone === 'warning' ? theme.colors.warning : theme.colors.danger)};
  `,
};
