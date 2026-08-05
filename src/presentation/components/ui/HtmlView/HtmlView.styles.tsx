import styled from 'styled-components';

export const S = {
  Frame: styled.iframe<{ $height: number }>`
    display: block;
    width: 100%;
    height: ${({ $height }) => $height}px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    color-scheme: normal;
  `,
};
