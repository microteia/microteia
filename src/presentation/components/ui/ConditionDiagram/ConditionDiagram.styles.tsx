import styled from 'styled-components';

const NodeActions = styled.div`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  opacity: 0;
  transition: opacity ${({ theme }) => theme.transitions.fast};
`;

const GroupHeader = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Group = styled.div<{ $operator: 'and' | 'or' }>`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-left: 3px solid ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primary : theme.colors.warning)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surface};

  &:hover > ${GroupHeader} ${NodeActions}, &:focus-within > ${GroupHeader} ${NodeActions} {
    opacity: 1;
  }
`;

const Leaf = styled.div`
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.sm};
  padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  background: ${({ theme }) => theme.colors.surfaceHover};

  &:hover ${NodeActions}, &:focus-within ${NodeActions} {
    opacity: 1;
  }
`;

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  AlwaysPill: styled.div`
    align-self: flex-start;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border: 1px solid ${({ theme }) => theme.colors.success};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.revenueLight};
    color: ${({ theme }) => theme.colors.success};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
  `,

  Group,
  GroupHeader,
  NodeActions,
  Leaf,

  CollapseBtn: styled.button`
    width: 20px;
    height: 20px;
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

  GroupBadge: styled.button<{ $operator: 'and' | 'or' }>`
    align-self: flex-start;
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    letter-spacing: 0.05em;
    background: ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primaryLight : theme.colors.warningLight)};
    color: ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primary : theme.colors.warning)};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      filter: brightness(0.92);
    }

    &:disabled {
      cursor: default;
    }
  `,

  GroupChildren: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding-left: ${({ theme }) => theme.spacing.md};
    border-left: 2px dashed ${({ theme }) => theme.colors.border};
    margin-left: ${({ theme }) => theme.spacing.xs};
  `,

  JoinLabel: styled.span<{ $operator: 'and' | 'or' }>`
    align-self: flex-start;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    color: ${({ $operator, theme }) => ($operator === 'and' ? theme.colors.primary : theme.colors.warning)};
  `,

  NotWrapper: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.sm};
    border: 1px dashed ${({ theme }) => theme.colors.danger};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.dangerLight};
  `,

  NotBadge: styled.button`
    align-self: flex-start;
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border: none;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    background: ${({ theme }) => theme.colors.danger};
    color: ${({ theme }) => theme.colors.white};
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover:not(:disabled) {
      filter: brightness(0.9);
    }

    &:disabled {
      cursor: default;
    }
  `,

  ActionBtn: styled.button<{ $danger?: boolean }>`
    min-width: 22px;
    height: 22px;
    padding: 0 4px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 2px;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.textMuted};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 700;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ $danger, theme }) => ($danger ? theme.colors.danger : theme.colors.primary)};
      color: ${({ $danger, theme }) => ($danger ? theme.colors.danger : theme.colors.primary)};
    }
  `,

  RootActions: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    flex-wrap: wrap;
  `,

  RootActionBtn: styled.button`
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

  FieldChip: styled.span`
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
  `,

  OperatorText: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  ValueChip: styled.span`
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.surface};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
  `,

  ExpressionChip: styled.span`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: 2px ${({ theme }) => theme.spacing.sm};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.inputBackground};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-family: ${({ theme }) => theme.fonts.mono};
  `,

  EmptyHint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    font-style: italic;
  `,
};
