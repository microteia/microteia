import styled from 'styled-components';

export const S = {
  Fallback: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
    height: 100%;
    min-height: 320px;
    padding: ${({ theme }) => theme.spacing.xl};
    text-align: center;
    color: ${({ theme }) => theme.colors.danger};
  `,

  Title: styled.h2`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    color: ${({ theme }) => theme.colors.text};
  `,

  Text: styled.p`
    margin: 0 0 ${({ theme }) => theme.spacing.sm} 0;
    max-width: 420px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
};
