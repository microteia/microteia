import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { makeGetPushesUseCase } from '../domain/usecases/push/GetPushesUseCase';
import { makeUpdatePushStatusUseCase } from '../domain/usecases/push/UpdatePushStatusUseCase';
import { makeDeletePushUseCase } from '../domain/usecases/push/DeletePushUseCase';
import type { Push, PushStatus } from '../domain/entities';
import { PushContext } from './usePush';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';

export const PushStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pushRepository } = useDI();
  const { user } = useAuth();
  const { currentTenant } = useTenant();

  const [pushes, setPushes] = useState<Push[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');

  const tenantId = currentTenant?.id ?? null;

  const uc = useMemo(() => ({
    get: makeGetPushesUseCase(pushRepository),
    updateStatus: makeUpdatePushStatusUseCase(pushRepository),
    delete: makeDeletePushUseCase(pushRepository),
  }), [pushRepository]);

  const refresh = useCallback(async () => {
    if (!user || !tenantId) return;
    setLoading(true);
    setLoadError('');
    try {
      const list = await uc.get.execute(tenantId);
      setPushes(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[PushStore] refresh failed:', msg);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, tenantId, uc]);

  // Carga inicial quando usuário ou tenant muda
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing pushes synchronously when user logs out is architecturally required
    if (!user || !tenantId) { setPushes([]); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const list = await uc.get.execute(tenantId);
        if (!cancelled) setPushes(list);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[PushStore] load failed:', msg);
        if (!cancelled) setLoadError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, tenantId, uc]);

  // Subscription em tempo real
  useEffect(() => {
    if (!user || !tenantId) return;
    const unsub = pushRepository.subscribeToPushes(tenantId, (fresh) => {
      setPushes(fresh);
    });
    return () => unsub();
  }, [user, tenantId, pushRepository]);

  // visibilitychange listener
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user && tenantId) void refresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh, user, tenantId]);

  const updateStatus = async (pushId: string, status: PushStatus) => {
    if (!tenantId) throw new Error('No tenant selected');
    await uc.updateStatus.execute(tenantId, pushId, status);
    setPushes((prev) => prev.map((p) => (p.id === pushId ? { ...p, status } : p)));
    storeEvents.emit(StoreEvents.PUSH_UPDATED);
  };

  const deletePush = async (pushId: string) => {
    if (!tenantId) return;
    await uc.delete.execute(tenantId, pushId);
    setPushes((prev) => prev.filter((p) => p.id !== pushId));
    storeEvents.emit(StoreEvents.PUSH_UPDATED);
  };

  return (
    <PushContext.Provider value={{
      pushes, loading, loadError, refresh,
      updateStatus, deletePush,
    }}>
      {children}
    </PushContext.Provider>
  );
};
