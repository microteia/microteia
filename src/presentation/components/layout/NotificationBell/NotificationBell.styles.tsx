import styled, { keyframes } from 'styled-components';

const panelOpen = keyframes`
  from { opacity: 0; transform: translateY(-6px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

export const S = {
  Wrapper: styled.div`
    position: relative;
    display: flex;
    align-items: center;
  `,

  BellButton: styled.button<{ $active: boolean }>`
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    width: 34px;
    height: 34px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Badge: styled.span`
    position: absolute;
    top: 2px;
    right: 1px;
    min-width: 16px;
    height: 16px;
    padding: 0 4px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.danger};
    color: ${({ theme }) => theme.colors.white};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    line-height: 16px;
    text-align: center;
  `,

  Panel: styled.div`
    position: absolute;
    top: calc(100% + 6px);
    right: 0;
    width: 360px;
    max-width: calc(100vw - ${({ theme }) => theme.spacing.lg});
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    overflow: hidden;
    z-index: 1000;
    animation: ${panelOpen} 150ms ease;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  HeaderTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  HeaderAction: styled.button`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
    white-space: nowrap;

    &:hover:not(:disabled) {
      text-decoration: underline;
    }

    &:disabled {
      opacity: 0.6;
      cursor: default;
    }
  `,

  List: styled.div`
    max-height: 420px;
    overflow-y: auto;
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.md};
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Item: styled.button<{ $unread: boolean; $clickable: boolean }>`
    position: relative;
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    text-align: left;
    background: ${({ theme, $unread }) => ($unread ? theme.colors.primaryLight : 'transparent')};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    cursor: ${({ $clickable, $unread }) => ($clickable || $unread ? 'pointer' : 'default')};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  UnreadDot: styled.span`
    position: absolute;
    top: 14px;
    left: 6px;
    width: 6px;
    height: 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
  `,

  ItemBody: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  ItemTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    overflow-wrap: anywhere;
  `,

  ItemMessage: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  ItemWhen: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  SeeAll: styled.button`
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
    text-align: center;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Footer: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,

  FooterText: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
