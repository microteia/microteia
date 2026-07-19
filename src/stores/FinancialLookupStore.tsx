import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { FinancialLookupContext } from './useFinancialLookup';
import type { FinancialLookupConfig, FinancialLookupKind } from '../domain/entities';

const KINDS: FinancialLookupKind[] = ['categories', 'statuses'];

const EMPTY_STATE: Record<FinancialLookupKind, FinancialLookupConfig[]> = {
  categories: [],
  statuses: [],
};

export const FinancialLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { financialLookupRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [configs, setConfigs] = useState<Record<FinancialLookupKind, FinancialLookupConfig[]>>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setConfigs(EMPTY_STATE);
      return;
    }
    setLoading(true);
    const unsubscribes = KINDS.map((kind) => financialLookupRepository.subscribe(currentTenant.id, kind, (items) => {
      setConfigs((prev) => ({ ...prev, [kind]: items }));
      setLoading(false);
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentTenant, financialLookupRepository]);

  const addItem = useCallback(async (kind: FinancialLookupKind, name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const config = await financialLookupRepository.create(currentTenant.id, kind, name, user.id);
    setConfigs((prev) => ({
      ...prev,
      [kind]: [...prev[kind], config].sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [currentTenant, user, financialLookupRepository]);

  const removeItem = useCallback(async (kind: FinancialLookupKind, key: string) => {
    if (!currentTenant) return;
    await financialLookupRepository.delete(currentTenant.id, kind, key);
    setConfigs((prev) => ({ ...prev, [kind]: prev[kind].filter((i) => i.key !== key) }));
  }, [currentTenant, financialLookupRepository]);

  return (
    <FinancialLookupContext.Provider value={{
      categoryConfigs: configs.categories,
      statusConfigs: configs.statuses,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </FinancialLookupContext.Provider>
  );
};
