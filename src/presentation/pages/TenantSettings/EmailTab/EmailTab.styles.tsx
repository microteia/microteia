import styled from 'styled-components';

export const S = {
  Container: styled.div`
    max-width: 1180px;
  `,

  Intro: styled.div`
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    max-width: 64ch;
  `,

  Title: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Description: styled.p`
    margin-top: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    line-height: 1.5;
  `,
};
