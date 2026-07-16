import styled, { keyframes, css } from 'styled-components';
import type { DefaultTheme } from 'styled-components';
import type { NotificationVariant } from '../../../../stores/useNotification';

const flyToTop = keyframes`
  0%   { opacity: 0; transform: translateY(50vh) scale(0.88); }
  65%  { opacity: 1; transform: translateY(-6px) scale(1.01); }
  100% { opacity: 1; transform: translateY(0) scale(1); }
`;

const fadeOut = keyframes`
  from { opacity: 1; transform: translateY(0) scale(1); }
  to   { opacity: 0; transform: translateY(-14px) scale(0.94); }
`;

const shimmer = keyframes`
  from { transform: translateX(-120%); }
  to   { transform: translateX(150%); }
`;

const hexToRgba = (hex: string, alpha: number): string => {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const variantAccent = (v: NotificationVariant, theme: DefaultTheme): string =>
  ({ success: theme.colors.success, error: theme.colors.danger, warning: theme.colors.warning, info: theme.colors.primary }[v]);

const isDark = (theme: DefaultTheme) => ['dark', 'teams', 'curatino'].includes(theme.mode);

const variantBg = (v: NotificationVariant, theme: DefaultTheme): string =>
  hexToRgba(variantAccent(v, theme), isDark(theme) ? 0.38 : 0.18);

export const S = {
  BannerContainer: styled.div`
    position: fixed;
    top: 16px;
    left: 50%;
    transform: translateX(-50%);
    z-index: 1000;
    width: min(540px, calc(100vw - 32px));
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.sm};
    pointer-events: none;
  `,

  NotificationItem: styled.div<{ $variant: NotificationVariant; $exiting: boolean }>`
    position: relative;
    overflow: hidden;
    pointer-events: auto;
    display: flex;
    align-items: flex-start;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: 12px ${({ theme }) => theme.spacing.md};
    border-left: 4px solid ${({ theme, $variant }) => variantAccent($variant, theme)};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme, $variant }) => variantBg($variant, theme)};
    backdrop-filter: blur(12px);
    box-shadow: 0 8px 32px ${({ theme }) => theme.colors.shadow},
                0 2px 8px ${({ theme }) => theme.colors.shadow};
    animation: ${({ $exiting }) =>
      $exiting
        ? css`${fadeOut} 280ms ease forwards`
        : css`${flyToTop} 480ms cubic-bezier(0.22, 1, 0.36, 1) forwards`};

    &::after {
      content: '';
      position: absolute;
      inset: 0;
      pointer-events: none;
      background: linear-gradient(105deg, transparent 20%, rgba(255, 255, 255, 0.13) 50%, transparent 80%);
      transform: translateX(-120%);
      animation: ${shimmer} 700ms ease-out 420ms forwards;
    }
  `,

  Icon: styled.span<{ $variant: NotificationVariant }>`
    color: ${({ theme, $variant }) => variantAccent($variant, theme)};
    display: flex;
    align-items: center;
    flex-shrink: 0;
    margin-top: 2px;
  `,

  Message: styled.p`
    flex: 1;
    min-width: 0;
    margin: 0;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    color: ${({ theme }) => theme.colors.text};
    line-height: 1.45;
    overflow-wrap: anywhere;
  `,

  CloseButton: styled.button`
    background: none;
    border: none;
    cursor: pointer;
    padding: 3px;
    color: ${({ theme }) => theme.colors.textMuted};
    display: flex;
    align-items: center;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: color ${({ theme }) => theme.transitions.fast},
                background ${({ theme }) => theme.transitions.fast};
    flex-shrink: 0;

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  MoreBar: styled.div`
    pointer-events: auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 6px ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    background: ${({ theme }) => theme.colors.surface};
    box-shadow: 0 4px 16px ${({ theme }) => theme.colors.shadow};
  `,

  MoreLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
  `,

  DismissAllButton: styled.button`
    background: none;
    border: none;
    cursor: pointer;
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    padding: 2px 4px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,
};
