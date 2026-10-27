import styled from 'styled-components';

export const S = {
  Body: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Count: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
  `,

  TableCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow: hidden;
  `,

  Table: styled.table`
    width: 100%;
    border-collapse: collapse;
  `,

  Thead: styled.thead`
    background: ${({ theme }) => theme.colors.background};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  `,

  Th: styled.th`
    padding: 12px 20px;
    text-align: left;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.06em;
    white-space: nowrap;
  `,

  Tbody: styled.tbody``,

  Tr: styled.tr`
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Td: styled.td`
    padding: 14px 20px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    vertical-align: middle;
  `,

  OfficeName: styled.span`
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
  `,

  DateText: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  MemberCount: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  PlanCell: styled.div`
    width: 180px;
  `,

  LimitCell: styled.div`
    display: flex;
    align-items: center;
    gap: 8px;
  `,

  LimitInput: styled.input`
    width: 80px;
    padding: 8px 10px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    transition: border-color ${({ theme }) => theme.transitions.fast};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  `,

  LimitHint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  SavingIndicator: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.primary};
    animation: pulse 1.5s ease-in-out infinite;

    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.4; }
    }
  `,

  EmptyState: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: ${({ theme }) => theme.spacing['2xl']};
    gap: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  EmptyIcon: styled.div`
    font-size: 48px;
    opacity: 0.4;
  `,

  EmptyText: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
  `,

  CreateForm: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl};
  `,

  CreateHint: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  CreateActions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
