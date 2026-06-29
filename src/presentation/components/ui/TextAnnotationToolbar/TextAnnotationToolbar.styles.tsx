import styled, { keyframes } from 'styled-components';
import type { AnnotationHighlightColor } from '../../../../domain/entities';

const fadeIn = keyframes`
  from { opacity: 0; transform: translate(-50%, -90%); }
  to   { opacity: 1; transform: translate(-50%, -100%); }
`;

export const S = {
  Toolbar: styled.div<{ $x: number; $y: number }>`
    position: fixed;
    left: ${({ $x }) => $x}px;
    top: ${({ $y }) => $y - 8}px;
    transform: translate(-50%, -100%);
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 5px 8px;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 4px 16px ${({ theme }) => theme.colors.shadow};
    z-index: 9999;
    animation: ${fadeIn} ${({ theme }) => theme.transitions.fast} forwards;
    pointer-events: all;
  `,

  Divider: styled.div`
    width: 1px;
    height: 20px;
    background: ${({ theme }) => theme.colors.border};
    margin: 0 4px;
  `,

  FormatButton: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 700;
    color: ${({ theme, $active }) =>
      $active ? theme.colors.primary : theme.colors.textSecondary};
    background: ${({ theme, $active }) =>
      $active ? theme.colors.primaryLight : 'transparent'};
    transition: background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  HighlightButton: styled.button<{ $color: AnnotationHighlightColor; $active?: boolean }>`
    width: 18px;
    height: 18px;
    border-radius: 50%;
    background: ${({ theme, $color }) =>
      (theme.highlights as Record<string, string>)[$color]};
    border: 2px solid ${({ theme, $active, $color }) =>
      $active
        ? theme.colors.primary
        : (theme.highlights as Record<string, string>)[$color]};
    transition: transform ${({ theme }) => theme.transitions.fast},
                border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      transform: scale(1.2);
    }
  `,
};
