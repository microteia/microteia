import styled from 'styled-components';

export const S = {
  Wrapper: styled.div`
    position: relative;
    padding: ${({ theme }) => theme.spacing.sm};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  Box: styled.div`
    display: flex;
    align-items: flex-end;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.inputBackground};
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:focus-within {
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Input: styled.textarea`
    flex: 1;
    min-height: 24px;
    max-height: 200px;
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border: none;
    outline: none;
    resize: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font-family: inherit;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  `,

  Action: styled.button<{ $stop: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.white};
    background: ${({ theme, $stop }) => ($stop ? theme.colors.danger : theme.colors.primary)};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme, $stop }) => ($stop ? theme.colors.danger : theme.colors.primaryHover)};
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `,

  Suggestions: styled.ul`
    position: absolute;
    left: ${({ theme }) => theme.spacing.sm};
    right: ${({ theme }) => theme.spacing.sm};
    bottom: calc(100% - ${({ theme }) => theme.spacing.xs});
    margin: 0;
    padding: ${({ theme }) => theme.spacing.xs};
    list-style: none;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    z-index: 5;
  `,

  Suggestion: styled.li`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  CommandName: styled.span`
    font-family: ${({ theme }) => theme.fonts.mono};
    color: ${({ theme }) => theme.colors.primary};
  `,

  CommandDescription: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
};
