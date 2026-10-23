import { useState, useCallback, useMemo } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useAuth } from '../../../../stores/useAuth';
import { useAuthorization } from '../../../../stores/useAuthorization';
import { useTheme, AUTOMATIC_THEME } from '../../../../stores/useTheme';
import { useCommandPalette } from '../../../../stores/useCommandPalette';
import { useScreenDefinitions } from '../../../../stores/useScreenDefinitions';
import { buildListTabKey } from '../../../../shared/constants/dynamicScreenKeys';
import { getScreenIcon } from '../../../shared/screenIcons';
import { useNavContributions, useNavGroupContributions } from '../../../shared/useUiContributions';
import { useNavBadgeCount } from '../../../shared/useNavBadgeCount';
import { menuActionTarget, useNavEntryResolver, useNavTargetResolver, useOpenNavEntry } from '../../../shared/useNavTarget';
import { declaredNavGroups, groupNavSections, splitFavoriteNavItems, visibleNavItems } from '../../../shared/resolveUiContributions';
import { screenReadPermission } from '../../../../domain/services/screenDataCollection';
import { DYNAMIC_SCREEN_NAV_ORDER, USER_MENU_SURFACE } from '../../../../domain/schema/ui/uiExtensionPoints';
import { useSurfaceMenuItems, type SurfaceMenuItemDescriptor } from '../../../shared/settings/useSettingsCatalog';
import { useSurfaceMenuLayout } from '../../../shared/settings/useSettingValue';
import { useSettings } from '../../../../stores/useSettings';
import { useNotification } from '../../../../stores/useNotification';
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
  /** Está nos favoritos. É o que decide se o botão ao lado do item fixa ou desafixa. */
  pinned: boolean;
  requiresTenantAdmin?: boolean;
}

/**
 * Um trecho da barra lateral. `label` nulo é o trecho de itens soltos, sem título.
 *
 * `items` são os que aparecem: o grupo recolhido ainda mostra o item da aba ativa, para a pessoa não
 * perder de vista onde está. Com a barra recolhida nenhum grupo recolhe — ali não há título onde
 * clicar para abrir. `badge` soma os selos dos itens escondidos, e é o que o título mostra.
 */
export interface NavSectionView {
  key: string;
  label: string | null;
  collapsed: boolean;
  badge: number;
  items: NavItem[];
}

const COLLAPSED_GROUPS_KEY = 'microteia:sidebarCollapsedGroups';

/**
 * Os itens fixados vivem na configuração do USUÁRIO, por escritório: as chaves de tela de um
 * escritório não existem no outro, e a pessoa encontra os mesmos favoritos em qualquer aparelho.
 */
const FAVORITES_SETTING_KEY = 'sidebar.favorites';

/** A seção dos favoritos. O `@` a separa de qualquer `key` de grupo declarada por extensão. */
const FAVORITES_SECTION_KEY = '@favorites';

const readFavoriteKeys = (value: unknown): string[] =>
  Array.isArray(value) ? value.filter((key): key is string => typeof key === 'string' && key !== '') : [];

/**
 * O que a pessoa recolheu, por grupo. É conveniência de quem usa, e não dado: num navegador sem
 * armazenamento, ou com ele limpo, vale o `defaultCollapsed` de cada grupo.
 */
const readCollapsedGroups = (): Record<string, boolean> => {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(COLLAPSED_GROUPS_KEY) ?? '{}');
    return parsed && typeof parsed === 'object' ? (parsed as Record<string, boolean>) : {};
  } catch {
    return {};
  }
};

const writeCollapsedGroups = (value: Record<string, boolean>): void => {
  try {
    localStorage.setItem(COLLAPSED_GROUPS_KEY, JSON.stringify(value));
  } catch {
    // Sem armazenamento, o grupo continua recolhendo — só não lembra na próxima visita.
  }
};

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
}

