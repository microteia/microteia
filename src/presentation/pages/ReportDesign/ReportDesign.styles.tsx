import styled from 'styled-components';

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
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,
  /** O cabeçalho das telas de edição: título à esquerda, ações à direita. */
  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,
  HeaderTitle: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    min-width: 0;
  `,
  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  `,
  /**
   * Os três botões do cabeçalho, no MESMO desenho das outras telas de edição: quadrado de 30px,
   * neutro em repouso, e a cor só no hover — verde para salvar, vermelho para excluir, com o ícone
   * em BRANCO. Usar `surface` no ícone sobre vermelho o deixava escuro sobre escuro.
   */
  IconBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  SaveBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.success};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.success};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  DeleteBtn: styled.button`
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.danger};
    }

    &:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `,
  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,
  Columns: styled.div`
    display: grid;
    grid-template-columns: minmax(320px, 420px) 1fr;
    gap: ${({ theme }) => theme.spacing.lg};
    align-items: start;

    @media (max-width: 980px) {
      grid-template-columns: 1fr;
    }
  `,
  Panel: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
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
  Legend: styled.h2`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,
  Hint: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    line-height: 1.5;
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
