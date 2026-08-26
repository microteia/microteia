import React from 'react';
import {
  RiBuildingLine,
  RiArrowDownSLine,
  RiCheckLine,
  RiLoaderLine,
  RiSearchLine,
} from 'react-icons/ri';
import { useTopBarViewModel } from './TopBar.viewmodel';
import { S } from './TopBar.styles';
import { SlotSurface } from '../SlotSurface';
import { WORKSPACE_SLOT_SURFACES } from '../../../../domain/schema/ui/uiExtensionPoints';

import { useT } from '../../../shared/i18n/useT';
export const TopBar: React.FC = () => {
  const vm = useTopBarViewModel();
  const t = useT('core.ui');

  const hasMultipleTenants = vm.availableTenants.length > 1;

  /* eslint-disable react-hooks/refs -- vm exposes refs only for DOM passing; no ref.current is read during render */
  return (
    <S.Bar>
      <S.Left>
        {vm.currentTenant && (
          <>
            <S.TenantChip
              ref={vm.tenantButtonRef}
              $clickable={hasMultipleTenants}
              $switching={vm.isSwitching}
              onClick={vm.handleTenantButtonClick}
              title={hasMultipleTenants ? t('tenant.switch') : vm.currentTenant.name}
              disabled={vm.isSwitching}
            >
              {vm.isSwitching ? (
                <S.SpinnerIcon>
                  <RiLoaderLine size={14} />
                </S.SpinnerIcon>
              ) : (
                <RiBuildingLine size={14} />
              )}
              <S.TenantName>{vm.currentTenant.name}</S.TenantName>
              {hasMultipleTenants && (
                <S.ChevronIcon $open={vm.isDropdownOpen}>
                  <RiArrowDownSLine size={14} />
                </S.ChevronIcon>
              )}
            </S.TenantChip>

            {vm.isDropdownOpen && (
              <S.Dropdown ref={vm.dropdownRef}>
                <S.DropdownHeader>{t('tenant.plural')}</S.DropdownHeader>
                {vm.availableTenants.length > 3 && (
                  <S.SearchInputWrapper>
                    <RiSearchLine size={14} />
                    <S.SearchInput
                      ref={vm.searchInputRef}
                      type="text"
                      placeholder={t('action.search')}
                      value={vm.searchQuery}
                      onChange={vm.handleSearchChange}
                    />
                  </S.SearchInputWrapper>
                )}
                {vm.filteredTenants.length === 0 ? (
                  <S.EmptyState>{t('tenant.none-found')}</S.EmptyState>
                ) : (
                  vm.filteredTenants.map((tenant) => {
                    const isActive = tenant.id === vm.currentTenant?.id;
                    return (
                      <S.DropdownItem
                        key={tenant.id}
                        $active={isActive}
                        onClick={() => vm.handleSelectTenant(tenant.id)}
                      >
                        <RiBuildingLine size={15} />
                        <S.DropdownItemName>{tenant.name}</S.DropdownItemName>
                        {isActive && (
                          <S.DropdownItemCheck>
                            <RiCheckLine size={14} />
                          </S.DropdownItemCheck>
                        )}
                      </S.DropdownItem>
                    );
                  })
                )}
              </S.Dropdown>
            )}
          </>
        )}
        <SlotSurface surface={WORKSPACE_SLOT_SURFACES.topBarLeft} />
      </S.Left>

      <S.Right>
        {vm.shortcuts.map((shortcut) => (
          <S.IconButton
            key={shortcut.key}
            onClick={() => vm.handleShortcutClick(shortcut.key)}
            title={shortcut.label}
            $active={shortcut.count > 0}
          >
            {shortcut.icon}
            {shortcut.count > 0 && (
              <S.Badge>{shortcut.count > 99 ? '99+' : shortcut.count}</S.Badge>
            )}
          </S.IconButton>
        ))}
        <SlotSurface surface={WORKSPACE_SLOT_SURFACES.topBarRight} />
      </S.Right>
    </S.Bar>
  );
  /* eslint-enable react-hooks/refs */
};
