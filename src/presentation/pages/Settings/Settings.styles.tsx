import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  TitleRow: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  ScopeTabs: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  ScopeTab: styled.button<{ $active: boolean }>`
    background: none;
    border: none;
    border-bottom: 2px solid ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
    color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: ${({ $active }) => ($active ? 600 : 400)};
    padding: ${({ theme }) => theme.spacing.xs} 0;
    cursor: pointer;

    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  Body: styled.div`
    flex: 1;
    display: flex;
    min-height: 0;
  `,

  Nav: styled.nav`
    width: 240px;
    flex-shrink: 0;
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    padding: ${({ theme }) => theme.spacing.md};
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  NavItem: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    text-align: left;
    background: ${({ $active, theme }) => ($active ? theme.colors.surfaceHover : 'transparent')};
    color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;

    &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    min-width: 0;
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  SectionDescription: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Property: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding-bottom: ${({ theme }) => theme.spacing.lg};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};

    &:last-child { border-bottom: none; }
  `,

  PropertyHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  PropertyLabel: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  PropertyPath: styled.span`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Tag: styled.span<{ $tone?: 'muted' | 'primary' }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    padding: 1px 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme, $tone }) =>
      $tone === 'primary' ? theme.colors.primaryLight : theme.colors.surfaceHover};
    color: ${({ theme, $tone }) =>
      $tone === 'primary' ? theme.colors.primary : theme.colors.textMuted};
  `,

  PropertyDescription: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  PropertyControl: styled.div`
    max-width: 640px;
    padding-top: ${({ theme }) => theme.spacing.xs};
  `,

  ResetButton: styled.button`
    background: none;
    border: none;
    padding: 0;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;

    &:hover { text-decoration: underline; }
  `,

  JsonPane: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    flex: 1;
    min-height: 0;
  `,

  JsonActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  JsonIssues: styled.ul`
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.danger};
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  SearchWrapper: styled.div`
    max-width: 520px;
    width: 100%;
  `,
};
