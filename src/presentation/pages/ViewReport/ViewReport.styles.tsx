import styled from 'styled-components';

export const S = {
  Page: styled.div`
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,
};
