import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { ContractLookupContext } from './useContractLookup';
import type { ContractLookupConfig, ContractLookupKind } from '../domain/entities';

const KINDS: ContractLookupKind[] = [
  'types', 'categories', 'statuses', 'objects',
  'adjustmentIndexes', 'adjustmentPeriodicities',
  'currencies', 'paymentMethods', 'banks', 'costCenters',
];

const EMPTY_STATE: Record<ContractLookupKind, ContractLookupConfig[]> = {
  types: [],
  categories: [],
  statuses: [],
  objects: [],
  adjustmentIndexes: [],
  adjustmentPeriodicities: [],
  currencies: [],
  paymentMethods: [],
  banks: [],
  costCenters: [],
};

export const ContractLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { contractLookupRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [configs, setConfigs] = useState<Record<ContractLookupKind, ContractLookupConfig[]>>(EMPTY_STATE);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setConfigs(EMPTY_STATE);
      return;
    }
    setLoading(true);
    const unsubscribes = KINDS.map((kind) => contractLookupRepository.subscribe(currentTenant.id, kind, (items) => {
      setConfigs((prev) => ({ ...prev, [kind]: items }));
      setLoading(false);
    }));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [currentTenant, contractLookupRepository]);

  const addItem = useCallback(async (kind: ContractLookupKind, name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    const config = await contractLookupRepository.create(currentTenant.id, kind, name, user.id);
    setConfigs((prev) => ({
      ...prev,
      [kind]: [...prev[kind], config].sort((a, b) => a.label.localeCompare(b.label)),
    }));
  }, [currentTenant, user, contractLookupRepository]);

  const removeItem = useCallback(async (kind: ContractLookupKind, key: string) => {
    if (!currentTenant) return;
    await contractLookupRepository.delete(currentTenant.id, kind, key);
    setConfigs((prev) => ({ ...prev, [kind]: prev[kind].filter((i) => i.key !== key) }));
  }, [currentTenant, contractLookupRepository]);

  return (
    <ContractLookupContext.Provider value={{
      typeConfigs: configs.types,
      categoryConfigs: configs.categories,
      statusConfigs: configs.statuses,
      objectConfigs: configs.objects,
      adjustmentIndexConfigs: configs.adjustmentIndexes,
      adjustmentPeriodicityConfigs: configs.adjustmentPeriodicities,
      currencyConfigs: configs.currencies,
      paymentMethodConfigs: configs.paymentMethods,
      bankConfigs: configs.banks,
      costCenterConfigs: configs.costCenters,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </ContractLookupContext.Provider>
  );
};
