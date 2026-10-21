import styled, { css } from 'styled-components';

export const NARROW = '900px';

/** O menu numa coluna à esquerda; no celular, uma gaveta que desliza por cima. */
export const S = {
  Frame: styled.div`
    display: flex;
    min-height: 100vh;
    min-height: 100dvh;
    background: ${({ theme }) => theme.colors.background};
  `,

  Sidebar: styled.aside<{ $open: boolean }>`
    width: 256px;
    flex-shrink: 0;
    display: flex;
    flex-direction: column;
    gap: ${({ theme }) => theme.spacing.lg};
    padding: ${({ theme }) => theme.spacing.lg} ${({ theme }) => theme.spacing.md};
    border-right: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.surface};
    position: sticky;
    top: 0;
    height: 100vh;
    height: 100dvh;
    overflow-y: auto;

    @media (max-width: ${NARROW}) {
      position: fixed;
      z-index: 50;
      left: 0;
      transform: translateX(${({ $open }) => ($open ? '0' : '-100%')});
      transition: transform ${({ theme }) => theme.transitions.normal};
      box-shadow: ${({ $open, theme }) => ($open ? `0 0 40px ${theme.colors.shadow}` : 'none')};
    }
  `,

  Backdrop: styled.div`
    display: none;

    @media (max-width: ${NARROW}) {
      display: block;
      position: fixed;
      inset: 0;
      z-index: 45;
      background: ${({ theme }) => theme.colors.overlay};
    }
  `,

  Nav: styled.nav`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  NavItem: styled.button<{ $active: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    width: 100%;
    padding: ${({ theme }) => theme.spacing.sm} ${({ theme }) => theme.spacing.md};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    text-align: left;
    color: ${({ theme }) => theme.colors.textSecondary};
    transition: background ${({ theme }) => theme.transitions.fast}, color ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }

    ${({ $active, theme }) => $active && css`
      background: ${theme.colors.primaryLight};
      color: ${theme.colors.primary};
      font-weight: 600;

      &:hover {
        background: ${theme.colors.primaryLight};
        color: ${theme.colors.primary};
      }
    `}
  `,

  NavLabel: styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  Main: styled.div`
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  `,

  Topbar: styled.header`
    position: sticky;
    top: 0;
    z-index: 30;
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    height: 64px;
    padding: 0 ${({ theme }) => theme.spacing.xl};
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    background: ${({ theme }) => theme.colors.background};

    @media (max-width: ${NARROW}) {
      padding: 0 ${({ theme }) => theme.spacing.md};
    }
  `,

  MenuButton: styled.button`
    display: none;
    width: 36px;
    height: 36px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    align-items: center;
    justify-content: center;
    color: ${({ theme }) => theme.colors.textSecondary};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }

    @media (max-width: ${NARROW}) {
      display: inline-flex;
    }
  `,

  PageTitle: styled.h1`
    flex: 1;
    min-width: 0;
    font-size: ${({ theme }) => theme.fontSizes.lg};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.text};
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
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
