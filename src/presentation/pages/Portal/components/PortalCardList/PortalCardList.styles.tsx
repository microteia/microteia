import styled, { css } from 'styled-components';
import type { CardLayout, CardWidth } from '../../../../../domain/schema/ui/cardTemplate';

/** A lista de cartões declarada: um por linha ou em grade, com a faixa colorida quando há. */
export const S = {
  List: styled.div<{ $layout: CardLayout; $minWidth: CardWidth }>`
    display: grid;
    gap: ${({ theme }) => theme.spacing.sm};
    grid-template-columns: ${({ theme, $layout, $minWidth }) => ($layout === 'grid'
    ? `repeat(auto-fill, minmax(min(100%, ${theme.listCard.minWidth[$minWidth]}), 1fr))`
    : 'minmax(0, 1fr)')};
  `,

  Card: styled.button<{ $accent?: string }>`
    position: relative;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    width: 100%;
    min-width: 0;
    padding: ${({ theme }) => theme.spacing.md};
    text-align: left;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    /* A cor vem da opção escolhida no registro: entra como prop, e não como token fixo. */
    ${({ $accent }) => $accent && css`
      overflow: hidden;

      &::before {
        content: '';
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        height: 3px;
        background: ${$accent};
      }
    `}

    &:hover {
      background: ${({ theme }) => theme.colors.cardHover};
    }
  `,
};
