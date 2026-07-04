import styled from 'styled-components';

export const S = {
  Container: styled.div`
    display: flex;
    flex-direction: column;
    gap: 4px;
  `,

  Row: styled.div`
    display: flex;
    gap: ${({ theme }) => theme.spacing.xs};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
  `,

  Label: styled.span`
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  Value: styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  BadgeWrap: styled.span`
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  `,
};
