import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RecordContext } from './useRecords';
import { useTenant } from './useTenant';
import { useAuth } from './useAuth';
import { useScreenDefinitions } from './useScreenDefinitions';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToRecordsUseCase } from '../domain/usecases/records/SubscribeToRecordsUseCase';
import { makeCreateRecordUseCase } from '../domain/usecases/records/CreateRecordUseCase';
import { makeUpdateRecordUseCase } from '../domain/usecases/records/UpdateRecordUseCase';
import { makeDeleteRecordUseCase } from '../domain/usecases/records/DeleteRecordUseCase';
import type { DeletionActor, EntityRecord, EntityRecordValues } from '../domain/entities';

/**
 * Registros das telas SEM store próprio — as do Form Design e as de extensão. As entidades fixas
 * seguem nos seus stores tipados; o contrato de leitura e gravação, porém, já é o mesmo.
 */
export const RecordStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { user, effectiveName } = useAuth();
  const { dynamicScreens } = useScreenDefinitions();
  const { recordRepository, recordNoteRepository, recordDocumentRepository } = useDI();

  const [recordsByCollection, setRecordsByCollection] = useState<Record<string, EntityRecord[]>>({});
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToRecordsUseCase(recordRepository),
    create: makeCreateRecordUseCase(recordRepository),
    update: makeUpdateRecordUseCase(recordRepository),
    delete: makeDeleteRecordUseCase(recordRepository, recordNoteRepository, recordDocumentRepository),
  }), [recordRepository, recordNoteRepository, recordDocumentRepository]);

  const collections = useMemo(() => dynamicScreens.map((def) => def.id), [dynamicScreens]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setRecordsByCollection({});
      return;
    }
    setIsLoading(true);
    let pending = collections.length;
    if (pending === 0) setIsLoading(false);
    const unsubscribers = collections.map((collection) =>
      uc.subscribe.execute(currentTenant.id, collection, (records) => {
        setRecordsByCollection((prev) => ({ ...prev, [collection]: records }));
        pending -= 1;
        if (pending <= 0) setIsLoading(false);
      }),
    );
    return () => unsubscribers.forEach((unsub) => unsub());
  }, [currentTenant, collections, uc.subscribe]);

  const allRecords = useMemo(
    () => Object.values(recordsByCollection).flat(),
    [recordsByCollection],
  );

  const createRecord = useCallback(async (collection: string, data: EntityRecordValues) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, collection, data);
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateRecord = useCallback(async (
    collection: string,
    recordId: string,
    data: EntityRecordValues,
  ) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, collection, recordId, data);
    setRecordsByCollection((prev) => ({
      ...prev,
      [collection]: (prev[collection] ?? []).map((r) => (r.id === recordId ? { ...r, ...data } : r)),
    }));
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, uc.update]);

  const deleteRecord = useCallback(async (collection: string, recordId: string) => {
    if (!currentTenant) return;
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.delete.execute(currentTenant.id, collection, recordId, actor);
    setRecordsByCollection((prev) => ({
      ...prev,
      [collection]: (prev[collection] ?? []).filter((r) => r.id !== recordId),
    }));
    storeEvents.emit(StoreEvents.RECORDS_UPDATED);
  }, [currentTenant, user, effectiveName, uc.delete]);

  return (
    <RecordContext.Provider value={{
      recordsByCollection,
      allRecords,
      isLoading,
      createRecord,
      updateRecord,
      deleteRecord,
    }}>
      {children}
    </RecordContext.Provider>
  );
};
