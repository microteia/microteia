import styled, { keyframes, css } from 'styled-components';

const shimmer = keyframes`
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
`;

export const S = {
  Container: styled.div<{ $size: number; $showBorder: boolean }>`
    width: ${({ $size }) => $size}px;
    height: ${({ $size }) => $size}px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    flex-shrink: 0;
    position: relative;
    overflow: hidden;
    background: ${({ theme }) => theme.colors.primaryLight};
    display: flex;
    align-items: center;
    justify-content: center;
    ${({ $showBorder, theme }) =>
      $showBorder &&
      css`
        border: 2px solid ${theme.colors.primary};
      `}
  `,

  Image: styled.img<{ $visible: boolean }>`
    width: 100%;
    height: 100%;
    object-fit: cover;
    border-radius: inherit;
    display: block;
    opacity: ${({ $visible }) => ($visible ? 1 : 0)};
    transition: opacity 200ms ease;
  `,

  Skeleton: styled.div`
    position: absolute;
    inset: 0;
    background: linear-gradient(
      90deg,
      ${({ theme }) => theme.colors.primaryLight} 25%,
      ${({ theme }) => theme.colors.border} 50%,
      ${({ theme }) => theme.colors.primaryLight} 75%
    );
    background-size: 200% 100%;
    animation: ${shimmer} 1.2s infinite linear;
  `,

  Initial: styled.span<{ $size: number }>`
    font-size: ${({ $size }) => Math.round($size * 0.4)}px;
    font-weight: 700;
    color: ${({ theme }) => theme.colors.primary};
    user-select: none;
    line-height: 1;
  `,
};
