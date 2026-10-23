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

  Track: styled.span`
    display: block;
    height: ${({ theme }) => theme.spacing.xs};
    margin-top: ${({ theme }) => theme.spacing.sm};
    background: ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    overflow: hidden;
  `,

  Fill: styled.span<{ $ratio: number }>`
    display: block;
    height: 100%;
    width: ${({ $ratio }) => $ratio * 100}%;
    background: ${({ theme }) => theme.colors.primary};
    transition: width ${({ theme }) => theme.transitions.normal};
  `,
};
