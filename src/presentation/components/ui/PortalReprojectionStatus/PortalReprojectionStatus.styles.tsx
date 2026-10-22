import styled from 'styled-components';

export const S = {
  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
