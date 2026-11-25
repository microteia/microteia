import styled from 'styled-components';
import { DS } from '../../components/layout/DesignerShell';

/**
 * A linha de um item declarado — um agrupamento, um número, um filtro.
 *
 * Fica fora do objeto `S` porque o item do AGRUPAMENTO é ele com uma coluna a mais, e um
 * styled-component só pode estender outro que já exista.
 */
const Item = styled.div`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${({ theme }) => theme.spacing.sm};
  align-items: center;
  padding: 8px 10px;
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  border-radius: ${({ theme }) => theme.borderRadius.sm};
`;

export const S = {
  ...DS,
  /** Os problemas do spec que moram na aba aberta, no alto dela. */
  TabIssueList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,
  /** A pré-visualização é uma aba: rola junto com ela, na largura inteira. */
  Preview: styled.div`
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,
  PreviewHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,
  PreviewEmpty: styled.p`
    margin: 0;
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,
  Group: styled.div`
    display: flex;
    flex-direction: column;
    gap: 6px;
  `,
  GroupHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
  Item,
  /** O agrupamento: alça de arraste, o conteúdo, e as ações — a linha do Form Design. */
  DimensionItem: styled(Item)<{ $dragging?: boolean; $dragOver?: boolean }>`
    grid-template-columns: auto 1fr auto;
    opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
    box-shadow: ${({ theme, $dragOver }) => ($dragOver ? `inset 0 2px 0 ${theme.colors.primary}` : 'none')};
  `,
  DragHandle: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: grab;
    flex-shrink: 0;

    &:active {
      cursor: grabbing;
    }
  `,
  ItemActions: styled.div`
    display: flex;
    align-items: center;
    gap: 2px;
  `,
  MoveBtn: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 24px;
    height: 24px;
    padding: 0;
    border: none;
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  `,
  /*
   * Rótulo e detalhe são BLOCOS, um sobre o outro. Como linhas de texto, eles se encostavam sem um
   * espaço sequer — "Tipo" e "é" saíam na tela como "Tipoé", e ninguém lê isso como duas coisas.
   */
  ItemLabel: styled.span`
    display: block;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,
  ItemMeta: styled.span`
    display: block;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
  Row: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    align-items: flex-end;
    flex-wrap: wrap;
  `,
  Grow: styled.div`
    flex: 1 1 160px;
    min-width: 0;
  `,

};
