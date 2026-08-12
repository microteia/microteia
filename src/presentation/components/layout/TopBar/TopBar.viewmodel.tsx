import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useTenant } from '../../../../stores/useTenant';
import { useNavContributions } from '../../../shared/useUiContributions';
import { navMetadataOf } from '../../../shared/resolveUiContributions';
import { useNavBadgeCount } from '../../../shared/useNavBadgeCount';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { Tenant } from '../../../../domain/entities';

/**
 * Um atalho com CONTADOR no alto da tela. Sai das mesmas contribuições de menu que alimentam a barra
 * lateral: o item que declara um selo aparece aqui também, e some daqui quando a extensão sai — o
 * ícone da caixa de intimações era escrito à mão neste componente, e o kernel tinha de saber que
 * existiam pushes para desenhá-lo.
 */
export interface TopBarShortcut {
  key: string;
  label: string;
  icon: React.ReactNode;
  count: number;
}

export interface TopBarViewModel {
  shortcuts: TopBarShortcut[];
  handleShortcutClick: (key: string) => void;
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  filteredTenants: Tenant[];
  searchQuery: string;
  isDropdownOpen: boolean;
  isSwitching: boolean;
  tenantButtonRef: React.RefObject<HTMLButtonElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  searchInputRef: React.RefObject<HTMLInputElement | null>;
  handleTenantButtonClick: () => void;
  handleSelectTenant: (tenantId: string) => void;
  handleSearchChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

export const useTopBarViewModel = (): TopBarViewModel => {
  const { openTab } = useWorkspace();
  const { currentTenant, availableTenants, selectTenant } = useTenant();
  const navContributions = useNavContributions();
  const badgeCount = useNavBadgeCount();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const tenantButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const filteredTenants = useMemo(() => {
    if (!searchQuery.trim()) return availableTenants;
    const query = searchQuery.toLowerCase().trim();
    return availableTenants.filter((tenant) =>
      tenant.name.toLowerCase().includes(query)
    );
  }, [availableTenants, searchQuery]);

  const handleShortcutClick = useCallback((key: string) => {
    openTab(key);
  }, [openTab]);

  const shortcuts = useMemo<TopBarShortcut[]>(
    () => navContributions
      .map(navMetadataOf)
      .filter((metadata) => !!metadata.badge)
      .map((metadata) => ({
        key: metadata.key,
        label: metadata.label,
        icon: getScreenIcon(metadata.icon, 18),
        count: badgeCount(metadata.badge),
      })),
    [navContributions, badgeCount],
  );

  const handleTenantButtonClick = useCallback(() => {
    if (availableTenants.length <= 1) return;
    if (isDropdownOpen) {
      setIsDropdownOpen(false);
      setSearchQuery('');
    } else {
      setIsDropdownOpen(true);
    }
  }, [availableTenants.length, isDropdownOpen]);

  const handleSelectTenant = useCallback(async (tenantId: string) => {
    if (tenantId === currentTenant?.id) {
      setIsDropdownOpen(false);
      setSearchQuery('');
      return;
    }
    setIsSwitching(true);
    setIsDropdownOpen(false);
    setSearchQuery('');
    try {
      await selectTenant(tenantId);
    } finally {
      setIsSwitching(false);
    }
  }, [currentTenant?.id, selectTenant]);

  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
  }, []);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        tenantButtonRef.current && !tenantButtonRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsDropdownOpen(false);
        setSearchQuery('');
      }
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (isDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isDropdownOpen]);

  return {
    shortcuts,
    handleShortcutClick,
    currentTenant,
    availableTenants,
    filteredTenants,
    searchQuery,
    isDropdownOpen,
    isSwitching,
    tenantButtonRef,
    dropdownRef,
    searchInputRef,
    handleTenantButtonClick,
    handleSelectTenant,
    handleSearchChange,
  };
};
