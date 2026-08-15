import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useTenant } from '../../../../stores/useTenant';
import { useTheme } from '../../../../stores/useTheme';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { buildListTabKey } from '../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useNavContributions } from '../../../shared/useUiContributions';
import { useNavBadgeCount } from '../../../shared/useNavBadgeCount';
import { visibleNavItems } from '../../../shared/resolveUiContributions';
import { DYNAMIC_SCREEN_NAV_ORDER } from '../../../shared/uiExtensionPoints';
import { useAuditLogAlert } from '../../../../stores/useAuditLogAlert';
import type { User } from '../../../../domain/entities';
import type { ThemeMode } from '../../../../shared/types';
import { useLabel } from '../../../shared/i18n/useT';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Contador do item. `0` = sem selo. */
  badge: number;
  requiresTenantAdmin?: boolean;
}

export interface ThemeOption {
  mode: ThemeMode;
  /** Chave do catálogo — o tema é catálogo de módulo, e quem renderiza traduz. */
  labelKey: string;
  primaryColor: string;
  bgColor: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'microteia', labelKey: 'theme.microteia',  primaryColor: '#F56B3A', bgColor: '#141414' },
  { mode: 'dark',     labelKey: 'theme.dark',    primaryColor: '#6c63ff', bgColor: '#0f1117' },
  { mode: 'light',    labelKey: 'theme.light',     primaryColor: '#6c63ff', bgColor: '#f1f5f9' },
  { mode: 'bruma',    labelKey: 'theme.bruma',     primaryColor: '#5B7ED6', bgColor: '#ECEEF2' },
  { mode: 'claude',   labelKey: 'theme.claude',    primaryColor: '#DA7756', bgColor: '#F5F4EE' },
  { mode: 'teams',    labelKey: 'theme.teams',     primaryColor: '#6264A7', bgColor: '#1F1F1F' },
  { mode: 'kindle',   labelKey: 'theme.kindle',    primaryColor: '#8B6040', bgColor: '#F6EDD9' },
  { mode: 'themis',     labelKey: 'theme.themis',         primaryColor: '#6D2233', bgColor: '#F6F3EC' },
  { mode: 'themisDark', labelKey: 'theme.themis-dark', primaryColor: '#B85C6E', bgColor: '#191316' },
];

export interface WorkspaceSidebarViewModel {
  collapsed: boolean;
  navItems: NavItem[];
  activeKey: string | null;
  isMenuOpen: boolean;
  isThemeSubOpen: boolean;
  isAdmin: boolean;
  canAccessScreenBuilder: boolean;
  canAccessDataProcessor: boolean;
  user: User | null;
  effectivePhotoURL: string | null;
  effectiveName: string;
  mode: ThemeMode;
  themeOptions: ThemeOption[];
  searchShortcut: string;
  toggleCollapse: () => void;
  handleNavClick: (key: string) => void;
  openCommandPalette: () => void;
  toggleMenu: () => void;
  closeMenu: () => void;
  toggleThemeSub: () => void;
  handleProfileClick: () => void;
  handleAccessManagementClick: () => void;
  handleScreenBuilderClick: () => void;
  handleWorkflowsClick: () => void;
  handleScriptsClick: () => void;
  handleActionsClick: () => void;
  handleDataProcessorClick: () => void;
  handleMarketplaceClick: () => void;
  handleSetTheme: (mode: ThemeMode) => void;
  handleSignOut: () => void;
}

