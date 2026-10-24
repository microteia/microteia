import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../../../../stores/useAuth';
import { usePortal } from '../../../../../stores/usePortal';
import { useTheme, AUTOMATIC_THEME } from '../../../../../stores/useTheme';
import { useLabel, useT } from '../../../../shared/i18n/useT';
import { PORTAL_PATH, PORTAL_PROFILE_ENTRY, portalEntryPath, portalTenantPath } from '../../portalPaths';
import { portalGuestName } from '../../../../../domain/schema/portal';

export interface PortalShellMenuItem {
  id: string;
  title: string;
  icon: string;
  active: boolean;
}

export interface PortalShellThemeOption {
  id: string;
  label: string;
  primaryColor: string;
  backgroundColor: string;
  active: boolean;
}

/**
 * O que QUALQUER casca do portal precisa para se desenhar — a do kernel ou a de uma extensão
 * (`usePortalShell()` em `@microteia/portal`). Os dados não mudam de layout para layout; muda onde
 * cada um fica. O estado de abrir e fechar (a gaveta do celular, o menu do usuário) vem junto, para
 * a casca não ter de reinventá-lo.
 */
export interface PortalShellViewModel {
  tenant: { name: string; logoURL: string | null };
  home: { title: string; active: boolean };
  menu: PortalShellMenuItem[];
  /** O título do que está aberto — "Início", ou o nome do item do menu. */
  pageTitle: string;
  openEntry: (id: string) => void;
  goHome: () => void;
  user: { name: string; email: string; initials: string; photoURL: string | null };
  /** Abre o perfil do convidado — o nome que ele informa a este escritório. */
  openProfile: () => void;
  themes: PortalShellThemeOption[];
  setTheme: (id: string) => void;
  /** Convidado de mais de um escritório: o seletor de escritório. */
  canSwitchOrganization: boolean;
  switchOrganization: () => void;
  signOut: () => void;
  navOpen: boolean;
  toggleNav: () => void;
  closeNav: () => void;
  userMenuOpen: boolean;
  toggleUserMenu: () => void;
  /** O elemento do menu do usuário — um clique fora dele o fecha. */
  attachUserMenu: (node: HTMLElement | null) => void;
}

const initialsOf = (name: string): string =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase() ?? '').join('') || '?';

export const usePortalShellViewModel = (): PortalShellViewModel => {
  const { tenantId: routeTenantId, entryId } = useParams<{ tenantId?: string; entryId?: string }>();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const portal = usePortal();
  const { themeId, preferred, available, setTheme: applyTheme } = useTheme();
  const t = useT('core.tenant');
  const label = useLabel();

  const [navOpen, setNavOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [userMenu, attachUserMenu] = useState<HTMLElement | null>(null);

  useEffect(() => {
    if (!userMenuOpen) return;
    const outside = (event: MouseEvent) => {
      if (userMenu && !userMenu.contains(event.target as Node)) setUserMenuOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', outside);
    document.addEventListener('keydown', escape);
    return () => {
      document.removeEventListener('mousedown', outside);
      document.removeEventListener('keydown', escape);
    };
  }, [userMenuOpen, userMenu]);

  const tenantPath = routeTenantId ?? '';
  const entries = useMemo(() => portal.context?.home?.menu ?? [], [portal.context]);
  const menu = useMemo<PortalShellMenuItem[]>(
    () => entries.map((one) => ({ id: one.id, title: one.title, icon: one.icon, active: one.id === entryId })),
    [entries, entryId],
  );

  const openEntry = useCallback((id: string) => {
    setNavOpen(false);
    navigate(portalEntryPath(tenantPath, id));
  }, [navigate, tenantPath]);
  const goHome = useCallback(() => {
    setNavOpen(false);
    navigate(portalTenantPath(tenantPath));
  }, [navigate, tenantPath]);

  // A amostra do "Automático" é a do tema EM VIGOR — ele não tem cor própria, tem a do aparelho.
  const themes = useMemo<PortalShellThemeOption[]>(() => {
    const current = available.find((theme) => theme.id === themeId);
    const chosen = preferred ?? AUTOMATIC_THEME;
    return [
      {
        id: AUTOMATIC_THEME,
        label: label('@core.theme/theme.automatic'),
        primaryColor: current?.primaryColor ?? '',
        backgroundColor: current?.backgroundColor ?? '',
        active: chosen === AUTOMATIC_THEME,
      },
      ...available.map((theme) => ({
        id: theme.id,
        label: label(theme.name),
        primaryColor: theme.primaryColor,
        backgroundColor: theme.backgroundColor,
        active: chosen === theme.id,
      })),
    ];
  }, [available, themeId, preferred, label]);

  const accountName = user?.displayName && !user.displayName.includes('@') ? user.displayName : '';
  const name = portalGuestName(portal.profile, accountName);
  const active = menu.find((one) => one.active);
  const atProfile = entryId === PORTAL_PROFILE_ENTRY;

  return {
    tenant: { name: portal.context?.tenantName ?? '', logoURL: portal.context?.logoURL ?? null },
    home: { title: t('portal.home'), active: !entryId },
    menu,
    pageTitle: active?.title ?? (atProfile ? t('portal.profile') : t('portal.home')),
    openEntry,
    goHome,
    user: { name, email: user?.email ?? '', initials: initialsOf(name || user?.email || ''), photoURL: user?.photoURL ?? null },
    openProfile: () => {
      setUserMenuOpen(false);
      setNavOpen(false);
      navigate(portalEntryPath(tenantPath, PORTAL_PROFILE_ENTRY));
    },
    themes,
    setTheme: (id) => {
      applyTheme(id);
      setUserMenuOpen(false);
    },
    canSwitchOrganization: portal.memberships.length > 1,
    switchOrganization: () => {
      setUserMenuOpen(false);
      navigate(PORTAL_PATH);
    },
    signOut: () => {
      setUserMenuOpen(false);
      void signOut();
    },
    navOpen,
    toggleNav: () => setNavOpen((open) => !open),
    closeNav: () => setNavOpen(false),
    userMenuOpen,
    toggleUserMenu: () => setUserMenuOpen((open) => !open),
    attachUserMenu,
  };
};
