import styled from 'styled-components';

export const S = {
  Root: styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-height: 0;
  `,

  Toolbar: styled.div`
    position: relative;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  HistoryButton: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex: 1;
    min-width: 0;
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    text-align: left;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  HistoryTitle: styled.span`
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  IconButton: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    flex-shrink: 0;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textMuted};

    &:hover:not(:disabled) {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    &:disabled {
      opacity: 0.4;
      cursor: default;
    }
  `,

  HistoryList: styled.ul`
    position: absolute;
    top: 100%;
    left: ${({ theme }) => theme.spacing.sm};
    right: ${({ theme }) => theme.spacing.sm};
    max-height: 320px;
    margin: 0;
    padding: ${({ theme }) => theme.spacing.xs};
    overflow-y: auto;
    list-style: none;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    z-index: 10;
  `,

  HistoryItem: styled.li<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
    font-weight: ${({ $active }) => ($active ? 600 : 400)};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    cursor: pointer;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  HistoryEmpty: styled.li`
    padding: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Messages: styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
  `,

  Banners: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.sm} 0;
  `,

  Empty: styled.div`
    margin: auto 0;
    text-align: center;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  EmptyIcon: styled.div`
    display: flex;
    justify-content: center;
    margin-bottom: ${({ theme }) => theme.spacing.sm};
    color: ${({ theme }) => theme.colors.primary};
  `,

  EmptyTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: ${({ theme }) => theme.spacing.xs};
  `,

  EmptyHint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
  `,

  Status: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Notice: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    border-left: 2px solid ${({ theme }) => theme.colors.border};
  `,

  Approval: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ theme }) => theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.warningLight};
  `,

  ApprovalTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  ApprovalHint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ApprovalCall: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  ApprovalLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  ApprovalInput: styled.pre`
    margin: 0;
    padding: ${({ theme }) => theme.spacing.sm};
    max-height: 200px;
    overflow: auto;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: pre-wrap;
    overflow-wrap: anywhere;
  `,

  ApprovalActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Button: styled.button<{ $primary?: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme, $primary }) => ($primary ? theme.colors.white : theme.colors.text)};
    background: ${({ theme, $primary }) => ($primary ? theme.colors.primary : theme.colors.surface)};
    border: 1px solid ${({ theme, $primary }) => ($primary ? theme.colors.primary : theme.colors.border)};

    &:hover {
      background: ${({ theme, $primary }) => ($primary ? theme.colors.primaryHover : theme.colors.surfaceHover)};
    }
  `,
};
