import styled from 'styled-components';

export const S = {
  Panel: styled.div`
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.md};
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,

  Header: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    font-weight: 600;
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
  `,

  State: styled.span<{ $active: boolean }>`
    margin-left: auto;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 500;
    color: ${({ theme, $active }) => ($active ? theme.colors.success : theme.colors.warning)};
  `,

  Text: styled.p`
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    line-height: 1.5;
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Actions: styled.div`
    display: flex;
    flex-wrap: wrap;
    gap: ${({ theme }) => theme.spacing.sm};
  `,
};
