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

  HeaderLeft: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    flex: 1;
    min-width: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-shrink: 0;
  `,

  ActionBtn: styled.button`
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
      background: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.white};
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

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xl};
  `,

  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  Card: styled.div`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    padding: ${({ theme }) => theme.spacing.lg};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Field: styled.label`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  /** O mesmo visual do `Field`, sem ser `<label>`: o campo da imagem tem outro `<label>` dentro. */
  FieldBlock: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ImageRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ImagePreview: styled.img`
    width: 38px;
    height: 38px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    object-fit: contain;
    flex-shrink: 0;
  `,

  ImagePlaceholder: styled.div`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 38px;
    height: 38px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  ImagePick: styled.label`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  HiddenFile: styled.input`
    display: none;
  `,

  FieldWide: styled.label`
    grid-column: 1 / -1;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Input: styled.input`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 400;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Textarea: styled.textarea`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 400;
    font-family: inherit;
    resize: vertical;
    min-height: 64px;

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  Hint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 400;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  // Árvore estilo VSCode Explorer
  TreeContainer: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    overflow: hidden;
  `,

  TreeGroup: styled.div`
    display: flex;
    flex-direction: column;
  `,

  TreeGroupHead: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 6px ${({ theme }) => theme.spacing.sm};
    border: none;
    background: transparent;
    width: 100%;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};
    min-height: 28px;
    
    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  TreeToggle: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
    width: 16px;
    height: 16px;
  `,

  TreeGroupIcon: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  TreeGroupLabel: styled.span`
    flex: 1;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    text-align: left;
  `,

  TreeGroupCount: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  `,

  TreeGroupAction: styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.textSecondary};
    cursor: pointer;
    transition: all ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;
    opacity: 0.7;
    
    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.white};
      opacity: 1;
    }

    &:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }
  `,

  TreeItem: styled.button<{ $selected?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    width: 100%;
    padding: 4px ${({ theme }) => theme.spacing.sm} 4px 32px;
    border: none;
    background: ${({ $selected, theme }) => ($selected ? theme.colors.surfaceHover : 'transparent')};
    color: ${({ theme }) => theme.colors.text};
    text-align: left;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};
    min-height: 26px;

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    &:disabled {
      cursor: default;
    }
  `,

  TreeItemIcon: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  `,

  TreeItemLabel: styled.span`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  TreeItemAction: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
    opacity: 0.6;

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
      opacity: 1;
    }
  `,

  TreeEmpty: styled.p`
    padding: 4px ${({ theme }) => theme.spacing.sm} 4px 32px;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
    min-height: 26px;
    display: flex;
    align-items: center;
  `,

  // Estilos antigos mantidos para outras partes
  Groups: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
    gap: ${({ theme }) => theme.spacing.lg};
    align-items: start;
  `,

  Group: styled.div`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    overflow: hidden;
  `,

  GroupHead: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    border: none;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    width: 100%;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast};
    
    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  GroupToggle: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
    transition: transform ${({ theme }) => theme.transitions.fast};
  `,

  GroupIcon: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  GroupTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  GroupCount: styled.span`
    margin-left: auto;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  GroupBody: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: ${({ theme }) => theme.spacing.xs};
    max-height: 340px;
    overflow-y: auto;
  `,

  Item: styled.button<{ $selected?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ $selected, theme }) => ($selected ? theme.colors.primary : 'transparent')};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ $selected, theme }) => ($selected ? theme.colors.surfaceHover : 'transparent')};
    color: ${({ theme }) => theme.colors.text};
    text-align: left;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast}, border-color ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    &:disabled {
      cursor: default;
    }
  `,

  ItemIcon: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  `,

  ItemLabel: styled.span`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Check: styled.span<{ $on?: boolean }>`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 20px;
    height: 20px;
    border: 1px solid ${({ $on, theme }) => ($on ? theme.colors.primary : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  Required: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surfaceHover};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;
  `,

  Carried: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    border: 1px solid ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,

  Empty: styled.p`
    padding: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    font-style: italic;
  `,

  CodeHead: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  CodeEmpty: styled.p`
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ViewGrid: styled.div`
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ViewChip: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    text-align: left;
    cursor: pointer;
    transition: background ${({ theme }) => theme.transitions.fast}, border-color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  ViewWarn: styled.span`
    display: inline-flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.warning};
    flex-shrink: 0;
  `,

  ViewRemove: styled.span`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};
    flex-shrink: 0;

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
    }
  `,

  Issues: styled.ul`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    list-style: none;
  `,

  Issue: styled.li`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  StatusBar: styled.div`
    display: flex;
    align-items: center;
    padding: ${({ theme }) => theme.spacing.md} 0;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin-top: auto;
  `,

  Count: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  StartupDescription: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    line-height: 1.5;

    code {
      padding: 2px 6px;
      border-radius: ${({ theme }) => theme.borderRadius.sm};
      background: ${({ theme }) => theme.colors.surfaceHover};
      font-family: 'Monaco', 'Menlo', 'Consolas', monospace;
      font-size: ${({ theme }) => theme.fontSizes.xs};
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  EditorContainer: styled.div`
    margin-top: ${({ theme }) => theme.spacing.md};
  `,
};
