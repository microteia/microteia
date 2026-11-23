import styled from 'styled-components';

const fieldStyles = `
  padding: 8px 10px;
`;

export const S = {
  Body: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  DefaultCard: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.lg};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    flex-wrap: wrap;
  `,

  DefaultText: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    min-width: 0;
    flex: 1;
  `,

  DefaultTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  DefaultSelect: styled.div`
    width: 240px;
    max-width: 100%;
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  Hint: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  TableCard: styled.div`
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.lg};
    overflow-x: auto;
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

  Tr: styled.tr<{ $archived?: boolean }>`
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    opacity: ${({ $archived }) => ($archived ? 0.6 : 1)};
    transition: background ${({ theme }) => theme.transitions.fast};

    &:last-child {
      border-bottom: none;
    }

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  Td: styled.td`
    padding: 12px 20px;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    vertical-align: middle;
  `,

  NameCell: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  NameInput: styled.input`
    ${fieldStyles}
    width: 200px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }
  `,

  DefaultBadge: styled.span`
    padding: 2px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    white-space: nowrap;
  `,

  LimitCell: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  LimitInput: styled.input`
    ${fieldStyles}
    width: 80px;
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme }) => theme.colors.text};
    font-size: ${({ theme }) => theme.fontSizes.sm};

    &:focus {
      outline: none;
      border-color: ${({ theme }) => theme.colors.primary};
    }

    &::placeholder {
      color: ${({ theme }) => theme.colors.textMuted};
    }
  `,

  Saving: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.primary};
  `,

  Form: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.md};
    padding: ${({ theme }) => theme.spacing.xl};
  `,

  Actions: styled.div`
    display: flex;
    justify-content: flex-end;
    gap: ${({ theme }) => theme.spacing.sm};
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
    font-size: ${({ theme }) => theme.fontSizes['3xl']};
    opacity: 0.4;
  `,

  EmptyText: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    text-align: center;
  `,
};
