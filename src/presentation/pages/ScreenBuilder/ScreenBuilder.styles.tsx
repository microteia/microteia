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
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
  `,

  Content: styled.div`
    flex: 1;
    overflow: hidden;
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
    display: flex;
    align-items: stretch;
    gap: ${({ theme }) => theme.spacing.xl};
    max-width: 1200px;
  `,

  BannerWrapper: styled.div`
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.xl};
  `,

  Section: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Sidebar: styled.div`
    width: 320px;
    flex-shrink: 0;
    height: 100%;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xl};
    padding-right: ${({ theme }) => theme.spacing.sm};
  `,

  SidebarSection: styled.section`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ScreenList: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  ScreenListItem: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    text-align: left;
    width: 100%;
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : theme.colors.surfaceHover)};
    }
  `,

  ScreenListIcon: styled.div`
    width: 32px;
    height: 32px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;

    svg {
      width: 16px;
      height: 16px;
    }
  `,

  ScreenListInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  ScreenListName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  ScreenListMeta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  Detail: styled.div`
    flex: 1;
    min-width: 0;
    height: 100%;
    overflow-y: auto;
  `,

  DetailCard: styled.div<{ $disabled?: boolean }>`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  `,

  SectionTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    padding-bottom: ${({ theme }) => theme.spacing.xs};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  SectionHint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ScreenCard: styled.div<{ $disabled?: boolean }>`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    opacity: ${({ $disabled }) => ($disabled ? 0.6 : 1)};
  `,

  ScreenCardHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ScreenIcon: styled.div`
    width: 40px;
    height: 40px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  ScreenInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  ScreenName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ScreenMeta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: 2px;
  `,

  DisabledBadge: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.warning};
    border: 1px solid ${({ theme }) => theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    padding: 1px 10px;
  `,

  CardActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-shrink: 0;
  `,

  IconButton: styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    background: transparent;
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

  DangerIconButton: styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 30px;
    height: 30px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
    background: transparent;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      background: ${({ theme }) => theme.colors.dangerLight};
      color: ${({ theme }) => theme.colors.danger};
    }

    &:disabled {
      opacity: 0.35;
      cursor: not-allowed;
    }
  `,

  FieldList: styled.div`
    display: flex;
    flex-direction: column;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
  `,

  FieldRow: styled.div<{ $dragging?: boolean; $dragOver?: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    background: ${({ theme, $dragOver }) => ($dragOver ? theme.colors.surfaceHover : 'transparent')};
    opacity: ${({ $dragging }) => ($dragging ? 0.4 : 1)};
    box-shadow: ${({ theme, $dragOver }) => ($dragOver ? `inset 0 2px 0 ${theme.colors.primary}` : 'none')};

    & + & {
      border-top: 1px solid ${({ theme }) => theme.colors.border};
    }
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

  FieldInfo: styled.div`
    flex: 1;
    min-width: 0;
  `,

  FieldName: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
  `,

  FieldMeta: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  FieldHint: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    margin-top: ${({ theme }) => theme.spacing.xs};
  `,

  EmptyHint: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    padding: ${({ theme }) => theme.spacing.md};
    text-align: center;
  `,

  CardFooter: styled.div`
    display: flex;
    justify-content: flex-start;
  `,

  ModalForm: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  ModalActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
    margin-top: ${({ theme }) => theme.spacing.sm};
  `,

  CheckboxRow: styled.label`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    cursor: pointer;

    input {
      accent-color: ${({ theme }) => theme.colors.primary};
      width: 16px;
      height: 16px;
      cursor: pointer;
    }
  `,

  OptionInputRow: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  OptionChips: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Chip: styled.span`
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border: 1px solid ${({ theme }) => theme.colors.border};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.text};
  `,

  ChipRemove: styled.button`
    display: inline-flex;
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textMuted};
    background: transparent;

    &:hover {
      color: ${({ theme }) => theme.colors.danger};
    }
  `,
};
