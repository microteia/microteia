import styled from 'styled-components';

export const S = {
  Bar: styled.div`
    height: 22px;
    flex-shrink: 0;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: ${({ theme }) => theme.spacing.md};
    padding: 0 ${({ theme }) => theme.spacing.sm};
    background: ${({ theme }) => theme.colors.surface};
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Side: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.md};
    min-width: 0;
  `,

  Item: styled.span`
    display: flex;
    align-items: center;
    gap: 4px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;

    svg {
      flex-shrink: 0;
      font-size: 12px;
    }
  `,

  PlanBadge: styled.span`
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 1px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primaryLight};
    color: ${({ theme }) => theme.colors.primary};
    font-weight: 600;
    white-space: nowrap;

    svg {
      flex-shrink: 0;
      font-size: 12px;
    }
  `,

  PlanUsage: styled.span`
    font-weight: 400;
    opacity: 0.75;
  `,

  Link: styled.a`
    display: flex;
    align-items: center;
    gap: 4px;
    color: ${({ theme }) => theme.colors.textMuted};
    transition: color ${({ theme }) => theme.transitions.fast};

    svg {
      flex-shrink: 0;
      font-size: 12px;
    }

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,
};
