import styled from 'styled-components';

export const S = {
  Chip: styled.button<{ $color: string; $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    background: transparent;
    border: ${({ $active, $color }) => ($active ? 'none' : `1px solid ${$color}`)};
    border-left: 3px solid ${({ $color }) => $color};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: ${({ theme, $active }) =>
      $active ? `${theme.spacing.xs} ${theme.spacing.sm} ${theme.spacing.xs} calc(${theme.spacing.sm} + 2px)` : `${theme.spacing.xs} ${theme.spacing.sm}`};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? theme.colors.text : 'inherit')};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    opacity: ${({ $active }) => ($active ? 1 : 0.5)};

    &:hover {
      opacity: 1;
      background: ${({ $active, $color, theme }) => ($active ? theme.colors.surfaceHover : $color)};
      color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.white)};
    }
  `,
};
