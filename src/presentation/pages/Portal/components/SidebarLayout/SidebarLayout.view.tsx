import React from 'react';
import { RiHome5Line, RiMenuLine } from 'react-icons/ri';
import { S } from './SidebarLayout.styles';
import { usePortalShellViewModel } from '../PortalShell/PortalShell.viewmodel';
import { PortalBrand } from '../PortalBrand';
import { PortalUserMenu } from '../PortalUserMenu';
import { PortalNotificationBell } from '../PortalNotificationBell';
import { getScreenIcon } from '../../../../shared/screenIcons';
import { useT } from '../../../../shared/i18n/useT';

/** O layout padrão do portal: a marca e o menu numa coluna, o conteúdo ao lado. */
export const SidebarLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shell = usePortalShellViewModel();
  const t = useT('core.tenant');

  return (
    <S.Frame>
      <S.Sidebar $open={shell.navOpen}>
        <PortalBrand name={shell.tenant.name} logoURL={shell.tenant.logoURL} onClick={shell.goHome} />
        <S.Nav aria-label={t('portal.nav')}>
          <S.NavItem type="button" $active={shell.home.active} onClick={shell.goHome}>
            <RiHome5Line size={18} />
            <S.NavLabel>{shell.home.title}</S.NavLabel>
          </S.NavItem>
          {shell.menu.map((item) => (
            <S.NavItem key={item.id} type="button" $active={item.active} onClick={() => shell.openEntry(item.id)}>
              {getScreenIcon(item.icon, 18)}
              <S.NavLabel>{item.title}</S.NavLabel>
            </S.NavItem>
          ))}
        </S.Nav>
      </S.Sidebar>
      {shell.navOpen && <S.Backdrop onClick={shell.closeNav} />}

      <S.Main>
        <S.Topbar>
          <S.MenuButton type="button" onClick={shell.toggleNav} aria-label={t('portal.nav.open')}>
            <RiMenuLine size={20} />
          </S.MenuButton>
          <S.PageTitle>{shell.pageTitle}</S.PageTitle>
          <PortalNotificationBell />
          <PortalUserMenu shell={shell} />
        </S.Topbar>
        <S.Content>{children}</S.Content>
      </S.Main>
    </S.Frame>
  );
};
