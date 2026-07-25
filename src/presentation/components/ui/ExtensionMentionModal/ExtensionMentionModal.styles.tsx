import styled from 'styled-components';

export const S = {
  Search: styled.div`
    margin-bottom: ${({ theme }) => theme.spacing.md};
  `,

  List: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.xs};
    max-height: 340px;
    overflow-y: auto;
  `,

  Item: styled.button`
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    text-align: left;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid transparent;
    background: transparent;
    cursor: pointer;
    transition: ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      border-color: ${({ theme }) => theme.colors.border};
    }
  `,

  ItemTitle: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
  `,

  ItemSub: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Empty: styled.div`
    padding: ${({ theme }) => theme.spacing.lg};
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
