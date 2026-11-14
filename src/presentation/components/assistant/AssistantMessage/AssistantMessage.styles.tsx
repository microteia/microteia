import styled, { css, keyframes } from 'styled-components';

const blink = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
`;

const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const S = {
  UserRow: styled.div`
    display: flex;
    justify-content: flex-end;
  `,

  UserBubble: styled.div`
    max-width: 88%;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  `,

  Answer: styled.div<{ $streaming: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.6;
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;

    & > *:first-child { margin-top: 0; }
    & > *:last-child { margin-bottom: 0; }

    p, ul, ol, pre, table, blockquote {
      margin: ${({ theme }) => theme.spacing.sm} 0;
    }

    ul, ol {
      padding-left: ${({ theme }) => theme.spacing.lg};
    }

    li + li {
      margin-top: ${({ theme }) => theme.spacing.xs};
    }

    h1, h2, h3, h4 {
      margin: ${({ theme }) => theme.spacing.md} 0 ${({ theme }) => theme.spacing.xs};
      font-size: ${({ theme }) => theme.fontSizes.md};
      font-weight: 600;
    }

    code {
      font-family: ${({ theme }) => theme.fonts.mono};
      font-size: ${({ theme }) => theme.fontSizes.xs};
      padding: 1px ${({ theme }) => theme.spacing.xs};
      border-radius: ${({ theme }) => theme.borderRadius.sm};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    pre {
      padding: ${({ theme }) => theme.spacing.sm};
      border-radius: ${({ theme }) => theme.borderRadius.md};
      background: ${({ theme }) => theme.colors.background};
      border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
      overflow-x: auto;
    }

    pre code {
      padding: 0;
      background: transparent;
    }

    blockquote {
      padding-left: ${({ theme }) => theme.spacing.sm};
      border-left: 3px solid ${({ theme }) => theme.colors.border};
      color: ${({ theme }) => theme.colors.textSecondary};
    }

    table {
      display: block;
      max-width: 100%;
      overflow-x: auto;
      border-collapse: collapse;
      font-size: ${({ theme }) => theme.fontSizes.xs};
    }

    th, td {
      padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
      border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
      text-align: left;
      vertical-align: top;
    }

    th {
      background: ${({ theme }) => theme.colors.surfaceHover};
      font-weight: 600;
    }

    ${({ $streaming }) => $streaming && css`
      & > *:last-child::after {
        content: '';
        display: inline-block;
        width: 6px;
        height: 1em;
        margin-left: 2px;
        vertical-align: text-bottom;
        background: ${({ theme }) => theme.colors.primary};
        animation: ${blink} 1s step-start infinite;
      }
    `}
  `,

  Note: styled.div`
    margin-top: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
  `,

  Collapsible: styled.details`
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.background};
    font-size: ${({ theme }) => theme.fontSizes.xs};

    &[open] > summary {
      border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    }
  `,

  Summary: styled.summary`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    cursor: pointer;
    color: ${({ theme }) => theme.colors.textSecondary};
    list-style: none;

    &::-webkit-details-marker { display: none; }
  `,

  ToolName: styled.span`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-weight: 500;
  `,

  Status: styled.span<{ $tone: 'muted' | 'success' | 'danger' | 'warning' | 'primary' }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    color: ${({ theme, $tone }) => ({
      muted: theme.colors.textMuted,
      success: theme.colors.success,
      danger: theme.colors.danger,
      warning: theme.colors.warning,
      primary: theme.colors.primary,
    })[$tone]};
  `,

  Spin: styled.span`
    display: inline-flex;
    animation: ${spin} 1s linear infinite;
  `,

  Code: styled.pre`
    margin: 0;
    padding: ${({ theme }) => theme.spacing.sm};
    max-height: 220px;
    overflow: auto;
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  `,

  SummaryBody: styled.div`
    padding: ${({ theme }) => theme.spacing.sm};
  `,
};
