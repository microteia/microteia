import { useState, useCallback } from 'react';
import { useAuth } from '../../../stores/useAuth';

export type AccessManagementTab = 'users' | 'offices';

export interface AccessManagementViewModel {
  isUnauthorized: boolean;
  activeTab: AccessManagementTab;
  setActiveTab: (tab: AccessManagementTab) => void;
}

export const useAccessManagementViewModel = (): AccessManagementViewModel => {
  const { userRole } = useAuth();
  const isUnauthorized = userRole !== 'SYSTEM';
  const [activeTab, setActiveTab] = useState<AccessManagementTab>('users');

  const handleSetActiveTab = useCallback((tab: AccessManagementTab) => {
    setActiveTab(tab);
  }, []);

  return {
    isUnauthorized,
    activeTab,
    setActiveTab: handleSetActiveTab,
  };
};
