import styled from 'styled-components';

export type InfoBannerVariant = 'warning' | 'info';

export const S = {
  Banner: styled.p<{ $variant: InfoBannerVariant }>`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textSecondary};
    background: ${({ theme }) => theme.colors.inputBackground};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-left: 3px solid ${({ theme, $variant }) =>
      $variant === 'info' ? theme.colors.primary : theme.colors.warning};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    padding: 10px 14px;
    line-height: 1.5;
    margin: 0;
  `,
};
