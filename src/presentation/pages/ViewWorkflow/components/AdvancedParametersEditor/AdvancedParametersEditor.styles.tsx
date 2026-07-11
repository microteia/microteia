import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Toolbar: styled.div`
    display: inline-flex;
    align-self: flex-start;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 3px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
  `,

  ModeBtn: styled.button<{ $active?: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    background: ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.white : theme.colors.textSecondary)};

    &:hover {
      color: ${({ theme, $active }) => ($active ? theme.colors.white : theme.colors.text)};
    }
  `,

  Hint: styled.p`
    margin: 0;
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  Loading: styled.div`
    padding: ${({ theme }) => theme.spacing.lg};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  ErrorBox: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.danger};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.dangerLight};
  `,

  ErrorLine: styled.span`
    color: ${({ theme }) => theme.colors.danger};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,

  ApplyBtn: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    align-self: flex-start;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      opacity: 0.9;
    }
  `,
};
