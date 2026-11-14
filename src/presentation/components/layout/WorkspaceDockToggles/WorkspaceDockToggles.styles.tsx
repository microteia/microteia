import styled from 'styled-components';

export const S = {
  Row: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Button: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
};
