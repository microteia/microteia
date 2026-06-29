import styled from 'styled-components';

export const S = {
  Link: styled.a`
    color: ${({ theme }) => theme.colors.primary};
    text-decoration: underline;
    text-decoration-color: ${({ theme }) => theme.colors.primary};
    text-underline-offset: 2px;
    cursor: pointer;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    &:hover {
      opacity: 0.75;
    }
  `,
};