export const useWorkspaceSidebarViewModel = (): WorkspaceSidebarViewModel => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeSubOpen, setIsThemeSubOpen] = useState(false);

  const { openTab, panels, activePanelId } = useWorkspace();
  const { userRole, user, effectivePhotoURL, effectiveName, signOut } = useAuth();
  const { tenantRole } = useTenant();
  const { mode, setTheme } = useTheme();
  const { open: openCommandPalette } = useCommandPalette();
  const { unreadCriticalCount: unreadCriticalAuditCount } = useAuditLogAlert();
  const { sidebarScreens } = useScreenDefinitions();
  const navContributions = useNavContributions();

  const searchShortcut = /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const activeKey = panels[activePanelId]?.activeTabKey ?? null;
  const isAdmin = userRole === 'SYSTEM';
  const canAccessScreenBuilder = isAdmin || tenantRole === 'admin';
  const canAccessDataProcessor = isAdmin || tenantRole === 'admin' || tenantRole === 'lawyer';

  /**
   * O selo de cada item. Duas origens: a DECLARADA (`badge` da contribuição), que é uma contagem de
   * registros — e enxerga `user`, então conta também o que ESTE usuário não leu —, e a de baixo, que
   * conta falhas críticas de auditoria ainda não vistas: o único selo que resta no kernel.
   */
  const badgeCount = useNavBadgeCount();
  const kernelBadge = useCallback((key: string): number => {
    if (key === 'audit-logs') return unreadCriticalAuditCount;
    return 0;
  }, [unreadCriticalAuditCount]);

  const label = useLabel();

  const navItems = useMemo(() => {
    const contributed = visibleNavItems(navContributions, {
      isSystemAdmin: isAdmin,
      isTenantAdmin: tenantRole === 'admin',
    }).map((item) => ({
      key: item.key,
      label: label(item.label),
      icon: getScreenIcon(item.icon, 20),
      order: item.order,
      badge: item.badge ? badgeCount(item.badge) : kernelBadge(item.key),
    }));

    const dynamicItems = sidebarScreens.map((def) => ({
      key: buildListTabKey(def.id),
      // Tela do escritório: `titlePlural` é texto digitado por ele, nunca referência — `label` o
      // devolve intacto. Passa pela mesma função só para haver UM caminho de rótulo, não dois.
      label: label(def.titlePlural),
      icon: getScreenIcon(def.icon, 18),
      order: DYNAMIC_SCREEN_NAV_ORDER,
      badge: 0,
    }));

    return [...contributed, ...dynamicItems]
      .sort((a, b) => a.order - b.order)
      .map(({ key, label, icon, badge }): NavItem => ({ key, label, icon, badge }));
  }, [navContributions, isAdmin, tenantRole, sidebarScreens, badgeCount, kernelBadge, label]);

  const toggleCollapse = useCallback(() => setCollapsed(c => !c), []);

  const closeMenu = useCallback(() => {
    setIsMenuOpen(false);
    setIsThemeSubOpen(false);
  }, []);

  const toggleMenu = useCallback(() => {
    setIsMenuOpen(open => {
      if (!open) setCollapsed(false);
      if (open) setIsThemeSubOpen(false);
      return !open;
    });
  }, []);

  const toggleThemeSub = useCallback(() => setIsThemeSubOpen(s => !s), []);

  const handleNavClick = useCallback((key: string) => {
    openTab(key);
  }, [openTab]);

  const handleProfileClick = useCallback(() => {
    openTab('profile');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleAccessManagementClick = useCallback(() => {
    openTab('access-management');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleScreenBuilderClick = useCallback(() => {
    openTab('screen-builder');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleWorkflowsClick = useCallback(() => {
    openTab('workflows');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleScriptsClick = useCallback(() => {
    openTab('scripts');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleActionsClick = useCallback(() => {
    openTab('actions');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleDataProcessorClick = useCallback(() => {
    openTab('data-processor');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleMarketplaceClick = useCallback(() => {
    openTab('marketplace');
    closeMenu();
  }, [openTab, closeMenu]);

  const handleSetTheme = useCallback((newMode: ThemeMode) => {
    setTheme(newMode);
    closeMenu();
  }, [setTheme, closeMenu]);

  const handleSignOut = useCallback(async () => {
    closeMenu();
    await signOut();
  }, [signOut, closeMenu]);

  return {
    collapsed,
    navItems,
    activeKey,
    isMenuOpen,
    isThemeSubOpen,
    isAdmin,
    canAccessScreenBuilder,
    canAccessDataProcessor,
    user,
    effectivePhotoURL,
    effectiveName,
    mode,
    themeOptions: THEME_OPTIONS,
    searchShortcut,
    toggleCollapse,
    handleNavClick,
    openCommandPalette,
    toggleMenu,
    closeMenu,
    toggleThemeSub,
    handleProfileClick,
    handleAccessManagementClick,
    handleScreenBuilderClick,
    handleWorkflowsClick,
    handleScriptsClick,
    handleActionsClick,
    handleDataProcessorClick,
    handleMarketplaceClick,
    handleSetTheme,
    handleSignOut,
  };
};
