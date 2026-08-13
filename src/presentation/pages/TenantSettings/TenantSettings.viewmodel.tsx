import { useState, useCallback } from 'react';
import { useTenant } from '../../../stores/useTenant';

export type TenantSettingsTab = 'office' | 'members' | 'ai';

export interface TenantSettingsViewModel {
  isAdmin: boolean;
  activeTab: TenantSettingsTab;
  setActiveTab: (tab: TenantSettingsTab) => void;
}

export const useTenantSettingsViewModel = (initialTab: TenantSettingsTab = 'office'): TenantSettingsViewModel => {
  const { tenantRole } = useTenant();
  const isAdmin = tenantRole === 'admin';
  const [activeTab, setActiveTab] = useState<TenantSettingsTab>(initialTab);

  const handleSetActiveTab = useCallback((tab: TenantSettingsTab) => {
    setActiveTab(tab);
  }, []);

  return {
    isAdmin,
    activeTab,
    setActiveTab: handleSetActiveTab,
  };
};
