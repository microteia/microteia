import React, { useState, useCallback, useEffect } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { DocumentTypeLookupContext } from './useDocumentTypeLookup';
import type { DocumentTypeConfig } from '../domain/entities';

export const DocumentTypeLookupStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { documentTypeRepository } = useDI();
  const { currentTenant } = useTenant();
  const { user } = useAuth();

  const [typeConfigs, setTypeConfigs] = useState<DocumentTypeConfig[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setTypeConfigs([]);
      return;
    }
    setLoading(true);
    const unsubscribe = documentTypeRepository.subscribe(currentTenant.id, (types) => {
      setTypeConfigs(types);
      setLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, documentTypeRepository]);

  const addItem = useCallback(async (name: string) => {
    if (!currentTenant || !user) throw new Error('Not authenticated');
    await documentTypeRepository.create(currentTenant.id, name, name, user.id);
  }, [currentTenant, user, documentTypeRepository]);

  const removeItem = useCallback(async (key: string) => {
    if (!currentTenant) return;
    await documentTypeRepository.delete(currentTenant.id, key);
  }, [currentTenant, documentTypeRepository]);

  return (
    <DocumentTypeLookupContext.Provider value={{
      typeConfigs,
      loading,
      addItem,
      removeItem,
    }}>
      {children}
    </DocumentTypeLookupContext.Provider>
  );
};
