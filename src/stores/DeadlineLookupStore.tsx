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

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setTypeConfigs([]);
      return;
    }
    setLoading(true);
    const unsubscribe = deadlineTypeRepository.subscribe(currentTenant.id, (types) => {
      setTypeConfigs(types);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, deadlineTypeRepository]);

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
