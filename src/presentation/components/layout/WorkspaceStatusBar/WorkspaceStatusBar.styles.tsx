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
    border-top: 1px solid ${({ theme }) => theme.colors.border};
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
