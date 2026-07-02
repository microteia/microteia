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

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setLoading(true);
    try {
      const results = await Promise.all(KINDS.map((kind) => financialLookupRepository.getAll(currentTenant.id, kind)));
      const next = {} as Record<FinancialLookupKind, FinancialLookupConfig[]>;
      KINDS.forEach((kind, idx) => { next[kind] = results[idx]; });
      setConfigs(next);
    } finally {
      setLoading(false);
    }
  }, [currentTenant, financialLookupRepository]);

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
