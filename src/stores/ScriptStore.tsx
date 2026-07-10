import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { ScriptStoreContext } from './useScriptStore';
import { useTenant } from './useTenant';
import { useDI } from '../infrastructure/di/useDI';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';
import { makeSubscribeToScriptsUseCase } from '../domain/usecases/scripts/SubscribeToScriptsUseCase';
import { makeCreateScriptUseCase } from '../domain/usecases/scripts/CreateScriptUseCase';
import { makeUpdateScriptUseCase } from '../domain/usecases/scripts/UpdateScriptUseCase';
import { makeDeleteScriptUseCase } from '../domain/usecases/scripts/DeleteScriptUseCase';
import type { Script } from '../domain/entities/Script';

export const ScriptStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentTenant } = useTenant();
  const { scriptRepository } = useDI();

  const [scripts, setScripts] = useState<Script[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  const uc = useMemo(() => ({
    subscribe: makeSubscribeToScriptsUseCase(scriptRepository),
    create: makeCreateScriptUseCase(scriptRepository),
    update: makeUpdateScriptUseCase(scriptRepository),
    delete: makeDeleteScriptUseCase(scriptRepository),
  }), [scriptRepository]);

  useEffect(() => {
    if (!currentTenant) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing local state on tenant change is architecturally required
      setScripts([]);
      return;
    }
    setIsLoading(true);
    const unsubscribe = uc.subscribe.execute(currentTenant.id, (list) => {
      setScripts(list);
      setIsLoading(false);
    });
    return () => unsubscribe();
  }, [currentTenant, uc.subscribe]);

  const createScript = useCallback(async (data: Omit<Script, 'id' | 'tenantId' | 'createdAt' | 'updatedAt'>) => {
    if (!currentTenant) throw new Error('No tenant selected');
    const item = await uc.create.execute(currentTenant.id, data);
    setScripts((prev) =>
      prev.some((s) => s.id === item.id) ? prev.map((s) => (s.id === item.id ? item : s)) : [...prev, item],
    );
    storeEvents.emit(StoreEvents.SCRIPTS_UPDATED);
    return item;
  }, [currentTenant, uc.create]);

  const updateScript = useCallback(async (id: string, data: Partial<Omit<Script, 'id' | 'tenantId' | 'createdAt'>>) => {
    if (!currentTenant) return;
    await uc.update.execute(currentTenant.id, id, data);
    setScripts((prev) => prev.map((s) => (s.id === id ? { ...s, ...data } : s)));
    storeEvents.emit(StoreEvents.SCRIPTS_UPDATED);
  }, [currentTenant, uc.update]);

  const deleteScript = useCallback(async (id: string) => {
    if (!currentTenant) return;
    await uc.delete.execute(currentTenant.id, id);
    setScripts((prev) => prev.filter((s) => s.id !== id));
    storeEvents.emit(StoreEvents.SCRIPTS_UPDATED);
  }, [currentTenant, uc.delete]);

  return (
    <ScriptStoreContext.Provider value={{
      scripts, isLoading, createScript, updateScript, deleteScript,
    }}>
      {children}
    </ScriptStoreContext.Provider>
  );
};
