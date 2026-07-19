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

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setCategoryConfigs([]);
      return;
    }
    setLoading(true);
    const unsubscribe = newsCategoryRepository.subscribe(currentTenant.id, (categories) => {
      setCategoryConfigs(categories);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, newsCategoryRepository]);

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
