import styled from 'styled-components';

const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 8px 0 14px;
  height: 38px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ $active }) => ($active ? '600' : '400')};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
  background: ${({ theme, $active }) => ($active ? theme.colors.background : 'transparent')};
  border-right: 1px solid ${({ theme }) => theme.colors.border};
  border-bottom: ${({ theme, $active }) =>
    $active ? `2px solid ${theme.colors.primary}` : '2px solid transparent'};
  white-space: nowrap;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.transitions.fast},
              color ${({ theme }) => theme.transitions.fast};
  cursor: pointer;
  position: relative;

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.text};
  }

  &:hover .tab-close {
    opacity: 1;
  }

  svg.tab-icon { flex-shrink: 0; }
`;

export const S = {
  Bar: styled.div`
    display: flex;
    align-items: stretch;
    background: ${({ theme }) => theme.colors.surface};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    min-height: 38px;
  `,

  TabList: styled.div`
    display: flex;
    align-items: stretch;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: ${({ theme }) => theme.colors.border} transparent;

    &::-webkit-scrollbar {
      height: 3px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.border};
      border-radius: 2px;
    }
  `,

  PanelCloseBtn: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    margin: auto ${({ theme }) => theme.spacing.xs};
    flex-shrink: 0;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    transition: background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.dangerLight};
      color: ${({ theme }) => theme.colors.danger};
    }
  `,

  Tab,

  TabTitle: styled.span`
    max-width: 140px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  CloseBtn: styled.span.attrs({ className: 'tab-close' })<{ $active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 18px;
    height: 18px;
    border-radius: 3px;
    color: ${({ theme }) => theme.colors.textMuted};
    opacity: ${({ $active }) => ($active ? '1' : '0')};
    transition: opacity ${({ theme }) => theme.transitions.fast},
                background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover {
      background: ${({ theme }) => theme.colors.border};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  ContextMenu: styled.div`
    position: fixed;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    z-index: 9999;
    min-width: 190px;
    padding: 4px 0;
    overflow: hidden;
  `,

  ContextItem: styled.button<{ $danger?: boolean }>`
    display: flex;
    align-items: center;
    gap: 10px;
    width: 100%;
    padding: 8px 14px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textSecondary)};
    text-align: left;
    transition: background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme, $danger }) =>
        $danger ? `${theme.colors.danger}15` : theme.colors.surfaceHover};
      color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.text)};
    }
  `,

  ContextSeparator: styled.div`
    height: 1px;
    background: ${({ theme }) => theme.colors.border};
    margin: 4px 0;
  `,
};
