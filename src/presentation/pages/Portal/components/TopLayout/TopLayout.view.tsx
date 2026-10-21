import React from 'react';
import { RiCloseLine, RiHome5Line, RiMenuLine } from 'react-icons/ri';
import { S } from './TopLayout.styles';
import { usePortalShellViewModel } from '../PortalShell/PortalShell.viewmodel';
import { PortalBrand } from '../PortalBrand';
import { PortalUserMenu } from '../PortalUserMenu';
import { getScreenIcon } from '../../../../shared/screenIcons';
import { useT } from '../../../../shared/i18n/useT';

/** O menu numa faixa no topo, ao lado da marca — para portais de poucos itens. */
export const TopLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const shell = usePortalShellViewModel();
  const t = useT('core.tenant');
  const hasMenu = shell.menu.length > 0;

  return (
    <S.Frame>
      <S.Header>
        {hasMenu && (
          <S.MenuButton type="button" onClick={shell.toggleNav} aria-label={t('portal.nav.open')}>
            {shell.navOpen ? <RiCloseLine size={20} /> : <RiMenuLine size={20} />}
          </S.MenuButton>
        )}
        <S.BrandSlot>
          <PortalBrand name={shell.tenant.name || t('portal.title')} logoURL={shell.tenant.logoURL} onClick={shell.goHome} />
        </S.BrandSlot>
        {hasMenu ? (
          <S.Nav aria-label={t('portal.nav')}>
            <S.NavItem type="button" $active={shell.home.active} onClick={shell.goHome}>
              <RiHome5Line size={16} />
              {shell.home.title}
            </S.NavItem>
            {shell.menu.map((item) => (
              <S.NavItem key={item.id} type="button" $active={item.active} onClick={() => shell.openEntry(item.id)}>
                {getScreenIcon(item.icon, 16)}
                {item.title}
              </S.NavItem>
            ))}
          </S.Nav>
        ) : <S.Grow />}
        {hasMenu && <S.Spacer />}
        <PortalUserMenu shell={shell} />
      </S.Header>

      {shell.navOpen && hasMenu && (
        <S.Drawer>
          <S.DrawerItem type="button" $active={shell.home.active} onClick={shell.goHome}>
            <RiHome5Line size={18} />
            {shell.home.title}
          </S.DrawerItem>
          {shell.menu.map((item) => (
            <S.DrawerItem key={item.id} type="button" $active={item.active} onClick={() => shell.openEntry(item.id)}>
              {getScreenIcon(item.icon, 18)}
              {item.title}
            </S.DrawerItem>
          ))}
        </S.Drawer>
      )}

      <S.Content>{children}</S.Content>
    </S.Frame>
  );
};
