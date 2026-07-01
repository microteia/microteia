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
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  HeaderLeft: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Avatar: styled.div`
    width: 48px;
    height: 48px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    color: #fff;
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    flex-shrink: 0;
  `,

  HeaderInfo: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  SubTitle: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  Tags: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  TagPill: styled.span<{ $color: string }>`
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    background: ${({ $color }) => `${$color}22`};
    color: ${({ $color }) => $color};
    border: 1px solid ${({ $color }) => `${$color}44`};
  `,

  TagDot: styled.span<{ $color: string }>`
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: ${({ $color }) => $color};
    flex-shrink: 0;
  `,

  TabBar: styled.div`
    display: flex;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
    padding: 0 ${({ theme }) => theme.spacing.xl};
  `,

  TabBtn: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => `${theme.spacing.md} ${theme.spacing.lg}`};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ $active, theme }) => $active ? theme.colors.primary : theme.colors.textSecondary};
    border-bottom: 2px solid ${({ $active, theme }) => $active ? theme.colors.primary : 'transparent'};
    transition: all ${({ theme }) => theme.transitions.fast};
    white-space: nowrap;

    &:hover { color: ${({ theme }) => theme.colors.text}; }
  `,

  Content: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
  `,

  FormGrid: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};
    max-width: 900px;

    @media (max-width: 640px) {
      grid-template-columns: 1fr;
    }
  `,

  FormGroup: styled.div<{ $fullWidth?: boolean }>`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    grid-column: ${({ $fullWidth }) => $fullWidth ? '1 / -1' : 'auto'};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: ${({ theme }) => theme.spacing.lg} 0 ${({ theme }) => theme.spacing.sm};
    padding-bottom: ${({ theme }) => theme.spacing.xs};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    grid-column: 1 / -1;

    &:first-child { margin-top: 0; }
  `,

  FormActions: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
    justify-content: flex-end;
    margin-top: ${({ theme }) => theme.spacing.lg};
    grid-column: 1 / -1;
  `,

  BoolToggle: styled.div`
    display: flex;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    width: fit-content;
  `,

  BoolOption: styled.button<{ $active: boolean }>`
    padding: 9px 18px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    background: ${({ $active, theme }) => $active ? theme.colors.primary : 'transparent'};
    color: ${({ $active, theme }) => $active ? '#fff' : theme.colors.textSecondary};
    transition: all ${({ theme }) => theme.transitions.fast};

    &:not(:last-child) { border-right: 1px solid ${({ theme }) => theme.colors.border}; }
    &:hover { background: ${({ $active, theme }) => $active ? theme.colors.primaryHover : theme.colors.surfaceHover}; }
  `,

  NoteList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    margin-bottom: ${({ theme }) => theme.spacing.xl};
    max-width: 720px;
  `,

  NoteCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: hidden;
    transition: box-shadow ${({ theme }) => theme.transitions.fast};

    &:hover { box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow}; }
  `,

  NoteCardTop: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
  `,

  NoteCardClickArea: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    flex: 1;
    min-width: 0;
    cursor: pointer;
    user-select: none;
  `,

  NoteAvatar: styled.div`
    width: 34px;
    height: 34px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    overflow: hidden;
  `,

  NoteAvatarImg: styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  NoteBody: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 1px;
  `,

  NoteTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
  `,

  NoteDate: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  NoteExpandIcon: styled.span<{ $expanded: boolean }>`
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    transition: transform ${({ theme }) => theme.transitions.fast};
    transform: ${({ $expanded }) => $expanded ? 'rotate(180deg)' : 'rotate(0deg)'};
    flex-shrink: 0;
  `,

  NoteDivider: styled.hr`
    border: none;
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    margin: 0;
  `,

  NoteContent: styled.div`
    padding: ${({ theme }) => theme.spacing.md};
    padding-top: ${({ theme }) => theme.spacing.sm};
  `,

  TabSectionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    margin-bottom: ${({ theme }) => theme.spacing.md};
    flex-shrink: 0;
  `,

  NoteEditorCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: hidden;
    margin-bottom: ${({ theme }) => theme.spacing.lg};
    max-width: 720px;
  `,

  NoteEditorTitleRow: styled.div`
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  NoteEditorActions: styled.div`
    display: flex;
    align-items: center;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-top: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surfaceHover};
  `,

  PendingFileCard: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    margin-bottom: ${({ theme }) => theme.spacing.md};
    max-width: 720px;
  `,

  PendingFileTopRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  PendingFileContent: styled.div`
    flex: 1;
    min-width: 0;
  `,

  PendingFileName: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    padding-left: calc(36px + ${({ theme }) => theme.spacing.md});
  `,

  PendingFileActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-shrink: 0;
  `,

  DocList: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-bottom: ${({ theme }) => theme.spacing.xl};
    max-width: 720px;
  `,

  DocRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => `${theme.spacing.sm} ${theme.spacing.md}`};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    transition: box-shadow ${({ theme }) => theme.transitions.fast};

    &:hover { box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow}; }
  `,

  DocIcon: styled.div`
    font-size: 22px;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  DocContent: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  DocName: styled.a`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    text-decoration: none;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    display: block;
    &:hover { color: ${({ theme }) => theme.colors.primary}; text-decoration: underline; }
  `,

  DocUploaderRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  DocUploaderAvatar: styled.div`
    width: 16px;
    height: 16px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    color: #fff;
    font-size: 9px;
    font-weight: 600;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
    flex-shrink: 0;
  `,

  DocUploaderImg: styled.img`
    width: 100%;
    height: 100%;
    object-fit: cover;
  `,

  DocMeta: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  DocTypeBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    padding: 2px 8px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: transparent;
    white-space: nowrap;
    flex-shrink: 0;
  `,

  DocActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-shrink: 0;
  `,

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing['2xl']};
    color: ${({ theme }) => theme.colors.textMuted};
    text-align: center;
  `,

  EmptyIcon: styled.div`
    font-size: 40px;
    opacity: 0.3;
  `,
};