export interface WorkspaceSidebarViewModel {
  collapsed: boolean;
  /** O menu em trechos. Sem grupo declarado, é um trecho só, sem título — o menu de sempre. */
  navSections: NavSectionView[];
  activeKey: string | null;
  isMenuOpen: boolean;
  isThemeSubOpen: boolean;
  /**
   * Os itens do menu, agrupados. Um grupo é o que aparece entre dois divisores; a barra lateral não
   * sabe quantos são nem o que há em cada um.
   */
  menuGroups: SidebarMenuItem[][];
  user: User | null;
  effectivePhotoURL: string | null;
  effectiveName: string;
  themeId: string;
  themeOptions: SidebarThemeOption[];
  searchShortcut: string;
  toggleCollapse: () => void;
  toggleNavGroup: (key: string) => void;
  toggleFavorite: (key: string) => void;
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
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>(readCollapsedGroups);

  const { openTab, panels, activePanelId } = useWorkspace();
  const { userRole, user, effectivePhotoURL, effectiveName, signOut } = useAuth();
  const { can, canAny } = useAuthorization();
  const { themeId, preferred: preferredTheme, available: themes, setTheme } = useTheme();
  const { open: openCommandPalette } = useCommandPalette();
  const { unreadCriticalCount: unreadCriticalAuditCount } = useAuditLogAlert();
  const { pendingInUse: extensionUpdates } = useExtensionUpdates();
  const { sidebarScreens } = useScreenDefinitions();
  const navContributions = useNavContributions();
  const navGroupContributions = useNavGroupContributions();
  const registeredMenuItems = useSurfaceMenuItems(USER_MENU_SURFACE);
  const { entries: menuEntries } = useSurfaceMenuLayout(USER_MENU_SURFACE);
  const { values: settingsValues, setValue: setSettingValue } = useSettings();
  const { notify } = useNotification();
  const favoriteKeys = useMemo(
    () => readFavoriteKeys(settingsValues.user[FAVORITES_SETTING_KEY]),
    [settingsValues.user],
  );

  const searchShortcut = /Mac|iPhone|iPod|iPad/.test(navigator.platform) ? '⌘K' : 'Ctrl K';

  const activeKey = panels[activePanelId]?.activeTabKey ?? null;
  const isSystemAdmin = userRole === 'SYSTEM';

  /**
   * O selo de cada item. Duas origens: a DECLARADA (`badge` da contribuição), que é uma contagem de
   * registros — e enxerga `user`, então conta também o que ESTE usuário não leu —, e a do kernel:
   * falhas críticas de auditoria ainda não vistas, e extensões com atualização à espera. Esta não se
   * apaga ao entrar na tela, como a da auditoria: some quando a última atualização é aplicada, porque
   * o que ela conta é uma pendência e não uma notícia.
   */
  const badgeCount = useNavBadgeCount();
  const resolveTarget = useNavTargetResolver();
  const resolveEntry = useNavEntryResolver();
  const openEntry = useOpenNavEntry();
  const kernelBadge = useCallback((key: string): number => {
    if (key === 'audit-logs') return unreadCriticalAuditCount;
    if (key === 'marketplace') return extensionUpdates;
    return 0;
  }, [unreadCriticalAuditCount, extensionUpdates]);

  const label = useLabel();

