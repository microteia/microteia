import styled from 'styled-components';

/**
 * A aba ativa é pintada com o MESMO fundo do painel de baixo, e só os cantos de cima são
 * arredondados. É o que a faz deixar de ser uma caixa sobre uma barra e passar a ser um recorte que
 * se abre na página — o padrão do navegador. A troca de preenchimento (`surface` da barra para
 * `background` da página) faz sozinha o trabalho que antes pedia três réguas: divisória entre abas,
 * base da barra e sublinhado da ativa.
 *
 * O acento vai no TOPO e como `inset box-shadow`, não como borda: sombra interna acompanha o
 * `border-radius` de graça, e um acento embaixo cairia exatamente na emenda entre aba e painel,
 * devolvendo a linha que acabou de sair.
 */
const Tab = styled.button<{ $active: boolean }>`
  display: flex;
  align-items: center;
  gap: 7px;
  padding: 0 6px 0 12px;
  height: 32px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: ${({ $active }) => ($active ? '600' : '400')};
  color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textMuted)};
  background: ${({ theme, $active }) => ($active ? theme.colors.background : 'transparent')};
  border-radius: ${({ theme }) => theme.borderRadius.sm}
                 ${({ theme }) => theme.borderRadius.sm} 0 0;
  box-shadow: ${({ theme, $active }) =>
    $active ? `inset 0 2px 0 ${theme.colors.primary}` : 'none'};
  white-space: nowrap;
  flex-shrink: 0;
  transition: background ${({ theme }) => theme.transitions.fast},
              color ${({ theme }) => theme.transitions.fast},
              box-shadow ${({ theme }) => theme.transitions.fast};
  cursor: pointer;
  position: relative;

  &:hover {
    background: ${({ theme, $active }) =>
      $active ? theme.colors.background : theme.colors.surfaceHover};
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
    align-items: flex-end;
    gap: 2px;
    padding: 0 ${({ theme }) => theme.spacing.xs};
    background: ${({ theme }) => theme.colors.surface};
    flex-shrink: 0;
    min-height: 36px;
  `,

  TabList: styled.div`
    display: flex;
    align-items: flex-end;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-x: auto;
    overflow-y: hidden;
    scrollbar-width: thin;
    scrollbar-color: ${({ theme }) => theme.colors.scrollbarThumb} transparent;

    &::-webkit-scrollbar {
      height: 3px;
    }
    &::-webkit-scrollbar-track {
      background: transparent;
    }
    &::-webkit-scrollbar-thumb {
      background: ${({ theme }) => theme.colors.scrollbarThumb};
      border-radius: ${({ theme }) => theme.borderRadius.full};
    }
  `,

  PanelCloseBtn: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    align-self: center;
    margin: 0 ${({ theme }) => theme.spacing.xs};
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
    border-radius: ${({ theme }) => theme.borderRadius.full};
    color: ${({ theme }) => theme.colors.textMuted};
    opacity: ${({ $active }) => ($active ? '1' : '0')};
    transition: opacity ${({ theme }) => theme.transitions.fast},
                background ${({ theme }) => theme.transitions.fast},
                color ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  ContextMenu: styled.div`
    position: fixed;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
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
    background: ${({ theme }) => theme.colors.borderSubtle};
    margin: 4px 0;
  `,
};
