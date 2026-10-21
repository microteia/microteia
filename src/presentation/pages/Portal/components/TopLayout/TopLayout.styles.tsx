import styled, { css } from 'styled-components';

const NARROW = '900px';

/** O menu numa faixa no topo; no celular, a mesma gaveta do layout lateral. */
export const S = {
  Frame: styled.div`
    min-height: 100vh;
    min-height: 100dvh;
    display: flex;
    flex-direction: column;
    background: ${({ theme }) => theme.colors.background};
  `,

  Header: styled.header`
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.lg};
    height: 64px;
    padding: 0 ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.surface};

    @media (max-width: ${NARROW}) {
      gap: ${({ theme }) => theme.spacing.sm};
      padding: 0 ${({ theme }) => theme.spacing.md};
    }
  `,

  BrandSlot: styled.div`
    min-width: 0;
    max-width: 280px;
    flex-shrink: 1;
  `,

  Nav: styled.nav`
    flex: 1;
    min-width: 0;
    display: flex;
    gap: 2px;
    overflow-x: auto;

    @media (max-width: ${NARROW}) {
      display: none;
    }
  `,

  Grow: styled.div`
    flex: 1;
  `,

  Spacer: styled.div`
    display: none;
    flex: 1;

    @media (max-width: ${NARROW}) {
      display: block;
    }
  `,

  NavItem: styled.button<{ $active: boolean }>`
    display: inline-flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.xs};
    padding: ${({ theme }) => theme.spacing.xs} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.full};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.textSecondary};
    white-space: nowrap;

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    ${({ $active, theme }) => $active && css`
      background: ${theme.colors.primaryLight};
      color: ${theme.colors.primary};
      font-weight: 600;
    `}
  `,

  MenuButton: styled.button`
    display: none;
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};

    @media (max-width: ${NARROW}) {
      display: inline-flex;
    }
  `,

  Drawer: styled.div`
    display: none;

    @media (max-width: ${NARROW}) {
      display: flex;
      flex-direction: column;
      gap: 2px;
      position: fixed;
      z-index: 50;
      top: 64px;
      left: 0;
      right: 0;
      padding: ${({ theme }) => theme.spacing.sm};
      border-bottom: 1px solid ${({ theme }) => theme.colors.border};
      background: ${({ theme }) => theme.colors.surface};
      box-shadow: 0 16px 32px ${({ theme }) => theme.colors.shadow};
    }
  `,

  DrawerItem: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.md};
    text-align: left;
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.text)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
  `,

  Content: styled.main`
    flex: 1;
    width: 100%;
    max-width: 1040px;
    margin: 0 auto;
    padding: ${({ theme }) => theme.spacing.xl};

    @media (max-width: ${NARROW}) {
      padding: ${({ theme }) => theme.spacing.md};
    }
  `,
};
