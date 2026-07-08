import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  Section: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SectionTitle: styled.h3`
    font-size: ${({ theme }) => theme.fontSizes.md};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    margin: 0;
  `,

  GroupCard: styled.div<{ $operator: 'and' | 'or'; $focused?: boolean }>`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primary : theme.colors.warning)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.background};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    box-shadow: ${({ $focused, theme }) => ($focused ? `0 0 0 3px ${theme.colors.primaryLight}, 0 0 0 1px ${theme.colors.primary}` : 'none')};
    transition: box-shadow ${({ theme }) => theme.transitions.normal};
  `,

  CollapseBtn: styled.button`
    width: 22px;
    height: 22px;
    display: flex;
    align-items: center;
    justify-content: center;
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: transparent;
    color: ${({ theme }) => theme.colors.textMuted};
    cursor: pointer;
    flex-shrink: 0;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
      background: ${({ theme }) => theme.colors.primaryLight};
    }
  `,

  CollapsedSummary: styled.span`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  GroupHeader: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    flex-wrap: wrap;
  `,

  OperatorToggle: styled.div`
    display: inline-flex;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    overflow: hidden;
    flex-shrink: 0;
  `,

  OperatorBtn: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    background: ${({ $active, theme }) => ($active ? theme.colors.primaryLight : theme.colors.surface)};
    color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    & + & {
      border-left: 1px solid ${({ theme }) => theme.colors.border};
    }

    &:hover {
      color: ${({ theme }) => theme.colors.primary};
    }
  `,

  NegateBtn: styled.button<{ $active: boolean }>`
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    border: 1px solid ${({ $active, theme }) => ($active ? theme.colors.danger : theme.colors.border)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ $active, theme }) => ($active ? theme.colors.dangerLight : theme.colors.surface)};
    color: ${({ $active, theme }) => ($active ? theme.colors.danger : theme.colors.textMuted)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover {
      border-color: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.danger};
    }
  `,

  GroupActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    margin-left: auto;
    flex-wrap: wrap;
  `,

  GroupActionBtn: styled.button`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    border: 1px dashed ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: transparent;
    color: ${({ theme }) => theme.colors.primary};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.primaryLight};
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  GroupChildren: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  JoinPill: styled.div<{ $operator: 'and' | 'or' }>`
    align-self: flex-start;
    margin-left: ${({ theme }) => theme.spacing.md};
    padding: 2px ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primaryLight : theme.colors.warningLight)};
    color: ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primary : theme.colors.warning)};
  `,

  HeaderActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  ConditionCard: styled.div<{ $focused?: boolean }>`
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    box-shadow: ${({ $focused, theme }) => ($focused ? `0 0 0 3px ${theme.colors.primaryLight}, 0 0 0 1px ${theme.colors.primary}` : 'none')};
    transition: box-shadow ${({ theme }) => theme.transitions.normal};
  `,

  ConditionHeader: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  ConditionLabel: styled.div`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  RemoveButton: styled.button`
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    justify-content: center;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      border-color: ${({ theme }) => theme.colors.danger};
      color: ${({ theme }) => theme.colors.danger};
    }

    &:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }
  `,

  ConditionRow: styled.div`
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: ${({ theme }) => theme.spacing.md};

    @media (max-width: 768px) {
      grid-template-columns: 1fr;
    }
  `,

  FieldGroup: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
  `,

  Label: styled.label`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  ValueTypeRow: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    flex-wrap: wrap;
  `,

  HelpText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    margin: 0;
    font-style: italic;
  `,
};
