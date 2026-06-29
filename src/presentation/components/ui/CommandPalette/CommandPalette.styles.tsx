import styled, { keyframes } from 'styled-components';

const fadeIn = keyframes`
  from { opacity: 0; }
  to   { opacity: 1; }
`;

const slideDown = keyframes`
  from { opacity: 0; transform: translateY(-12px) scale(0.98); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
`;

export const S = {
  Overlay: styled.div`
    position: fixed;
    inset: 0;
    z-index: 9999;
    background: ${({ theme }) => theme.colors.overlay};
    display: flex;
    align-items: flex-start;
    justify-content: center;
    padding-top: 10vh;
    animation: ${fadeIn} ${({ theme }) => theme.transitions.fast};
  `,

  Dialog: styled.div`
    width: 100%;
    max-width: 620px;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    box-shadow: 0 24px 48px ${({ theme }) => theme.colors.shadow};
    overflow: hidden;
    animation: ${slideDown} ${({ theme }) => theme.transitions.fast};
    display: flex;
    flex-direction: column;
    max-height: 70vh;
  `,

  InputRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  SearchIcon: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    flex-shrink: 0;
  `,

  Input: styled.input`
    flex: 1;
    background: transparent;
    border: none;
    outline: none;
    font-family: ${({ theme }) => theme.fonts.body};
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  `,

  KbdHint: styled.kbd`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 2px 6px;
    flex-shrink: 0;
  `,

  Results: styled.div`
    overflow-y: auto;
    flex: 1;
    padding: ${({ theme }) => theme.spacing.sm} 0;
    &::-webkit-scrollbar {
      width: 6px;
    }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: 3px;
    }
  `,

  GroupHeader: styled.div`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    letter-spacing: 0.06em;
    text-transform: uppercase;
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  Item: styled.div<{ $selected: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    cursor: pointer;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    margin: 1px ${({ theme }) => theme.spacing.sm};
    background: ${({ theme, $selected }) =>
      $selected ? theme.colors.primaryLight : 'transparent'};
    transition: background ${({ theme }) => theme.transitions.fast};
    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  ItemIcon: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    display: flex;
    align-items: center;
    flex-shrink: 0;
  `,

  ItemText: styled.div`
    flex: 1;
    min-width: 0;
  `,

  ItemTitle: styled.span`
    display: block;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  ItemSubtitle: styled.span`
    display: block;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  Footer: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.md};
    align-items: center;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  FooterKey: styled.kbd`
    font-family: ${({ theme }) => theme.fonts.mono};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 1px 5px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,
};
