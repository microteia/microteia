import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '../../../../stores/useWorkspace';
import { useNewsInteraction } from '../../../../stores/useNewsInteraction';
import { useTenant } from '../../../../stores/useTenant';
import type { Tenant } from '../../../../domain/entities';

export interface TopBarViewModel {
  unreadNewsCount: number;
  handleNewsClick: () => void;
  currentTenant: Tenant | null;
  availableTenants: Tenant[];
  isDropdownOpen: boolean;
  isSwitching: boolean;
  tenantButtonRef: React.RefObject<HTMLButtonElement | null>;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
  handleTenantButtonClick: () => void;
  handleSelectTenant: (tenantId: string) => void;
}

export const useTopBarViewModel = (): TopBarViewModel => {
  const { openTab } = useWorkspace();
  const { unreadCount } = useNewsInteraction();
  const { currentTenant, availableTenants, selectTenant } = useTenant();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  const tenantButtonRef = useRef<HTMLButtonElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);

  const handleNewsClick = useCallback(() => {
    openTab('news');
  }, [openTab]);

  const handleTenantButtonClick = useCallback(() => {
    if (availableTenants.length <= 1) return;
    setIsDropdownOpen((prev) => !prev);
  }, [availableTenants.length]);

  const handleSelectTenant = useCallback(async (tenantId: string) => {
    if (tenantId === currentTenant?.id) {
      setIsDropdownOpen(false);
      return;
    }
    setIsSwitching(true);
    setIsDropdownOpen(false);
    try {
      await selectTenant(tenantId);
    } finally {
      setIsSwitching(false);
    }
  }, [currentTenant?.id, selectTenant]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        dropdownRef.current && !dropdownRef.current.contains(target) &&
        tenantButtonRef.current && !tenantButtonRef.current.contains(target)
      ) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, [isDropdownOpen]);

  useEffect(() => {
    if (!isDropdownOpen) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsDropdownOpen(false);
    };
    document.addEventListener('keydown', handleEsc);
    return () => document.removeEventListener('keydown', handleEsc);
  }, [isDropdownOpen]);

  return {
    unreadNewsCount: unreadCount,
    handleNewsClick,
    currentTenant,
    availableTenants,
    isDropdownOpen,
    isSwitching,
    tenantButtonRef,
    dropdownRef,
    handleTenantButtonClick,
    handleSelectTenant,
  };
};
