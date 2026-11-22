import styled from 'styled-components';

export const S = {
  Editor: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    min-width: 0;
  `,

  Toolbar: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ModeSwitch: styled.div`
    display: inline-flex;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
  `,

  ModeButton: styled.button<{ $active: boolean }>`
    border: none;
    cursor: pointer;
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.md}`};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.surface : 'transparent')};
  `,

  ToolbarActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  IconButton: styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing.xs};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    &:disabled {
      cursor: not-allowed;
      opacity: 0.4;
    }
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Actions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Hint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
