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
  /*
   * Os avisos da tela (não encontrado, relatório de pacote) e os problemas do spec ficam FORA das abas:
   * eles valem para o relatório inteiro, e escondê-los na aba em que não se está era o mesmo que não
   * os dar. Vazios, não ocupam nem a borda.
   */
  Notices: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl} 0;
    flex-shrink: 0;

    &:empty {
      display: none;
    }
  `,
  TabBar: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 0 ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    overflow-x: auto;
    flex-shrink: 0;
  `,
  TabBtn: styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    border-bottom: 2px solid ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
    white-space: nowrap;
    transition: color ${({ theme }) => theme.transitions.fast}, border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,
  TabCount: styled.span<{ $active: boolean }>`
    min-width: 18px;
    padding: 0 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 18px;
    text-align: center;
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : theme.colors.surfaceHover)};
  `,
  /*
   * As configurações têm TETO de altura e rolam por dentro: o que vem abaixo é a pré-visualização, e
   * ela precisa continuar à vista enquanto se mexe no que a produz.
   */
  Settings: styled.div`
    flex: 0 1 auto;
    min-height: 0;
    max-height: 55%;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,
  /** As partes de uma aba lado a lado quando há largura; uma embaixo da outra quando não há. */
  Sections: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
    align-items: start;

    @media (max-width: 480px) {
      grid-template-columns: 1fr;
    }
  `,
  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    min-width: 0;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
  `,
  Issues: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    max-height: 25%;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;

    &:empty {
      display: none;
    }
  `,
  Preview: styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
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
