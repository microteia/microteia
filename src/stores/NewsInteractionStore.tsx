import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { useNews } from './useNews';
import { makeGetNewsInteractionsUseCase } from '../domain/usecases/newsinteractions/GetNewsInteractionsUseCase';
import { makeUpsertNewsInteractionUseCase } from '../domain/usecases/newsinteractions/UpsertNewsInteractionUseCase';
import { makeResetNewsReadStatusUseCase } from '../domain/usecases/newsinteractions/ResetNewsReadStatusUseCase';
import { makeIncrementNewsViewUseCase } from '../domain/usecases/news/IncrementNewsViewUseCase';
import type { NewsInteraction } from '../domain/entities';
import { NewsInteractionContext } from './useNewsInteraction';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';

export const NewsInteractionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { newsInteractionRepository, newsRepository } = useDI();
  const { user } = useAuth();
  const { news } = useNews();

  const [interactions, setInteractions] = useState<NewsInteraction[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    get:         makeGetNewsInteractionsUseCase(newsInteractionRepository),
    upsert:      makeUpsertNewsInteractionUseCase(newsInteractionRepository),
    reset:       makeResetNewsReadStatusUseCase(newsInteractionRepository),
    incrView:    makeIncrementNewsViewUseCase(newsRepository),
  }), [newsInteractionRepository, newsRepository]);

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
    const unsub = storeEvents.on(StoreEvents.NEWS_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && user) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, user]);

  const getInteraction = useCallback(
    (newsId: string) => interactions.find((i) => i.newsId === newsId),
    [interactions],
  );

  const markAsRead = useCallback(async (newsId: string) => {
    if (!user) return;
    const existing = interactions.find((i) => i.newsId === newsId);
    if (existing?.isRead) return;

    const updated = await uc.upsert.execute(user.id, newsId, {
      isRead: true,
      readAt: new Date(),
    });
    setInteractions((prev) => {
      const without = prev.filter((i) => i.newsId !== newsId);
      return [...without, updated];
    });
    await uc.incrView.execute(newsId);
  }, [user, interactions, uc]);

  const toggleSavedForLater = useCallback(async (newsId: string, currentlySaved: boolean) => {
    if (!user) return;
    const updated = await uc.upsert.execute(user.id, newsId, {
      savedForLater: !currentlySaved,
      savedAt: !currentlySaved ? new Date() : undefined,
    });
    setInteractions((prev) => {
      const without = prev.filter((i) => i.newsId !== newsId);
      return [...without, updated];
    });
  }, [user, uc]);

  const resetReadStatus = useCallback(async (newsId: string) => {
    if (!user) return;
    await uc.reset.execute(newsId, user.id);
  }, [user, uc]);

  const unreadCount = useMemo(() => {
    const readIds = new Set(interactions.filter((i) => i.isRead).map((i) => i.newsId));
    return news.filter((n) => !readIds.has(n.id) && n.createdBy !== user?.id).length;
  }, [news, interactions, user]);

  return (
    <NewsInteractionContext.Provider value={{
      interactions, loading,
      getInteraction, markAsRead, toggleSavedForLater, resetReadStatus,
      unreadCount,
    }}>
      {children}
    </NewsInteractionContext.Provider>
  );
};
