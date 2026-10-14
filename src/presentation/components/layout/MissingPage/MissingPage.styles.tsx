import styled from 'styled-components';

export const S = {
  Root: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl};
    text-align: center;
  `,

  Icon: styled.div`
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    color: ${({ theme }) => theme.colors.danger};
    display: flex;
  `,

  Title: styled.h2`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    color: ${({ theme }) => theme.colors.text};
  `,

  Detail: styled.div`
    max-width: 560px;
    text-align: left;
  `,
};
