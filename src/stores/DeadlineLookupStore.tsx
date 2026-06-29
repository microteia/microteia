import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { DeadlineLookupContext } from './useDeadlineLookup';
import type { DeadlineTypeConfig } from '../domain/entities';

export const DeadlineLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { deadlineTypeRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [typeConfigs, setTypeConfigs] = useState<DeadlineTypeConfig[]>([]);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const types = await deadlineTypeRepository.getAll(currentTenant.id);
      setTypeConfigs(types);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, deadlineTypeRepository]);

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

  const addType = useCallback(async (name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const config = await deadlineTypeRepository.create(currentTenant.id, name, name, user.id);
    setTypeConfigs((prev) => [...prev, config].sort((a, b) => a.label.localeCompare(b.label)));
  }, [currentTenant, user, deadlineTypeRepository]);

  const removeType = useCallback(async (key: string) => {
    if (!currentTenant) return;
    await deadlineTypeRepository.delete(currentTenant.id, key);
    setTypeConfigs((prev) => prev.filter((t) => t.key !== key));
  }, [currentTenant, deadlineTypeRepository]);

  return (
    <DeadlineLookupContext.Provider value={{ typeConfigs, loading, addType, removeType }}>
      {children}
    </DeadlineLookupContext.Provider>
  );
};
