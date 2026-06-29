import styled from 'styled-components';

export const S = {
  Menu: styled.ul`
    position: fixed;
    z-index: 1000;
    min-width: 240px;
    max-width: 320px;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    padding: 4px;
    list-style: none;
    margin: 0;
    animation: mentionFadeIn 120ms ease;

    @keyframes mentionFadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `,

  Header: styled.li`
    padding: 4px 10px 6px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    margin-bottom: 4px;
    list-style: none;
  `,

  Item: styled.li<{ $highlighted: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ $highlighted, theme }) =>
      $highlighted ? theme.colors.primaryLight : 'transparent'};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};
    list-style: none;

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  IconWrap: styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  Text: styled.span`
    display: flex;
    flex-direction: column;
    min-width: 0;
  `,

  Label: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Description: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Shortcut: styled.span`
    margin-left: auto;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    background: ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 2px 6px;
    flex-shrink: 0;
  `,
};
