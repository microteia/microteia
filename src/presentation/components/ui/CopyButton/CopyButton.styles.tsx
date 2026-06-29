import styled from 'styled-components';

export const S = {
  Button: styled.button<{ $copied: boolean }>`
    position: absolute;
    top: 10px;
    right: 10px;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    color: ${({ $copied, theme }) => ($copied ? theme.colors.success : theme.colors.textSecondary)};
    opacity: 0.7;
    transition: opacity ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast},
                background ${({ theme }) => theme.transitions.fast};
    z-index: 1;
    &:hover {
      opacity: 1;
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
};
