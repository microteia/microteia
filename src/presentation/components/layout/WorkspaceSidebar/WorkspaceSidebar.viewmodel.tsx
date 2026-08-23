import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import {
  PERMISSION_AUTOMATION_MANAGE,
  PERMISSION_DATA_PROCESSOR_USE,
  PERMISSION_EXTENSIONS_MANAGE,
  PERMISSION_SCREENS_MANAGE,
} from '../../../../domain/schema/access';
import { useTheme, AUTOMATIC_THEME } from '../../../../stores/useTheme';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { buildListTabKey } from '../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useNavContributions } from '../../../shared/useUiContributions';
import { useNavBadgeCount } from '../../../shared/useNavBadgeCount';
import { visibleNavItems } from '../../../shared/resolveUiContributions';
import { DYNAMIC_SCREEN_NAV_ORDER } from '../../../../domain/schema/ui/uiExtensionPoints';
import { useAuditLogAlert } from '../../../../stores/useAuditLogAlert';
import type { User } from '../../../../domain/entities';
import { useLabel } from '../../../shared/i18n/useT';

export interface NavItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  /** Contador do item. `0` = sem selo. */
  badge: number;
  requiresTenantAdmin?: boolean;
}

/**
 * Um tema como o menu o mostra. `labelKey` deixou de existir: o nome vem da própria contribuição,
 * podendo ser referência de mensagem (nos temas do sistema) ou o texto que o escritório escreveu no
 * `.json` dele — e a amostra de cor sai do tema já montado, nunca de uma tabela paralela em código
 * que envelhecia calada a cada mudança de paleta.
 */
export interface SidebarThemeOption {
  id: string;
  label: string;
  primaryColor: string;
  bgColor: string;
}

export interface WorkspaceSidebarViewModel {
  collapsed: boolean;
  navItems: NavItem[];
  activeKey: string | null;
  isMenuOpen: boolean;
  isThemeSubOpen: boolean;
  isSystemAdmin: boolean;
  canManageScreens: boolean;
  canManageAutomation: boolean;
  canManageExtensions: boolean;
  canUseDataProcessor: boolean;
  user: User | null;
  effectivePhotoURL: string | null;
  effectiveName: string;
  themeId: string;
  themeOptions: SidebarThemeOption[];
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
  handleSetTheme: (id: string) => void;
  handleSignOut: () => void;
}

export const useWorkspaceSidebarViewModel = (): WorkspaceSidebarViewModel => {
  const [collapsed, setCollapsed] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isThemeSubOpen, setIsThemeSubOpen] = useState(false);

  const { openTab, panels, activePanelId } = useWorkspace();
  const { userRole, user, effectivePhotoURL, effectiveName, signOut } = useAuth();
  const { can, canAny } = useAuthorization();
  const { themeId, preferred: preferredTheme, available: themes, setTheme } = useTheme();
  const { open: openCommandPalette } = useCommandPalette();
  const { unreadCriticalCount: unreadCriticalAuditCount } = useAuditLogAlert();
  const { sidebarScreens } = useScreenDefinitions();
  const navContributions = useNavContributions();

  const searchShortcut = /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const activeKey = panels[activePanelId]?.activeTabKey ?? null;
  const isSystemAdmin = userRole === 'SYSTEM';
  const canManageScreens = can(PERMISSION_SCREENS_MANAGE);
  const canManageAutomation = can(PERMISSION_AUTOMATION_MANAGE);
  const canManageExtensions = can(PERMISSION_EXTENSIONS_MANAGE);
  const canUseDataProcessor = can(PERMISSION_DATA_PROCESSOR_USE);

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
    const contributed = visibleNavItems(navContributions, canAny).map((item) => ({
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
  }, [navContributions, canAny, sidebarScreens, badgeCount, kernelBadge, label]);

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

  const handleSetTheme = useCallback((id: string) => {
    setTheme(id);
    closeMenu();
  }, [setTheme, closeMenu]);

  /**
   * "Automático" encabeça a lista porque é o padrão, e porque é o único caminho de volta depois de
   * uma escolha fixa. A amostra dele é a do tema EM VIGOR: ele não tem cor própria, tem a de quem o
   * aparelho está pedindo agora.
   */
  const themeOptions = useMemo<SidebarThemeOption[]>(() => {
    const active = themes.find((theme) => theme.id === themeId);
    return [
      {
        id: AUTOMATIC_THEME,
        label: label('@core.theme/theme.automatic'),
        primaryColor: active?.primaryColor ?? '',
        bgColor: active?.backgroundColor ?? '',
      },
      ...themes.map((theme) => ({
        id: theme.id,
        label: label(theme.name),
        primaryColor: theme.primaryColor,
        bgColor: theme.backgroundColor,
      })),
    ];
  }, [themes, themeId, label]);

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
    isSystemAdmin,
    canManageScreens,
    canManageAutomation,
    canManageExtensions,
    canUseDataProcessor,
    user,
    effectivePhotoURL,
    effectiveName,
    themeId: preferredTheme ?? AUTOMATIC_THEME,
    themeOptions,
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
