import styled from 'styled-components';

export const S = {
  CodeBlock: styled.div`
    position: relative;

    & > pre {
      padding-right: ${({ theme }) => theme.spacing.xl};
    }
  `,

  CopyCorner: styled.div`
    position: absolute;
    top: ${({ theme }) => theme.spacing.xs};
    right: ${({ theme }) => theme.spacing.xs};
    opacity: 0.6;
    transition: opacity ${({ theme }) => theme.transitions.fast};

    &:hover {
      opacity: 1;
    }
  `,
};
