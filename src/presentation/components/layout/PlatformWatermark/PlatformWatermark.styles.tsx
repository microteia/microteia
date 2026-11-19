import styled, { css } from 'styled-components';
import type { PlatformWatermarkPlacement } from './PlatformWatermark.viewmodel';

export const S = {
  Container: styled.div<{ $placement: PlatformWatermarkPlacement }>`
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    pointer-events: none;
    user-select: none;

    ${({ $placement, theme }) => ($placement === 'corner'
      ? css`
        position: absolute;
        right: ${theme.spacing.md};
        bottom: ${theme.spacing.sm};
        z-index: 5;
        opacity: 0.35;
      `
      : css`
        margin-top: ${theme.spacing.lg};
        opacity: 0.6;
      `)}
  `,

  Caption: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  Identity: styled.div`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
  `,

  Logo: styled.img`
    width: 28px;
    height: 28px;
    object-fit: contain;
    flex-shrink: 0;
  `,

  Text: styled.div`
    display: flex;
    flex-direction: column;
    text-align: left;
    line-height: 1.2;
  `,

  Name: styled.span`
    font-weight: 700;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
  `,

  Tagline: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
  `,
};
