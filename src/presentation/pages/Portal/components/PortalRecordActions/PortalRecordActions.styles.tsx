import styled from 'styled-components';

export const S = {
  Bar: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
