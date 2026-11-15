import styled from 'styled-components';

export const S = {
  Button: styled.button<{ $copied: boolean; $inline: boolean }>`
    position: ${({ $inline }) => ($inline ? 'static' : 'absolute')};
    top: 10px;
    right: 10px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: center;
    width: ${({ $inline }) => ($inline ? '24px' : '30px')};
    height: ${({ $inline }) => ($inline ? '24px' : '30px')};
    cursor: pointer;
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
