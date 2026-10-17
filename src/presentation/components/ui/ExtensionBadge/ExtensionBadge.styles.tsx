import styled from 'styled-components';

export const S = {
  Badge: styled.span`
    flex-shrink: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.primary};
    border: 1px solid ${({ theme }) => theme.colors.primary};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 1px 10px;
    white-space: nowrap;
  `,
};
