import styled, { keyframes } from 'styled-components';

const fadeScaleIn = keyframes`
  from { opacity: 0; transform: scale(0.95) translateY(6px); }
  to   { opacity: 1; transform: scale(1) translateY(0); }
`;

export const S = {
  Container: styled.aside<{ $collapsed: boolean }>`
    width: ${({ $collapsed, theme }) =>
      $collapsed ? theme.sidebar.collapsedWidth : theme.sidebar.width};
    flex-shrink: 0;
    background: ${({ theme }) => theme.colors.surface};
    border-right: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    display: flex;
    flex-direction: column;
    transition: width ${({ theme }) => theme.transitions.normal};
    overflow: hidden;
  `,

  LogoArea: styled.div<{ $collapsed: boolean }>`
    display: flex;
    align-items: center;
    justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'space-between')};
    padding: ${({ $collapsed }) => ($collapsed ? '0 4px' : '0 12px 0 16px')};
    height: 72px;
    border-bottom: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;
    gap: ${({ $collapsed }) => ($collapsed ? '4px' : '0')};
  `,

  LogoLeft: styled.div`
    display: flex;
    align-items: center;
    gap: 10px;
    overflow: hidden;
    min-width: 0;
  `,

  LogoIcon: styled.div<{ $collapsed: boolean }>`
    width: ${({ $collapsed }) => ($collapsed ? '32px' : '64px')};
    height: ${({ $collapsed }) => ($collapsed ? '32px' : '64px')};
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    transition: all ${({ theme }) => theme.transitions.normal};

    img {
      width: 100%;
      height: 100%;
      object-fit: contain;
    }
  `,

  LogoText: styled.div`
    display: flex;
    flex-direction: column;
    overflow: hidden;
  `,

  AppNameRow: styled.div`
    display: flex;
    align-items: baseline;
    gap: 5px;
  `,

  AppName: styled.span`
    font-weight: 700;
    font-size: ${({ theme }) => theme.fontSizes.md};
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    line-height: 1.2;
  `,

  AppTagline: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    color: ${({ theme }) => theme.colors.textMuted};
    white-space: nowrap;
  `,

  CollapseButton: styled.button`
    display: flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  SearchTrigger: styled.button<{ $collapsed: boolean }>`
    display: flex;
    align-items: center;
    gap: ${({ theme }) => theme.spacing.sm};
    margin: ${({ theme }) => theme.spacing.sm};
    padding: ${({ $collapsed }) => ($collapsed ? '7px' : '7px 10px')};
    justify-content: ${({ $collapsed }) => ($collapsed ? 'center' : 'flex-start')};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    border: 1px solid ${({ theme }) => theme.colors.border};
    background: ${({ theme }) => theme.colors.background};
    color: ${({ theme }) => theme.colors.textMuted};
    width: ${({ $collapsed }) => ($collapsed ? 'auto' : 'calc(100% - 16px)')};
    flex-shrink: 0;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      border-color: ${({ theme }) => theme.colors.primary};
      color: ${({ theme }) => theme.colors.textSecondary};
      background: ${({ theme }) => theme.colors.primaryLight};
    }

    svg {
      flex-shrink: 0;
    }
  `,

  SearchLabel: styled.span`
    flex: 1;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    text-align: left;
    white-space: nowrap;
  `,

  SearchKbd: styled.kbd`
    font-family: ${({ theme }) => theme.fonts.mono};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    background: ${({ theme }) => theme.colors.surfaceHover};
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    padding: 1px 5px;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
    line-height: 1.6;
  `,

  Nav: styled.nav`
    flex: 1;
    padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.sm};
    display: flex;
    flex-direction: column;
    gap: 2px;
    overflow-y: auto;
  `,

  NavLabel: styled.span`
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    padding: 8px 12px 4px;
    white-space: nowrap;
  `,

  NavSection: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
  `,

  NavGroupHeader: styled.button`
    display: flex;
    align-items: center;
    gap: 6px;
    width: 100%;
    margin-top: ${({ theme }) => theme.spacing.sm};
    padding: 6px 12px 4px 8px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.xs};
    font-weight: 600;
    color: ${({ theme }) => theme.colors.textMuted};
    text-transform: uppercase;
    letter-spacing: 0.08em;
    white-space: nowrap;
    text-align: left;
    transition: color ${({ theme }) => theme.transitions.fast};

    &:hover {
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  NavGroupChevron: styled.span<{ $collapsed: boolean }>`
    display: flex;
    flex-shrink: 0;
    transform: rotate(${({ $collapsed }) => ($collapsed ? '-90deg' : '0deg')});
    transition: transform ${({ theme }) => theme.transitions.fast};
  `,

  NavGroupLabel: styled.span`
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  NavGroupDivider: styled.div`
    height: 1px;
    margin: ${({ theme }) => theme.spacing.xs} 12px;
    background: ${({ theme }) => theme.colors.borderSubtle};
  `,

  NavItem: styled.button<{ $active: boolean }>`
    position: relative;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 9px 12px;
    border-radius: ${({ theme }) => theme.borderRadius.md};
    color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ $active }) => ($active ? '600' : '400')};
    white-space: nowrap;
    text-align: left;
    width: 100%;
    transition: all ${({ theme }) => theme.transitions.fast};

    svg {
      flex-shrink: 0;
      width: 20px;
      height: 20px;
    }

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  NavBadge: styled.span`
    margin-left: auto;
    min-width: 18px;
    height: 18px;
    padding: 0 5px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    color: ${({ theme }) => theme.colors.white};
    font-size: 10px;
    font-weight: 700;
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  `,

  NavBadgeDot: styled.span`
    position: absolute;
    top: 4px;
    right: 4px;
    width: 8px;
    height: 8px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: ${({ theme }) => theme.colors.primary};
    box-shadow: 0 0 0 2px ${({ theme }) => theme.colors.surface};
    flex-shrink: 0;
  `,


  VersionBadge: styled.span`
    font-size: 10px;
    color: ${({ theme }) => theme.colors.textMuted};
    letter-spacing: 0.04em;
    opacity: 0.6;
    white-space: nowrap;
  `,

  UserSection: styled.div`
    position: relative;
    border-top: 1px solid ${({ theme }) => theme.colors.borderSubtle};
    flex-shrink: 0;
  `,

  UserMenuTrigger: styled.button`
    position: relative;
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    width: 100%;
    border-radius: 0;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  UserInfo: styled.div`
    flex: 1;
    min-width: 0;
    text-align: left;
    overflow: hidden;
  `,

  UserName: styled.span`
    display: block;
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  `,

  UserChevron: styled.div`
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
  `,

  MenuOverlay: styled.div`
    position: fixed;
    inset: 0;
    z-index: 99;
  `,

  UserMenu: styled.div`
    position: absolute;
    bottom: calc(100% + 6px);
    left: 8px;
    right: 8px;
    background: ${({ theme }) => theme.colors.surface};
    border: 1px solid ${({ theme }) => theme.colors.border};
    border-radius: ${({ theme }) => theme.borderRadius.md};
    box-shadow: 0 8px 24px ${({ theme }) => theme.colors.shadow};
    z-index: 100;
    overflow: hidden;
    animation: ${fadeScaleIn} 150ms ease;
  `,

  MenuGroup: styled.div`
    padding: 4px;
  `,

  MenuDivider: styled.div`
    height: 1px;
    background: ${({ theme }) => theme.colors.borderSubtle};
    margin: 0;
  `,

  MenuItem: styled.button<{ $danger?: boolean }>`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.text)};
    width: 100%;
    text-align: left;
    transition: background ${({ theme }) => theme.transitions.fast};

    svg {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.textMuted)};
    }

    &:hover {
      background: ${({ theme, $danger }) =>
        $danger ? theme.colors.dangerLight : theme.colors.surfaceHover};
    }
  `,

  ThemeSubToggle: styled.button`
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 8px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: 500;
    color: ${({ theme }) => theme.colors.text};
    width: 100%;
    text-align: left;
    transition: background ${({ theme }) => theme.transitions.fast};

    svg {
      flex-shrink: 0;
      width: 16px;
      height: 16px;
      color: ${({ theme }) => theme.colors.textMuted};
    }

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
    }
  `,

  ThemeSubArrow: styled.div<{ $open?: boolean }>`
    margin-left: auto;
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.textMuted};
    flex-shrink: 0;
    transform: ${({ $open }) => ($open ? 'rotate(90deg)' : 'rotate(0deg)')};
    transition: transform ${({ theme }) => theme.transitions.fast};
  `,

  ThemeSubMenu: styled.div`
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 0 4px 4px;
  `,

  ThemeSubItem: styled.button<{ $active?: boolean }>`
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: ${({ theme }) => theme.borderRadius.sm};
    font-size: ${({ theme }) => theme.fontSizes.sm};
    font-weight: ${({ $active }) => ($active ? '600' : '500')};
    color: ${({ theme, $active }) => ($active ? theme.colors.text : theme.colors.textSecondary)};
    background: ${({ theme, $active }) => ($active ? theme.colors.primaryLight : 'transparent')};
    width: 100%;
    text-align: left;
    transition: all ${({ theme }) => theme.transitions.fast};

    &:hover {
      background: ${({ theme }) => theme.colors.surfaceHover};
      color: ${({ theme }) => theme.colors.text};
    }
  `,

  ThemeDot: styled.div<{ $bg: string; $primary: string }>`
    width: 14px;
    height: 14px;
    border-radius: ${({ theme }) => theme.borderRadius.full};
    background: linear-gradient(
      135deg,
      ${({ $bg }) => $bg} 50%,
      ${({ $primary }) => $primary} 50%
    );
    border: 1px solid ${({ theme }) => theme.colors.border};
    flex-shrink: 0;
  `,

  ThemeCheck: styled.div`
    margin-left: auto;
    display: flex;
    align-items: center;
    color: ${({ theme }) => theme.colors.primary};
    flex-shrink: 0;
  `,
};
