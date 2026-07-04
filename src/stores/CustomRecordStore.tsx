import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CustomRecordContext } from './useCustomRecords';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeGetCustomRecordsUseCase } from '../domain/usecases/customrecords/GetCustomRecordsUseCase';
import { makeCreateCustomRecordUseCase } from '../domain/usecases/customrecords/CreateCustomRecordUseCase';
import { makeUpdateCustomRecordUseCase } from '../domain/usecases/customrecords/UpdateCustomRecordUseCase';
import { makeDeleteCustomRecordUseCase } from '../domain/usecases/customrecords/DeleteCustomRecordUseCase';
import type { CustomRecord, DeletionActor } from '../domain/entities';

export const CustomRecordStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { dynamicScreens } = useScreenDefinitions();
  const { customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository } = useDI();

  const [recordsByScreen, setRecordsByScreen] = useState<Record<string, CustomRecord[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetCustomRecordsUseCase(customRecordRepository),
    create: makeCreateCustomRecordUseCase(customRecordRepository),
    update: makeUpdateCustomRecordUseCase(customRecordRepository),
    delete: makeDeleteCustomRecordUseCase(customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository),
  }), [customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository]);

  const screenKeys = useMemo(() => dynamicScreens.map((def) => def.id), [dynamicScreens]);

  const refresh = useCallback(async () => {
    if (!currentTenant) return;
    setIsLoading(true);
    try {
      const lists = await Promise.all(screenKeys.map((key) => uc.get.execute(currentTenant.id, key)));
      const next: Record<string, CustomRecord[]> = {};
      screenKeys.forEach((key, idx) => { next[key] = lists[idx]; });
      setRecordsByScreen(next);
    } finally {
      setIsLoading(false);
    }
  }, [currentTenant, screenKeys, uc.get]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- triggering async refresh on mount/tenant/screen change is architecturally required
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.CUSTOM_RECORDS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handleVisibility = () => { if (!document.hidden) void refresh(); };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [refresh]);

  const allRecords = useMemo(
    () => Object.values(recordsByScreen).flat(),
    [recordsByScreen],
  );

  const createRecord = useCallback(async (data: Omit<CustomRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setRecordsByScreen((prev) => ({
      ...prev,
      [item.screenKey]: [item, ...(prev[item.screenKey] ?? [])],
    }));
    storeEvents.emit(StoreEvents.CUSTOM_RECORDS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateRecord = useCallback(async (recordId: string, screenKey: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, recordId, data);
    setRecordsByScreen((prev) => ({
      ...prev,
      [screenKey]: (prev[screenKey] ?? []).map((r) => (r.id === recordId ? { ...r, ...data } : r)),
    }));
    storeEvents.emit(StoreEvents.CUSTOM_RECORDS_UPDATED);
  }, [currentTenant, uc.update]);

  const deleteRecord = useCallback(async (recordId: string, screenKey: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, recordId, actor);
    setRecordsByScreen((prev) => ({
      ...prev,
      [screenKey]: (prev[screenKey] ?? []).filter((r) => r.id !== recordId),
    }));
    storeEvents.emit(StoreEvents.CUSTOM_RECORDS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete]);

  return (
    <CustomRecordContext.Provider value={{
      recordsByScreen,
      allRecords,
      isLoading,
      createRecord,
      updateRecord,
      deleteRecord,
      refresh,
    }}>
      {children}
    </CustomRecordContext.Provider>
  );
};
