import styled from 'styled-components';
import { Button } from '../../components/ui/Button';

export type PillTone = 'primary' | 'warning';

/** O botão quadrado do cabeçalho — o mesmo desenho da autoria de relatório e das outras telas de edição. */
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

const fieldText = styled.textarea`
  width: 100%;
  padding: ${({ theme }) => theme.spacing.md};
  background: ${({ theme }) => theme.colors.inputBackground};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.text};
  font-family: ${({ theme }) => theme.fonts.mono};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  line-height: 1.6;
  transition: border-color ${({ theme }) => theme.transitions.fast};

  &:focus {
    outline: none;
    border-color: ${({ theme }) => theme.colors.primary};
  }

  &:read-only {
    color: ${({ theme }) => theme.colors.textSecondary};
  }
`;

export const S = {
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

  FormatIcon: styled.div<{ $format: 'markdown' | 'docx' }>`
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $format }) => ($format === 'docx' ? theme.colors.surfaceHover : theme.colors.primaryLight)};
    color: ${({ theme, $format }) => ($format === 'docx' ? theme.colors.info : theme.colors.primary)};
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

  Pill: styled.span<{ $tone: PillTone }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    white-space: nowrap;
    flex-shrink: 0;
    color: ${({ theme, $tone }) => ($tone === 'warning' ? theme.colors.warning : theme.colors.primary)};
    background: ${({ theme, $tone }) => ($tone === 'warning' ? theme.colors.warningLight : theme.colors.primaryLight)};
  `,

  Dot: styled.span`
    width: 6px;
    height: 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: currentColor;
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

  DangerAction: styled(Button)`
    color: ${({ theme }) => theme.colors.danger};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerLight};
      color: ${({ theme }) => theme.colors.danger};
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

  Notice: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  NoticeActions: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
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

  /*
   * As configurações têm TETO de altura e rolam por dentro: abaixo delas vêm o editor e a prévia, e
   * eles precisam continuar à vista enquanto se mexe no que os produz.
   */
  Settings: styled.div`
    flex: 0 1 auto;
    min-height: 0;
    max-height: 45%;
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

  /** O cartão de uma lista é mais largo: a ordem põe campo, direção e remover numa linha só. */
  DatasetSections: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr));
    gap: ${({ theme }) => theme.spacing.md};
    align-items: start;
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

  SectionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  DataTab: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Legend: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  Pair: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Hint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Empty: styled.p`
    padding: ${({ theme }) => theme.spacing.lg};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  Issue: styled.p<{ $grammar: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $grammar }) => ($grammar ? theme.colors.warning : theme.colors.danger)};
  `,

  SampleText: styled(fieldText)`
    min-height: 160px;
    resize: vertical;
  `,

  OrderList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  OrderKey: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 2fr) minmax(0, 1fr) auto;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  OrderAdd: styled.div`
    display: flex;
  `,

  /*
   * O editor e o painel ao lado ocupam o que sobra da altura, e cada um rola por dentro. Estreito,
   * o painel desce para baixo do editor — e a página inteira passa a rolar.
   */
  Workbench: styled.div`
    flex: 1;
    min-height: 0;
    display: grid;
    grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);

    @media (max-width: 1000px) {
      grid-template-columns: minmax(0, 1fr);
      overflow-y: auto;
    }
  `,

  Pane: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    min-height: 0;
    min-width: 0;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.xl};

    & + & {
      border-left: 1px solid ${({ theme }) => theme.colors.border};
      background: ${({ theme }) => theme.colors.surface};
    }

    @media (max-width: 1000px) {
      min-height: 480px;

      & + & {
        border-left: none;
        border-top: 1px solid ${({ theme }) => theme.colors.border};
      }
    }
  `,

  PaneHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    flex-shrink: 0;
    min-height: 32px;
  `,

  PaneTitle: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  TemplateText: styled(fieldText)`
    flex: 1;
    min-height: 240px;
    resize: none;
  `,

  ContentIssues: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    max-height: 96px;
    overflow-y: auto;
    flex-shrink: 0;
  `,

  DocxDrop: styled.div`
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.xl};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    text-align: center;
  `,

  DocxIcon: styled.span`
    font-size: 32px;
    color: ${({ theme }) => theme.colors.info};
  `,

  HiddenFile: styled.input`
    display: none;
  `,

  FileLabel: styled.label`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 6px 12px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    cursor: pointer;
    width: fit-content;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Segmented: styled.div`
    display: inline-flex;
    padding: 2px;
    gap: 2px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surfaceHover};
  `,

  SegmentBtn: styled.button<{ $active: boolean }>`
    padding: 4px ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ $active, theme }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
    background: ${({ $active, theme }) => ($active ? theme.colors.surface : 'transparent')};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  SideBody: styled.div`
    flex: 1;
    min-height: 0;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  PreviewEmpty: styled.p`
    padding: ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing.lg};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  Stale: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.warning};
  `,

  HelpGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  HelpGroupTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  HelpEntry: styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  Code: styled.code`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.background};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 2px 6px;
    width: fit-content;
    max-width: 100%;
    word-break: break-word;
  `,

  HelpText: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  HelpLink: styled.button`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    width: fit-content;
    padding: 0;
    border: none;
    background: none;
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;

    &:hover {
      text-decoration: underline;
    }
  `,
};
