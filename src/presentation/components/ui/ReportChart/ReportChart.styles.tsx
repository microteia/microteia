import styled from 'styled-components';

export const S = {
  Frame: styled.div`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    padding: ${({ theme }) => theme.spacing.md};
  `,
};
