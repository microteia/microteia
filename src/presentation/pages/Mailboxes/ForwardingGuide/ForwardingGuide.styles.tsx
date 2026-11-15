import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.background};
  `,

  Tabs: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Tab: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.border)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.surface)};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    cursor: pointer;
  `,

  Steps: styled.ol`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: 0;
    padding-left: ${({ theme }) => theme.spacing.lg};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.5;
  `,

  Step: styled.li`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Snippet: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
  `,

  Code: styled.code`
    flex: 1;
    min-width: 0;
    padding: ${({ theme }) => `${theme.spacing.xs} ${theme.spacing.sm}`};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  `,

  Note: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.5;
  `,
};
