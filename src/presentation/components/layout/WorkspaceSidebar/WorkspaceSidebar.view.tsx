import React from 'react';
import {
  RiSidebarFoldLine,
  RiSidebarUnfoldLine,
  RiUserLine,
  RiShieldUserLine,
  RiCheckLine,
  RiLogoutBoxLine,
  RiMoreLine,
  RiPaletteLine,
  RiLayoutGridLine,
  RiArrowRightSLine,
  RiSearchLine,
  RiFlowChart,
  RiCodeBoxLine,
  RiCursorLine,
  RiSparkling2Line,
  RiStoreLine,
} from 'react-icons/ri';
import { useWorkspaceSidebarViewModel } from './WorkspaceSidebar.viewmodel';
import { S } from './WorkspaceSidebar.styles';
import { UserAvatar } from '../../ui/UserAvatar';

export const WorkspaceSidebar: React.FC = () => {
  const vm = useWorkspaceSidebarViewModel();

  return (
    <S.Container $collapsed={vm.collapsed}>
      <S.LogoArea $collapsed={vm.collapsed}>
        <S.LogoLeft>
          <S.LogoIcon $collapsed={vm.collapsed}>
            <img src="/logo.png" alt="Microteia" />
          </S.LogoIcon>
          {!vm.collapsed && (
            <S.LogoText>
              <S.AppNameRow>
                <S.AppName>Microteia</S.AppName>
              </S.AppNameRow>
              <S.AppTagline>Curador da Advocacia</S.AppTagline>
            </S.LogoText>
          )}
        </S.LogoLeft>

        <S.CollapseButton onClick={vm.toggleCollapse} title={vm.collapsed ? 'Expandir menu' : 'Recolher menu'}>
          {vm.collapsed
            ? <RiSidebarUnfoldLine size={18} />
            : <RiSidebarFoldLine size={18} />
          }
        </S.CollapseButton>
      </S.LogoArea>

      <S.SearchTrigger
        $collapsed={vm.collapsed}
        onClick={vm.openCommandPalette}
        title={vm.collapsed ? `Pesquisar (${vm.searchShortcut})` : undefined}
      >
        <RiSearchLine size={15} />
        {!vm.collapsed && (
          <>
            <S.SearchLabel>Pesquisar…</S.SearchLabel>
            <S.SearchKbd>{vm.searchShortcut}</S.SearchKbd>
          </>
        )}
      </S.SearchTrigger>

      <S.Nav>
        {!vm.collapsed && <S.NavLabel>Menu</S.NavLabel>}
        {vm.navItems.map(({ key, label, icon, badge }) => {
          return (
            <S.NavItem
              key={key}
              $active={vm.activeKey === key}
              onClick={() => vm.handleNavClick(key)}
              title={vm.collapsed ? label : undefined}
            >
              {icon}
              {!vm.collapsed && label}
              {!vm.collapsed && badge > 0 && (
                <S.NavBadge>{badge > 99 ? '99+' : badge}</S.NavBadge>
              )}
              {vm.collapsed && badge > 0 && <S.NavBadgeDot />}
            </S.NavItem>
          );
        })}
      </S.Nav>

      <S.UserSection>
        {vm.isMenuOpen && (
          <>
            <S.MenuOverlay onClick={vm.closeMenu} />
            <S.UserMenu>
              <S.MenuGroup>
                <S.MenuItem onClick={vm.handleProfileClick}>
                  <RiUserLine size={16} />
                  Meu Perfil
                </S.MenuItem>
                {vm.isAdmin && (
                  <S.MenuItem onClick={vm.handleAccessManagementClick}>
                    <RiShieldUserLine size={16} />
                    Gestão de Acessos
                  </S.MenuItem>
                )}
                {vm.canAccessScreenBuilder && (
                  <S.MenuItem onClick={vm.handleScreenBuilderClick}>
                    <RiLayoutGridLine size={16} />
                    Form Design
                  </S.MenuItem>
                )}
                {vm.canAccessScreenBuilder && (
                  <S.MenuItem onClick={vm.handleWorkflowsClick}>
                    <RiFlowChart size={16} />
                    Workflow
                  </S.MenuItem>
                )}
                {vm.canAccessScreenBuilder && (
                  <S.MenuItem onClick={vm.handleScriptsClick}>
                    <RiCodeBoxLine size={16} />
                    Scripts
                  </S.MenuItem>
                )}
                {vm.canAccessScreenBuilder && (
                  <S.MenuItem onClick={vm.handleActionsClick}>
                    <RiCursorLine size={16} />
                    Ações
                  </S.MenuItem>
                )}
                {vm.canAccessDataProcessor && (
                  <S.MenuItem onClick={vm.handleDataProcessorClick}>
                    <RiSparkling2Line size={16} />
                    Processador de Dados
                  </S.MenuItem>
                )}
                {vm.canAccessScreenBuilder && (
                  <S.MenuItem onClick={vm.handleMarketplaceClick}>
                    <RiStoreLine size={16} />
                    Extensões
                  </S.MenuItem>
                )}
              </S.MenuGroup>

              <S.MenuDivider />

              <S.MenuGroup>
                <S.ThemeSubToggle onClick={vm.toggleThemeSub}>
                  <RiPaletteLine size={16} />
                  Aparência
                  <S.ThemeSubArrow $open={vm.isThemeSubOpen}>
                    <RiArrowRightSLine size={16} />
                  </S.ThemeSubArrow>
                </S.ThemeSubToggle>
                {vm.isThemeSubOpen && (
                  <S.ThemeSubMenu>
                    {vm.themeOptions.map((option) => (
                      <S.ThemeSubItem
                        key={option.mode}
                        $active={vm.mode === option.mode}
                        onClick={() => vm.handleSetTheme(option.mode)}
                      >
                        <S.ThemeDot $bg={option.bgColor} $primary={option.primaryColor} />
                        {option.label}
                        {vm.mode === option.mode && (
                          <S.ThemeCheck>
                            <RiCheckLine size={12} />
                          </S.ThemeCheck>
                        )}
                      </S.ThemeSubItem>
                    ))}
                  </S.ThemeSubMenu>
                )}
              </S.MenuGroup>

              <S.MenuDivider />

              <S.MenuGroup>
                <S.MenuItem $danger onClick={vm.handleSignOut}>
                  <RiLogoutBoxLine size={16} />
                  Sair
                </S.MenuItem>
              </S.MenuGroup>
            </S.UserMenu>
          </>
        )}

        <S.UserMenuTrigger onClick={vm.toggleMenu} title="Menu do usuário">
          <UserAvatar
            src={vm.effectivePhotoURL}
            name={vm.effectiveName ?? 'U'}
            size={30}
            showBorder
            referrerPolicy="no-referrer"
          />

          {!vm.collapsed && (
            <>
              <S.UserInfo>
                <S.UserName>{vm.effectiveName}</S.UserName>
              </S.UserInfo>
              <S.UserChevron>
                <RiMoreLine size={16} />
              </S.UserChevron>
            </>
          )}
        </S.UserMenuTrigger>
      </S.UserSection>
    </S.Container>
  );
};
