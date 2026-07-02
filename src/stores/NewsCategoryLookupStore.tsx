import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { NewsCategoryLookupContext } from './useNewsCategoryLookup';
import type { NewsCategoryConfig } from '../domain/entities';

export const NewsCategoryLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { newsCategoryRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [categoryConfigs, setCategoryConfigs] = useState<NewsCategoryConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const categories = await newsCategoryRepository.getAll(currentTenant.id);
      setCategoryConfigs(categories);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, newsCategoryRepository]);

  useEffect(() => {
    if (!currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on tenant change is architecturally required
    void refresh();
  }, [currentTenant, refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && currentTenant) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, currentTenant]);

  const addItem = useCallback(async (name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const config = await newsCategoryRepository.create(currentTenant.id, name, name, user.id);
    setCategoryConfigs(prev => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
  }, [currentTenant, user, newsCategoryRepository]);

  const removeItem = useCallback(async (key: string) => {
    if (!currentTenant) return;
    await newsCategoryRepository.delete(currentTenant.id, key);
    setCategoryConfigs(prev => prev.filter(c => c.key !== key));
  }, [currentTenant, newsCategoryRepository]);

  return (
    <NewsCategoryLookupContext.Provider value={{
      categoryConfigs,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </NewsCategoryLookupContext.Provider>
  );
};
