import styled from 'styled-components';
import { Button } from '../../components/ui/Button';
import { DS } from '../../components/layout/DesignerShell';

export type PillTone = 'primary' | 'warning';

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
  ...DS,

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

  DangerAction: styled(Button)`
    color: ${({ theme }) => theme.colors.danger};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerLight};
      color: ${({ theme }) => theme.colors.danger};
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

  /** O cartão de uma lista é mais largo: a ordem põe campo, direção e remover numa linha só. */
  DatasetSections: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(min(100%, 460px), 1fr));
    gap: ${({ theme }) => theme.spacing.md};
    align-items: start;
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
   * A aba de conteúdo: o editor e o painel ao lado ocupam a altura inteira, e cada um rola por
   * dentro. Estreito, o painel desce para baixo do editor — e a aba inteira passa a rolar.
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
