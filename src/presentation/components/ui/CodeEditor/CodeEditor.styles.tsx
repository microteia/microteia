import styled from 'styled-components';

export const S = {
  Wrapper: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    background: ${({ theme }) => theme.colors.inputBackground};
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
  `,

  Toggle: styled.label`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    user-select: none;
  `,

  Switch: styled.span<{ $on: boolean }>`
    position: relative;
    width: 32px;
    height: 18px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $on }) => ($on ? theme.colors.primary : theme.colors.border)};
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &::after {
      content: '';
      position: absolute;
      top: 2px;
      left: ${({ $on }) => ($on ? '16px' : '2px')};
      width: 14px;
      height: 14px;
      border-radius: ${({ theme }) => theme.borderRadius.full};
      background: ${({ theme }) => theme.colors.white};
      transition: ${({ theme }) => theme.transitions.fast};
    }
  `,

  HiddenCheckbox: styled.input`
    position: absolute;
    width: 1px;
    height: 1px;
    opacity: 0;
    pointer-events: none;
  `,

  FormatBtn: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  EditorArea: styled.div<{ $minHeight: string }>`
    min-height: ${({ $minHeight }) => $minHeight};
    height: ${({ $minHeight }) => $minHeight};
    resize: vertical;
    overflow: hidden;
  `,

  Loading: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,
};
