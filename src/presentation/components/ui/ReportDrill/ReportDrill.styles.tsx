import styled from 'styled-components';

export const S = {
  Notice: styled.p`
    margin: 0 0 ${({ theme }) => theme.spacing.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
  Scroll: styled.div`
    max-height: 60vh;
    overflow: auto;
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
  `,
  Table: styled.table`
    width: 100%;
    border-collapse: collapse;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,
  Th: styled.th`
    position: sticky;
    top: 0;
    text-align: left;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textSecondary};
    background: ${({ theme }) => theme.colors.inputBackground};
    padding: 9px 12px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.border};
    white-space: nowrap;
  `,
  Row: styled.tr`
    cursor: pointer;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,
  Td: styled.td`
    padding: 8px 12px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
  `,
  Empty: styled.p`
    margin: 0;
    padding: 24px 12px;
    text-align: center;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.textMuted};
  `,
};
