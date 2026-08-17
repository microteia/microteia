import styled from 'styled-components';
import type { SplitDirection } from '../../../../stores/useWorkspace';

export const S = {
  PanelLeaf: styled.div`
    display: flex;
    flex-direction: column;
    flex: 1;
    min-width: 0;
    min-height: 0;
    overflow: hidden;
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

  PageLoading: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    height: 100%;
    padding: ${({ theme }) => theme.spacing.xl};
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

  /**
   * A área de agarre e a linha visível deixam de ser a mesma coisa: o alvo do mouse cresce de 4px
   * para 7px enquanto o traço cai para 1px. Antes os dois estavam presos no mesmo elemento, então
   * afinar a linha significava piorar o agarre — e 4px já era estreito para arrastar.
   */
  Resizer: styled.div<{ $direction: SplitDirection }>`
    flex-shrink: 0;
    position: relative;
    background: transparent;
    width: ${({ $direction }) => ($direction === 'horizontal' ? '7px' : '100%')};
    height: ${({ $direction }) => ($direction === 'vertical' ? '7px' : '100%')};
    cursor: ${({ $direction }) => ($direction === 'horizontal' ? 'col-resize' : 'row-resize')};
    z-index: 1;

    &::after {
      content: '';
      position: absolute;
      background: ${({ theme }) => theme.colors.borderSubtle};
      transition: background ${({ theme }) => theme.transitions.fast};
      ${({ $direction }) =>
        $direction === 'horizontal'
          ? 'top: 0; bottom: 0; left: 3px; width: 1px;'
          : 'left: 0; right: 0; top: 3px; height: 1px;'}
    }

    &:hover::after,
    &:active::after {
      background: ${({ theme }) => theme.colors.primary};
      ${({ $direction }) =>
        $direction === 'horizontal' ? 'left: 2px; width: 3px;' : 'top: 2px; height: 3px;'}
    }
  `,
};