  const navItems = useMemo(() => {
    // O item que não leva a lugar nenhum neste escritório não aparece: a tela que ele aponta foi
    // desligada, ou a pessoa não pode lê-la.
    const contributed = visibleNavItems(navContributions, canAny, isSystemAdmin).flatMap((item) => {
      const entry = resolveEntry(item);
      if (entry === null) return [];
      const key = entry.tabKey;
      return [{
        key,
        label: label(item.label),
        icon: getScreenIcon(item.icon, 20),
        order: item.order,
        group: item.group,
        badge: item.badge ? badgeCount(item.badge) : kernelBadge(key),
        intent: entry.intent,
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
      intent: undefined,
    }));

    return [...contributed, ...dynamicItems].sort((a, b) => a.order - b.order);
  }, [navContributions, canAny, isSystemAdmin, can, sidebarScreens, badgeCount, kernelBadge, resolveEntry, label]);

  const navGroups = useMemo(() => declaredNavGroups(navGroupContributions), [navGroupContributions]);

  /**
   * Os favoritos são um grupo como os declarados — recolhem, mostram o item da aba ativa e somam os
   * selos escondidos no título —, com duas diferenças: encabeçam o menu e têm título mesmo com um item
   * só, porque são a pessoa quem os pediu. O item fixado SAI do grupo de origem.
   */
  const navSections = useMemo<NavSectionView[]>(() => {
    const toSection = (key: string, sectionLabel: string, items: NavItem[], defaultCollapsed: boolean): NavSectionView => {
      const groupCollapsed = !collapsed && (collapsedGroups[key] ?? defaultCollapsed);
      const hidden = groupCollapsed ? items.filter((item) => item.key !== activeKey) : [];
      return {
        key,
        label: sectionLabel,
        collapsed: groupCollapsed,
        badge: hidden.reduce((sum, item) => sum + item.badge, 0),
        items: groupCollapsed ? items.filter((item) => item.key === activeKey) : items,
      };
    };

    const { favorites, rest } = splitFavoriteNavItems(navItems, favoriteKeys);
    const toItem = (pinned: boolean) => ({ key, label, icon, badge }: Omit<NavItem, 'pinned'>): NavItem => ({ key, label, icon, badge, pinned });

    const sections = groupNavSections(rest, navGroups).map((section, index): NavSectionView => {
      const items = section.items.map(toItem(false));
      if (!section.group) return { key: `loose-${index}`, label: null, collapsed: false, badge: 0, items };
      return toSection(section.group.key, label(section.group.label), items, section.group.defaultCollapsed === true);
    });
    if (favorites.length === 0) return sections;
    return [
      toSection(FAVORITES_SECTION_KEY, label('@core.ui/sidebar.favorites'), favorites.map(toItem(true)), false),
      ...sections,
    ];
  }, [navItems, favoriteKeys, navGroups, collapsedGroups, activeKey, collapsed, label]);

  const toggleNavGroup = useCallback((key: string) => {
    const section = navSections.find((candidate) => candidate.key === key);
    if (!section) return;
    const next = { ...collapsedGroups, [key]: !section.collapsed };
    setCollapsedGroups(next);
    writeCollapsedGroups(next);
  }, [navSections, collapsedGroups]);

  const toggleFavorite = useCallback((key: string) => {
    const next = favoriteKeys.includes(key)
      ? favoriteKeys.filter((candidate) => candidate !== key)
      : [...favoriteKeys, key];
    setSettingValue('user', FAVORITES_SETTING_KEY, next)
      .catch(() => notify(label('@core.ui/sidebar.favorites.save-failed'), 'error'));
  }, [favoriteKeys, setSettingValue, notify, label]);

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
    openEntry({ tabKey: key, intent: navItems.find((item) => item.key === key)?.intent });
  }, [openEntry, navItems]);

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

  const menuGroups = useMemo<SidebarMenuItem[][]>(() => {
    const groups = new Map<string, SidebarMenuItem[]>();
    for (const item of visibleMenuItems) {
      const group = item.group ?? '';
      const resolved: SidebarMenuItem = {
        key: item.key,
        label: item.title,
        icon: item.icon ? getScreenIcon(item.icon, 16) : null,
        danger: item.danger === true,
      };
      const existing = groups.get(group);
      if (existing) existing.push(resolved);
      else groups.set(group, [resolved]);
    }
    return Array.from(groups.values());
  }, [visibleMenuItems]);

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
    navSections,
    activeKey,
    isMenuOpen,
    isThemeSubOpen,
    menuGroups,
    user,
    effectivePhotoURL,
    effectiveName,
    themeId: preferredTheme ?? AUTOMATIC_THEME,
    themeOptions,
    searchShortcut,
    toggleCollapse,
    toggleNavGroup,
    toggleFavorite,
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
