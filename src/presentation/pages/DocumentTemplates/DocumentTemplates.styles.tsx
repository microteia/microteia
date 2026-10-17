import styled from 'styled-components';
import { Button } from '../../components/ui/Button';

export type PillTone = 'neutral' | 'primary' | 'warning' | 'danger' | 'success';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow: hidden;
    background: ${({ theme }) => theme.colors.background};
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;
  `,

  HeaderText: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Body: styled.div`
    flex: 1;
    display: flex;
    min-height: 0;
  `,

  Sidebar: styled.aside`
    width: 340px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    min-height: 0;
    border-right: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.surface};
  `,

  SidebarFilter: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;
  `,

  List: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.sm};
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  Row: styled.button<{ $active: boolean }>`
    position: relative;
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    text-align: left;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid transparent;
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.surfaceHover)};
    }

    &:focus-visible {
      outline: 2px solid ${({ theme }) => theme.colors.primary};
      outline-offset: -2px;
    }
  `,

  FormatIcon: styled.span<{ $format: 'markdown' | 'docx'; $size?: 'sm' | 'lg' }>`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: ${({ $size }) => ($size === 'lg' ? '44px' : '34px')};
    height: ${({ $size }) => ($size === 'lg' ? '44px' : '34px')};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ $size }) => ($size === 'lg' ? '22px' : '18px')};
    color: ${({ theme, $format }) => ($format === 'docx' ? theme.colors.info : theme.colors.primary)};
    background: ${({ theme, $format }) => ($format === 'docx' ? theme.colors.surfaceHover : theme.colors.primaryLight)};
  `,

  RowBody: styled.span`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  RowTop: styled.span`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  RowTitle: styled.span`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  RowMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Pills: styled.span`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: 2px;
  `,

  Pill: styled.span<{ $tone: PillTone }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 1px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    white-space: nowrap;
    color: ${({ theme, $tone }) => ({
      neutral: theme.colors.textSecondary,
      primary: theme.colors.primary,
      warning: theme.colors.warning,
      danger: theme.colors.danger,
      success: theme.colors.success,
    })[$tone]};
    background: ${({ theme, $tone }) => ({
      neutral: theme.colors.surfaceHover,
      primary: theme.colors.primaryLight,
      warning: theme.colors.warningLight,
      danger: theme.colors.dangerLight,
      success: theme.colors.surfaceHover,
    })[$tone]};
  `,

  Dot: styled.span`
    width: 6px;
    height: 6px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: currentColor;
  `,

  ListEmpty: styled.p`
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Editor: styled.div`
    flex: 1;
    min-width: 0;
    overflow-y: auto;
  `,

  EditorInner: styled.div`
    max-width: 1180px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl} ${({ theme }) => theme.spacing['2xl']};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  EmptyEditor: styled.div`
    height: 100%;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing['2xl']};
    text-align: center;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  EmptyIcon: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 64px;
    height: 64px;
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: 30px;
  `,

  EmptyText: styled.p`
    max-width: 360px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  Hero: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  HeroMain: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.md};
    min-width: 0;
    flex: 1;
  `,

  HeroText: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  HeroTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    line-height: 1.2;
    color: ${({ theme }) => theme.colors.text};
    word-break: break-word;
  `,

  HeroMeta: styled.div`
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

  Actions: styled.div`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
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

  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  SectionHeader: styled.div`
    display: flex;
    align-items: flex-start;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SectionHeading: styled.div`
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  SectionIcon: styled.span`
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  SectionText: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
  `,

  Hint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Issue: styled.p<{ $grammar: boolean }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme, $grammar }) => ($grammar ? theme.colors.warning : theme.colors.danger)};
  `,

  TemplateText: styled.textarea`
    width: 100%;
    min-height: 420px;
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.6;
    resize: vertical;
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &:read-only {
      color: ${({ theme }) => theme.colors.textSecondary};
    }
  `,

  DocxDrop: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
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

  Code: styled.code`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 2px 6px;
    width: fit-content;
    max-width: 100%;
    word-break: break-word;
  `,

  ContentLayout: styled.div`
    display: grid;
    grid-template-columns: minmax(0, 1fr) 300px;
    gap: ${({ theme }) => theme.spacing.lg};
    align-items: start;

    @media (max-width: 1100px) {
      grid-template-columns: minmax(0, 1fr);
    }
  `,

  ContentMain: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    min-width: 0;
  `,

  Help: styled.aside`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.background};
    max-height: 560px;
    overflow-y: auto;
    position: sticky;
    top: 0;
  `,

  HelpTitle: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
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

  DatasetList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  DatasetRow: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)) auto;
    align-items: end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.background};
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
};
