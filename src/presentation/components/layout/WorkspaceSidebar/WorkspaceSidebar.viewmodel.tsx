import { useState, useCallback } from 'react';
import {
  RiDashboardLine,
  RiCalendar2Line,
  RiTimeLine,
  RiTeamLine,
  RiFolderLine,
  RiFileTextLine,
  RiMoneyDollarCircleLine,
  RiNewspaperLine,
  RiBuilding2Line,
  RiInboxLine,
} from 'react-icons/ri';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useTheme } from '../../../../stores/useTheme';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useNewsInteraction } from '../../../../stores/useNewsInteraction';
import { usePushInteraction } from '../../../../stores/usePushInteraction';
import type { User } from '../../../../domain/entities';
import type { ThemeMode } from '../../../../shared/types';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
}

export interface ThemeOption {
  mode: ThemeMode;
  label: string;
  primaryColor: string;
  bgColor: string;
}

const NAV_ITEMS: NavItem[] = [
  { key: 'dashboard',       label: 'Dashboard',           icon: <RiDashboardLine />          },
  { key: 'calendar',        label: 'Calendário',          icon: <RiCalendar2Line />          },
  { key: 'persons',         label: 'Pessoas',             icon: <RiTeamLine />               },
  { key: 'cases',           label: 'Processos',           icon: <RiFolderLine />             },
  { key: 'contracts',       label: 'Contratos',           icon: <RiFileTextLine />           },
  { key: 'deadlines',       label: 'Prazos',              icon: <RiTimeLine />               },
  { key: 'financials',      label: 'Financeiro',          icon: <RiMoneyDollarCircleLine />  },
  { key: 'pushes',          label: 'Pushes do Tribunal',  icon: <RiInboxLine />              },
  { key: 'news',            label: 'Notícias',            icon: <RiNewspaperLine />          },
  { key: 'tenant-settings', label: 'Escritório',          icon: <RiBuilding2Line />          },
];

const THEME_OPTIONS: ThemeOption[] = [
  { mode: 'curatino', label: 'Curatino',  primaryColor: '#F56B3A', bgColor: '#141414' },
  { mode: 'dark',     label: 'Escuro',    primaryColor: '#6c63ff', bgColor: '#0f1117' },
  { mode: 'light',    label: 'Claro',     primaryColor: '#6c63ff', bgColor: '#f1f5f9' },
  { mode: 'bruma',    label: 'Bruma',     primaryColor: '#5B7ED6', bgColor: '#ECEEF2' },
  { mode: 'claude',   label: 'Claude',    primaryColor: '#DA7756', bgColor: '#F5F4EE' },
  { mode: 'teams',    label: 'Teams',     primaryColor: '#6264A7', bgColor: '#1F1F1F' },
  { mode: 'kindle',   label: 'Kindle',    primaryColor: '#8B6040', bgColor: '#F6EDD9' },
];

export interface WorkspaceSidebarViewModel {
  collapsed: boolean;
  navItems: NavItem[];
  unreadNewsCount: number;
  unreadPushCount: number;
  activeKey: string | null;
  isMenuOpen: boolean;
  isThemeSubOpen: boolean;
  isAdmin: boolean;
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
  handleSetTheme: (mode: ThemeMode) => void;
  handleSignOut: () => void;
}

export const useWorkspaceSidebarViewModel = (): WorkspaceSidebarViewModel => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeSubOpen, setIsThemeSubOpen] = useState(false);

  const { openTab, panels, activePanelId } = useWorkspace();
  const { userRole, user, effectivePhotoURL, effectiveName, signOut } = useAuth();
  const { mode, setTheme } = useTheme();
  const { open: openCommandPalette } = useCommandPalette();
  const { unreadCount: unreadNewsCount } = useNewsInteraction();
  const { unreadCount: unreadPushCount } = usePushInteraction();

  const searchShortcut = /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const activeKey = panels[activePanelId]?.activeTabKey ?? null;
  const isAdmin = userRole === 'SYSTEM';

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
    navItems: NAV_ITEMS,
    unreadNewsCount,
    unreadPushCount,
    activeKey,
    isMenuOpen,
    isThemeSubOpen,
    isAdmin,
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
    handleSetTheme,
    handleSignOut,
  };
};
