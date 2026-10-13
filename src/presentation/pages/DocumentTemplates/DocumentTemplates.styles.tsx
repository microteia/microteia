import styled from 'styled-components';

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
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  HeaderTitle: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Body: styled.div`
    flex: 1;
    display: flex;
    min-height: 0;
  `,

  List: styled.div`
    width: 300px;
    flex-shrink: 0;
    overflow-y: auto;
    border-right: 1px solid ${({ theme }) => theme.colors.border};
    padding: ${({ theme }) => theme.spacing.sm};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Row: styled.button<{ $active: boolean }>`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.xs};
    text-align: left;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme, $active }) => ($active ? theme.colors.primary : 'transparent')};
    background: ${({ theme, $active }) => ($active ? theme.colors.surfaceHover : 'transparent')};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  RowTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
  `,

  RowMeta: styled.span`
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Tag: styled.span<{ $tone: 'muted' | 'primary' | 'warning' | 'success' }>`
    padding: 0 ${({ theme }) => theme.spacing.xs};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: 1px solid ${({ theme, $tone }) => ($tone === 'muted' ? theme.colors.border : theme.colors[$tone])};
    color: ${({ theme, $tone }) => ($tone === 'muted' ? theme.colors.textMuted : theme.colors[$tone])};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  Empty: styled.p`
    padding: ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Editor: styled.div`
    flex: 1;
    min-width: 0;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  Toolbar: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Grid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Field: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
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
    min-height: 360px;
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    resize: vertical;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Code: styled.code`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
    word-break: break-word;
  `,


  SectionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
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
    background: ${({ theme }) => theme.colors.surfaceHover};
    max-height: 520px;
    overflow-y: auto;
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
    gap: ${({ theme }) => theme.spacing.xs};
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
    gap: 2px;
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

  DatasetRow: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)) auto;
    align-items: end;
    gap: ${({ theme }) => theme.spacing.sm};
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
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    cursor: pointer;
    width: fit-content;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
};
