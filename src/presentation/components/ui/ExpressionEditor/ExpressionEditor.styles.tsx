import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    position: relative;
  `,

  EditorWrapper: styled.div<{ $isValid: boolean | null }>`
    display: flex;
    align-items: flex-start;
    border: 1px solid ${({ theme, $isValid }) =>
      $isValid === false ? theme.colors.danger : theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    padding: 10px 14px;
    gap: 8px;
    transition: all ${({ theme }) => theme.transitions.fast};
    position: relative;

    &:focus-within {
      border-color: ${({ theme, $isValid }) =>
        $isValid === false ? theme.colors.danger : theme.colors.primary};
      box-shadow: 0 0 0 2px ${({ theme, $isValid }) =>
        $isValid === false ? `${theme.colors.danger}15` : `${theme.colors.primary}15`};
    }
  `,

  Brace: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 1rem;
    line-height: 1.6;
    user-select: none;
    flex-shrink: 0;
  `,

  Textarea: styled.textarea`
    flex: 1;
    border: none;
    outline: none;
    resize: vertical;
    background: transparent;
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: 0.875rem;
    line-height: 1.6;
    min-height: 40px;

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
      font-style: italic;
    }

    &::-webkit-scrollbar { width: 4px; }
    &::-webkit-scrollbar-track { background: transparent; }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 2px;
    }
  `,

  StatusIndicator: styled.div<{ $isValid: boolean | null }>`
    position: absolute;
    top: 10px;
    right: 10px;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: ${({ theme, $isValid }) =>
      $isValid === true
        ? theme.colors.success
        : $isValid === false
        ? theme.colors.danger
        : 'transparent'};
    opacity: ${({ $isValid }) => ($isValid === null ? 0 : 1)};
    transition: all ${({ theme }) => theme.transitions.fast};
  `,

  ValidationMessage: styled.div<{ $isError: boolean }>`
    margin-top: 6px;
    font-size: 0.75rem;
    color: ${({ theme, $isError }) =>
      $isError ? theme.colors.danger : theme.colors.success};
    font-family: ${({ theme }) => theme.fonts.body};
  `,

  FunctionRefButton: styled.button`
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 8px;
    padding: 4px 8px;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    font-size: 0.75rem;
    font-weight: 500;
    cursor: pointer;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: all ${({ theme }) => theme.transitions.fast};
    font-family: ${({ theme }) => theme.fonts.body};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,
};
