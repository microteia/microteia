import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { CustomRecordContext } from './useCustomRecords';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToCustomRecordsUseCase } from '../domain/usecases/customrecords/SubscribeToCustomRecordsUseCase';
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
    subscribe: makeSubscribeToCustomRecordsUseCase(customRecordRepository),
    create: makeCreateCustomRecordUseCase(customRecordRepository),
    update: makeUpdateCustomRecordUseCase(customRecordRepository),
    delete: makeDeleteCustomRecordUseCase(customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository),
  }), [customRecordRepository, customRecordNoteRepository, customRecordDocumentRepository]);

  const screenKeys = useMemo(() => dynamicScreens.map((def) => def.id), [dynamicScreens]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setRecordsByScreen({});
      return;
    }
    setIsLoading(true);
    let pendingScreens = screenKeys.length;
    if (pendingScreens === 0) setIsLoading(false);
    const unsubscribers = screenKeys.map((key) =>
      uc.subscribe.execute(currentTenant.id, key, (records) => {
        setRecordsByScreen((prev) => ({ ...prev, [key]: records }));
        pendingScreens -= 1;
        if (pendingScreens <= 0) setIsLoading(false);
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [currentTenant, screenKeys, uc.subscribe]);

  const allRecords = useMemo(
    () => Object.values(recordsByScreen).flat(),
    [recordsByScreen],
  );

  const createRecord = useCallback(async (data: Omit<CustomRecord, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    storeEvents.emit(StoreEvents.CUSTOM_RECORDS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateRecord = useCallback(async (recordId: string, screenKey: string, data: Partial<Omit<CustomRecord, 'id' | 'tenantId' | 'screenKey' | 'createdAt' | 'createdBy'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, recordId, screenKey, data);
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
    }}>
      {children}
    </CustomRecordContext.Provider>
  );
};
