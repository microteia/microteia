import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { makeGetSavedFiltersUseCase } from '../domain/usecases/savedfilters/GetSavedFiltersUseCase';
import { makeCreateSavedFilterUseCase } from '../domain/usecases/savedfilters/CreateSavedFilterUseCase';
import { makeUpdateSavedFilterUseCase } from '../domain/usecases/savedfilters/UpdateSavedFilterUseCase';
import { makeDeleteSavedFilterUseCase } from '../domain/usecases/savedfilters/DeleteSavedFilterUseCase';
import type { SavedFilter, SavedFilterToken } from '../domain/entities';
import { SavedFilterContext } from './useSavedFilter';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';

export const SavedFilterStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { savedFilterRepository } = useDI();
  const { user } = useAuth();

  const [filters, setFilters] = useState<SavedFilter[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    get:    makeGetSavedFiltersUseCase(savedFilterRepository),
    create: makeCreateSavedFilterUseCase(savedFilterRepository),
    update: makeUpdateSavedFilterUseCase(savedFilterRepository),
    delete: makeDeleteSavedFilterUseCase(savedFilterRepository),
  }), [savedFilterRepository]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const list = await uc.get.execute(user.id);
    setFilters(list);
  }, [user, uc]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async subscription is architecturally required
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.SAVED_FILTER_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && user) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, user]);

  const saveFilter = useCallback(async (
    screenKey: string,
    name: string,
    tokens: SavedFilterToken[],
    existingId?: string | null,
  ): Promise<SavedFilter> => {
    if (!user) throw new Error('Not authenticated');

    if (existingId) {
      await uc.update.execute(existingId, { name, tokens });
      const updated: SavedFilter = {
        id: existingId,
        userId: user.id,
        screenKey,
        name,
        tokens,
        createdAt: filters.find((f) => f.id === existingId)?.createdAt ?? new Date(),
      };
      setFilters((prev) => prev.map((f) => (f.id === existingId ? updated : f)));
      storeEvents.emit(StoreEvents.SAVED_FILTER_UPDATED);
      return updated;
    }

    const created = await uc.create.execute(user.id, screenKey, name, tokens);
    setFilters((prev) => [...prev, created]);
    storeEvents.emit(StoreEvents.SAVED_FILTER_UPDATED);
    return created;
  }, [user, uc, filters]);

  const removeFilter = useCallback(async (id: string) => {
    await uc.delete.execute(id);
    setFilters((prev) => prev.filter((f) => f.id !== id));
    storeEvents.emit(StoreEvents.SAVED_FILTER_UPDATED);
  }, [uc]);

  return (
    <SavedFilterContext.Provider value={{ filters, loading, saveFilter, removeFilter }}>
      {children}
    </SavedFilterContext.Provider>
  );
};
