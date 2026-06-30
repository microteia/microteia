import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { usePush } from './usePush';
import { makeGetPushInteractionsUseCase } from '../domain/usecases/pushinteractions/GetPushInteractionsUseCase';
import { makeUpsertPushInteractionUseCase } from '../domain/usecases/pushinteractions/UpsertPushInteractionUseCase';
import type { PushInteraction } from '../domain/entities';
import { PushInteractionContext } from './usePushInteraction';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';

export const PushInteractionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { pushInteractionRepository } = useDI();
  const { user } = useAuth();
  const { pushes } = usePush();

  const [interactions, setInteractions] = useState<PushInteraction[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    get: makeGetPushInteractionsUseCase(pushInteractionRepository),
    upsert: makeUpsertPushInteractionUseCase(pushInteractionRepository),
  }), [pushInteractionRepository]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const list = await uc.get.execute(user.id);
    setInteractions(list);
  }, [user, uc]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async subscription is architecturally required
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.PUSH_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && user) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, user]);

  const getInteraction = useCallback(
    (pushId: string) => interactions.find((i) => i.pushId === pushId),
    [interactions],
  );

  const markAsRead = useCallback(async (pushId: string) => {
    if (!user) return;
    const existing = interactions.find((i) => i.pushId === pushId);
    if (existing?.isRead) return;

    const updated = await uc.upsert.execute(user.id, pushId, {
      isRead: true,
      readAt: new Date(),
    });
    setInteractions((prev) => {
      const without = prev.filter((i) => i.pushId !== pushId);
      return [...without, updated];
    });
  }, [user, interactions, uc]);

  const unreadCount = useMemo(() => {
    const readIds = new Set(interactions.filter((i) => i.isRead).map((i) => i.pushId));
    return pushes.filter((p) => !readIds.has(p.id)).length;
  }, [pushes, interactions]);

  return (
    <PushInteractionContext.Provider value={{
      interactions, loading,
      getInteraction, markAsRead,
      unreadCount,
    }}>
      {children}
    </PushInteractionContext.Provider>
  );
};
