import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useTenant } from '../../../../stores/useTenant';
import { useTheme } from '../../../../stores/useTheme';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useNewsInteraction } from '../../../../stores/useNewsInteraction';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { buildListTabKey } from '../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useNavContributions } from '../../../shared/useUiContributions';
import { visibleNavItems } from '../../../shared/resolveUiContributions';
import { DYNAMIC_SCREEN_NAV_ORDER } from '../../../shared/uiExtensionPoints';
import { usePushInteraction } from '../../../../stores/usePushInteraction';
import { useAuditLogAlert } from '../../../../stores/useAuditLogAlert';
import type { User } from '../../../../domain/entities';
import type { ThemeMode } from '../../../../shared/types';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  requiresTenantAdmin?: boolean;
}

export interface ThemeOption {
  mode: ThemeMode;
  label: string;
  primaryColor: string;
  bgColor: string;
}

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'curatino', label: 'Curatino',  primaryColor: '#F56B3A', bgColor: '#141414' },
  { mode: 'dark',     label: 'Escuro',    primaryColor: '#6c63ff', bgColor: '#0f1117' },
  { mode: 'light',    label: 'Claro',     primaryColor: '#6c63ff', bgColor: '#f1f5f9' },
  { mode: 'bruma',    label: 'Bruma',     primaryColor: '#5B7ED6', bgColor: '#ECEEF2' },
  { mode: 'claude',   label: 'Claude',    primaryColor: '#DA7756', bgColor: '#F5F4EE' },
  { mode: 'teams',    label: 'Teams',     primaryColor: '#6264A7', bgColor: '#1F1F1F' },
  { mode: 'kindle',   label: 'Kindle',    primaryColor: '#8B6040', bgColor: '#F6EDD9' },
  { mode: 'themis',     label: 'Themis',         primaryColor: '#6D2233', bgColor: '#F6F3EC' },
  { mode: 'themisDark', label: 'Themis Noturno', primaryColor: '#B85C6E', bgColor: '#191316' },
];

export interface WorkspaceSidebarViewModel {
  collapsed: boolean;
  navItems: NavItem[];
  unreadNewsCount: number;
  unreadPushCount: number;
  unreadCriticalAuditCount: number;
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
  const { unreadCount: unreadNewsCount } = useNewsInteraction();
  const { unreadCount: unreadPushCount } = usePushInteraction();
  const { unreadCriticalCount: unreadCriticalAuditCount } = useAuditLogAlert();
  const { sidebarScreens } = useScreenDefinitions();
  const navContributions = useNavContributions();

  const searchShortcut = /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const activeKey = panels[activePanelId]?.activeTabKey ?? null;
  const isAdmin = userRole === 'SYSTEM';
  const canAccessScreenBuilder = isAdmin || tenantRole === 'admin';
  const canAccessDataProcessor = isAdmin || tenantRole === 'admin' || tenantRole === 'lawyer';

  const navItems = useMemo(() => {
    const contributed = visibleNavItems(navContributions, {
      isSystemAdmin: isAdmin,
      isTenantAdmin: tenantRole === 'admin',
    }).map((item) => ({ key: item.key, label: item.label, icon: getScreenIcon(item.icon, 20), order: item.order }));

    const dynamicItems = sidebarScreens.map((def) => ({
      key: buildListTabKey(def.id),
      label: def.titlePlural,
      icon: getScreenIcon(def.icon, 18),
      order: DYNAMIC_SCREEN_NAV_ORDER,
    }));

    return [...contributed, ...dynamicItems]
      .sort((a, b) => a.order - b.order)
      .map(({ key, label, icon }): NavItem => ({ key, label, icon }));
  }, [navContributions, isAdmin, tenantRole, sidebarScreens]);

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
    unreadNewsCount,
    unreadPushCount,
    unreadCriticalAuditCount,
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
    handleSetTheme,
    handleSignOut,
  };
};
