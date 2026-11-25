import styled from 'styled-components';

export type DesignerTileTone = 'primary' | 'neutral';

/** O botão quadrado do cabeçalho — o mesmo desenho das outras telas de edição. */
const SquareBtn = styled.button`
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

  &:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }
`;

/**
 * O casco das telas de AUTORIA — relatório e modelo de documento (#32).
 *
 * As duas eram cópias, e só uma evoluiu: o designer de relatório ficou com a pré-visualização espremida
 * embaixo das configurações e sem identidade no cabeçalho. Morando aqui, as duas não divergem de novo;
 * o que é de cada uma continua no `S` dela.
 */
export const DS = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  HeaderMain: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
    flex: 1;
  `,

  Tile: styled.div<{ $tone: DesignerTileTone }>`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $tone }) => ($tone === 'neutral' ? theme.colors.surfaceHover : theme.colors.primaryLight)};
    color: ${({ theme, $tone }) => ($tone === 'neutral' ? theme.colors.info : theme.colors.primary)};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  HeaderText: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  HeaderName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  HeaderMeta: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  MetaKey: styled.code`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  MetaSeparator: styled.span`
    width: 3px;
    height: 3px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.textMuted};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: 6px;
    flex-shrink: 0;
  `,

  IconBtn: styled(SquareBtn)`
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  /** Verde só no hover, com o ícone em branco — o salvar das outras telas de edição. */
  SaveBtn: styled(SquareBtn)`
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.success};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.success};
    }
  `,

  DeleteBtn: styled(SquareBtn)`
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.white};
      border-color: ${({ theme }) => theme.colors.danger};
    }
  `,

  /* Vazios, os avisos não ocupam nem a borda. */
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

  /** O problema que mora numa aba aparece nela mesmo fechada: vermelho impede salvar, âmbar só avisa. */
  TabIssues: styled.span<{ $blocking: boolean }>`
    min-width: 18px;
    padding: 0 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    line-height: 18px;
    text-align: center;
    color: ${({ $blocking, theme }) => ($blocking ? theme.colors.danger : theme.colors.warning)};
    background: ${({ $blocking, theme }) => ($blocking ? theme.colors.dangerLight : theme.colors.warningLight)};
  `,

  /** A aba ocupa a altura inteira abaixo da barra, e rola por dentro. */
  Settings: styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
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
};
