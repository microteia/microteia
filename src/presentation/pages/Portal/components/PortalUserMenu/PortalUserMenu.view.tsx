import React from 'react';
import { RiCheckLine, RiLogoutBoxRLine, RiSwapLine } from 'react-icons/ri';
import { S } from './PortalUserMenu.styles';
import type { PortalShellViewModel } from '../PortalShell/PortalShell.viewmodel';
import { useT } from '../../../../shared/i18n/useT';

/** O canto do usuário: quem está conectado, o tema, a troca de escritório e a saída. */
export const PortalUserMenu: React.FC<{ shell: PortalShellViewModel }> = ({ shell: { attachUserMenu, ...shell } }) => {
  const t = useT('core.tenant');
  const avatar = (
    <S.Avatar>
      {shell.user.photoURL ? <S.AvatarImg src={shell.user.photoURL} alt="" referrerPolicy="no-referrer" /> : shell.user.initials}
    </S.Avatar>
  );

  return (
    <S.Wrapper ref={attachUserMenu}>
      <S.Trigger
        type="button"
        $open={shell.userMenuOpen}
        onClick={shell.toggleUserMenu}
        aria-haspopup="menu"
        aria-expanded={shell.userMenuOpen}
        title={t('portal.user.menu')}
      >
        {avatar}
      </S.Trigger>

      {shell.userMenuOpen && (
        <S.Panel role="menu">
          <S.Identity>
            {avatar}
            <S.IdentityText>
              {shell.user.name && <S.Name>{shell.user.name}</S.Name>}
              <S.Email>{shell.user.email}</S.Email>
            </S.IdentityText>
          </S.Identity>
          <S.SectionLabel>{t('portal.user.theme')}</S.SectionLabel>
          {shell.themes.map((theme) => (
            <S.Item key={theme.id} type="button" role="menuitemradio" aria-checked={theme.active} $active={theme.active} onClick={() => shell.setTheme(theme.id)}>
              <S.Swatch $background={theme.backgroundColor} $primary={theme.primaryColor} />
              {theme.label}
              {theme.active && <S.Check><RiCheckLine size={16} /></S.Check>}
            </S.Item>
          ))}
          <S.Divider />
          {shell.canSwitchOrganization && (
            <S.Item type="button" role="menuitem" onClick={shell.switchOrganization}>
              <RiSwapLine size={16} />
              {t('portal.switch')}
            </S.Item>
          )}
          <S.Item type="button" role="menuitem" onClick={shell.signOut}>
            <RiLogoutBoxRLine size={16} />
            {t('portal.sign-out')}
          </S.Item>
        </S.Panel>
      )}
    </S.Wrapper>
  );
};
