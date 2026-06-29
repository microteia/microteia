import styled from 'styled-components';
import type { SplitDirection } from '../../../../stores/useWorkspace';

export const S = {
  PanelLeaf: styled.div<{ $active: boolean }>`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    outline: ${({ theme, $active }) =>
      $active ? `1px solid ${theme.colors.primary}40` : '1px solid transparent'};
    outline-offset: -1px;
  `,

  PanelContent: styled.div<{ $noPadding?: boolean }>`
    flex: 1;
    overflow-y: auto;
    overflow-x: hidden;
    padding: ${({ $noPadding, theme }) => ($noPadding ? '0' : theme.spacing.xl)};
    background: ${({ theme }) => theme.colors.background};

    @media (max-width: 768px) {
      padding: ${({ $noPadding, theme }) => ($noPadding ? '0' : theme.spacing.md)};
    }
  `,

  TabPane: styled.div<{ $active: boolean }>`
    display: ${({ $active }) => ($active ? 'contents' : 'none')};
  `,

  EmptyPanel: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    text-align: center;
    padding: ${({ theme }) => theme.spacing.xl};
    user-select: none;
  `,

  EmptyIcon: styled.div`
    font-size: 2.5rem;
    opacity: 0.3;
  `,

  SplitContainer: styled.div<{ $direction: SplitDirection }>`
    display: flex;
    flex-direction: ${({ $direction }) => ($direction === 'horizontal' ? 'row' : 'column')};
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
  `,

  SplitChild: styled.div<{ $flex: number }>`
    flex: ${({ $flex }) => $flex};
    min-width: 0;
    min-height: 0;
    overflow: hidden;
    display: flex;
  `,

  Resizer: styled.div<{ $direction: SplitDirection }>`
    flex-shrink: 0;
    width: ${({ $direction }) => ($direction === 'horizontal' ? '4px' : '100%')};
    height: ${({ $direction }) => ($direction === 'vertical' ? '4px' : '100%')};
    background: ${({ theme }) => theme.colors.border};
    cursor: ${({ $direction }) => ($direction === 'horizontal' ? 'col-resize' : 'row-resize')};
    transition: background ${({ theme }) => theme.transitions.fast};
    z-index: 1;

    &:hover,
    &:active {
      background: ${({ theme }) => theme.colors.primary};
    }
  `,
};
