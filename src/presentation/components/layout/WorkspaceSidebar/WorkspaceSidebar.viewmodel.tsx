import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useTheme, AUTOMATIC_THEME } from '../../../../stores/useTheme';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { buildListTabKey } from '../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useNavContributions } from '../../../shared/useUiContributions';
import { useNavBadgeCount } from '../../../shared/useNavBadgeCount';
import { menuActionTarget, useNavTargetResolver } from '../../../shared/useNavTarget';
import { visibleNavItems } from '../../../shared/resolveUiContributions';
import { screenReadPermission } from '../../../../domain/services/screenDataCollection';
import { DYNAMIC_SCREEN_NAV_ORDER, USER_MENU_SURFACE } from '../../../../domain/schema/ui/uiExtensionPoints';
import { useSurfaceMenuItems, type SurfaceMenuItemDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { useSurfaceMenuLayout } from '../../../shared/settings/useSettingValue';
import { useAuditLogAlert } from '../../../../stores/useAuditLogAlert';
import { useExtensionUpdates } from '../../../shared/useExtensionUpdates';
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

/**
 * Um item do menu do usuário, já resolvido: rótulo traduzido, ícone montado, permissão conferida. O
 * que ele FAZ não vem daqui — vem da `action` da contribuição, executada por `handleMenuItemClick`.
 */
export interface SidebarMenuItem {
  key: string;
  label: string;
  icon: React.ReactNode;
  danger: boolean;
  /** Contador do item, no mesmo contrato do `badge` da barra: `0` = sem selo. */
  badge: number;
}

export interface WorkspaceSidebarViewModel {
  collapsed: boolean;
  navItems: NavItem[];
  activeKey: string | null;
  isMenuOpen: boolean;
  isThemeSubOpen: boolean;
  /**
   * Os itens do menu, agrupados. Um grupo é o que aparece entre dois divisores; a barra lateral não
   * sabe quantos são nem o que há em cada um.
   */
  menuGroups: SidebarMenuItem[][];
  /**
   * Há selo em algum item do menu do usuário. O menu vive fechado, então sem isto o selo só apareceria
   * para quem já tivesse aberto o menu — inútil justamente para o que ele existe: avisar antes.
   */
  hasMenuBadge: boolean;
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
  handleMenuItemClick: (key: string) => void;
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
  const { pendingInUse: extensionUpdates } = useExtensionUpdates();
  const { sidebarScreens } = useScreenDefinitions();
  const navContributions = useNavContributions();
  const registeredMenuItems = useSurfaceMenuItems(USER_MENU_SURFACE);
  const { entries: menuEntries } = useSurfaceMenuLayout(USER_MENU_SURFACE);

  const searchShortcut = /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const activeKey = panels[activePanelId]?.activeTabKey ?? null;
  const isSystemAdmin = userRole === 'SYSTEM';

  /**
   * O selo de cada item. Duas origens: a DECLARADA (`badge` da contribuição), que é uma contagem de
   * registros — e enxerga `user`, então conta também o que ESTE usuário não leu —, e a de baixo, que
   * conta falhas críticas de auditoria ainda não vistas: o único selo que resta no kernel.
   */
  const badgeCount = useNavBadgeCount();
  const resolveTarget = useNavTargetResolver();
  const kernelBadge = useCallback((key: string): number => {
    if (key === 'audit-logs') return unreadCriticalAuditCount;
    return 0;
  }, [unreadCriticalAuditCount]);

  const label = useLabel();

  const navItems = useMemo(() => {
    // O item que não leva a lugar nenhum neste escritório não aparece: a tela que ele aponta foi
    // desligada, ou a pessoa não pode lê-la.
    const contributed = visibleNavItems(navContributions, canAny).flatMap((item) => {
      const key = resolveTarget(item);
      if (key === null) return [];
      return [{
        key,
        label: label(item.label),
        icon: getScreenIcon(item.icon, 20),
        order: item.order,
        badge: item.badge ? badgeCount(item.badge) : kernelBadge(key),
      }];
    });
    const contributedKeys = new Set(contributed.map((item) => item.key));

    // Ver a tela é ler a coleção dela. O item aparecia para quem não tinha `<coleção>.read`, e o
    // que a pessoa encontrava ao clicar era uma lista permanentemente vazia — a regra do servidor
    // negava tudo, mas o menu prometia. Aqui não há `canAny` porque não há alternativa: é UMA
    // permissão, a mesma que o catálogo derivou da tela.
    // A tela que uma extensão já pôs no menu com `nav({ screen })` não ganha um segundo item: o
    // declarado vence, porque é ele que carrega o selo e a posição.
    const dynamicItems = sidebarScreens
      .filter((def) => can(screenReadPermission(def)))
      .filter((def) => !contributedKeys.has(buildListTabKey(def.id)))
      .map((def) => ({
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
  }, [navContributions, canAny, can, sidebarScreens, badgeCount, kernelBadge, resolveTarget, label]);

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

  /**
   * Os itens que ESTA pessoa vê, na ordem que a configuração mandar, agrupados. O item que a extensão
   * dona não trouxe simplesmente não está aqui — foi o que fez as oito linhas escritas à mão saírem
   * daqui: elas prometiam abas (`screen-builder`, `marketplace`) que o kernel não sabe renderizar
   * quando o plugin dono sai.
   */
  const visibleMenuItems = useMemo<SurfaceMenuItemDescriptor[]>(() => {
    const byKey = new Map(registeredMenuItems.map((item) => [item.key, item]));
    return menuEntries
      .filter((entry) => entry.enabled)
      .map((entry) => byKey.get(entry.key))
      .filter((item): item is SurfaceMenuItemDescriptor => !!item)
      .filter((item) => !item.requiresSystemAdmin || isSystemAdmin)
      .filter((item) => !item.requiredPermissions?.length || canAny(item.requiredPermissions))
      .filter((item) => item.action.kind !== 'openTab' || resolveTarget(menuActionTarget(item.action)) !== null);
  }, [registeredMenuItems, menuEntries, isSystemAdmin, canAny, resolveTarget]);

  /**
   * O selo de um item do MENU DO USUÁRIO. Hoje há um: as extensões com atualização à espera. Ele não
   * se apaga ao entrar na tela, como o da auditoria: some quando a última atualização é aplicada,
   * porque o que ele conta é uma pendência e não uma notícia.
   */
  const menuBadge = useCallback(
    (key: string): number => (key === 'marketplace' ? extensionUpdates : 0),
    [extensionUpdates],
  );

  const menuGroups = useMemo<SidebarMenuItem[][]>(() => {
    const groups = new Map<string, SidebarMenuItem[]>();
    for (const item of visibleMenuItems) {
      const group = item.group ?? '';
      const resolved: SidebarMenuItem = {
        key: item.key,
        label: item.title,
        icon: item.icon ? getScreenIcon(item.icon, 16) : null,
        danger: item.danger === true,
        badge: menuBadge(item.key),
      };
      const existing = groups.get(group);
      if (existing) existing.push(resolved);
      else groups.set(group, [resolved]);
    }
    return Array.from(groups.values());
  }, [visibleMenuItems, menuBadge]);

  const hasMenuBadge = useMemo(
    () => menuGroups.some((group) => group.some((item) => item.badge > 0)),
    [menuGroups],
  );

  const handleMenuItemClick = useCallback((key: string) => {
    const item = visibleMenuItems.find((candidate) => candidate.key === key);
    closeMenu();
    if (!item) return;
    if (item.action.kind === 'openTab') {
      const tabKey = resolveTarget(menuActionTarget(item.action));
      if (tabKey !== null) openTab(tabKey);
      return;
    }
    // `noopener` sempre: o endereço é declarado por uma extensão, e a página aberta não pode alcançar
    // esta pela `window.opener`.
    if (item.action.newTab) window.open(item.action.href, '_blank', 'noopener,noreferrer');
    else window.location.assign(item.action.href);
  }, [visibleMenuItems, openTab, closeMenu, resolveTarget]);

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
    menuGroups,
    hasMenuBadge,
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
    handleMenuItemClick,
    handleSetTheme,
    handleSignOut,
  };
};
