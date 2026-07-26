import React from 'react';
import { RiMenuLine, RiCloseLine } from 'react-icons/ri';
import { usePublicHeaderViewModel } from './PublicHeader.viewmodel';
import { S } from './PublicHeader.styles';

export const PublicHeader: React.FC = () => {
  const vm = usePublicHeaderViewModel();

  return (
    <S.Header>
      <S.Bar>
        <S.LogoButton onClick={() => vm.goTo('/')}>
          <img src="/logo.png" alt="Microteia" />
          <span>Microteia</span>
        </S.LogoButton>

        <S.Nav $open={vm.isMenuOpen}>
          {vm.links.map((link) => (
            <S.NavLink key={link.to} $active={vm.isActive(link.to)} onClick={() => vm.goTo(link.to)}>
              {link.label}
            </S.NavLink>
          ))}
          <S.EnterButton onClick={vm.goToLogin}>Entrar</S.EnterButton>
        </S.Nav>

        <S.MenuToggle onClick={vm.toggleMenu} aria-label="Abrir menu">
          {vm.isMenuOpen ? <RiCloseLine size={24} /> : <RiMenuLine size={24} />}
        </S.MenuToggle>
      </S.Bar>
    </S.Header>
  );
};
