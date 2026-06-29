import styled from 'styled-components';

export const S = {
  Page: styled.div`
    display: flex;
    flex-direction: column;
    height: 100%;
    background: ${({ theme }) => theme.colors.background};
  `,

  Header: styled.div`
    padding: ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  Title: styled.h1`
    font-size: ${({ theme }) => theme.fontSizes['2xl']};
    font-weight: 700;
    color: ${({ theme }) => theme.colors.text};
    margin-bottom: 4px;
  `,

  Subtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Body: styled.div`
    flex: 1;
    overflow-y: auto;
    padding: ${({ theme }) => theme.spacing.xl};
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
  `,

  Toolbar: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
  `,

  SearchWrapper: styled.div`
    position: relative;
    flex: 1;
    max-width: 420px;
  `,

  SearchIcon: styled.span`
    position: absolute;
    left: 12px;
    top: 50%;
    transform: translateY(-50%);
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    pointer-events: none;
  `,

  SearchInput: styled.input`
    width: 100%;
    padding: 10px 14px 10px 38px;
    background: ${({ theme }) => theme.colors.surface};
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

  UserCell: styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
  `,

  Avatar: styled.div`
    width: 36px;
    height: 36px;
    border-radius: 50%;
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    display: flex;
    align-items: center;
    justify-content: center;
    font-weight: 600;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    flex-shrink: 0;
    overflow: hidden;

    img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
  `,

  UserName: styled.span`
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
  `,

  Email: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  DateText: styled.span`
    color: ${({ theme }) => theme.colors.textSecondary};
    font-size: ${({ theme }) => theme.fontSizes.xs};
  `,

  RoleBadge: styled.span<{ $role: string }>`
    display: inline-flex;
    align-items: center;
    padding: 3px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    letter-spacing: 0.04em;
    background: ${({ theme, $role }) => $role === 'SYSTEM' ? theme.colors.dangerLight : theme.colors.surfaceHover};
    color: ${({ theme, $role }) => $role === 'SYSTEM' ? theme.colors.danger : theme.colors.textSecondary};
    border: 1px solid ${({ theme, $role }) => $role === 'SYSTEM' ? theme.colors.dangerLight : theme.colors.border};
  `,

  RoleSelectWrapper: styled.div`
    min-width: 160px;
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

  DeniedPage: styled.div`
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    height: 100%;
    gap: ${({ theme }) => theme.spacing.md};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  DeniedIcon: styled.div`
    font-size: 64px;
    opacity: 0.3;
  `,

  DeniedTitle: styled.h2`
    font-size: ${({ theme }) => theme.fontSizes.xl};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
  `,

  DeniedSubtitle: styled.p`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textSecondary};
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
};

