import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { useTenant } from './useTenant';
import { makeGetNewsUseCase } from '../domain/usecases/news/GetNewsUseCase';
import { makeCreateNewsUseCase } from '../domain/usecases/news/CreateNewsUseCase';
import { makeUpdateNewsUseCase } from '../domain/usecases/news/UpdateNewsUseCase';
import { makeDeleteNewsUseCase } from '../domain/usecases/news/DeleteNewsUseCase';
import { makeToggleNewsLikeUseCase } from '../domain/usecases/news/ToggleNewsLikeUseCase';
import type { News } from '../domain/entities';
import { NewsContext } from './useNews';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';

export const NewsStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { newsRepository, newsCommentRepository } = useDI();
  const { user, userRole } = useAuth();
  const { currentTenant } = useTenant();

  const [news, setNews] = useState<News[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState('');
  const [commentCounts, setCommentCounts] = useState<Record<string, number>>({});

  const tenantId = currentTenant?.id ?? null;

  const uc = useMemo(() => ({
    get:    makeGetNewsUseCase(newsRepository),
    create: makeCreateNewsUseCase(newsRepository),
    update: makeUpdateNewsUseCase(newsRepository),
    delete: makeDeleteNewsUseCase(newsRepository),
    like:   makeToggleNewsLikeUseCase(newsRepository),
  }), [newsRepository]);

  const refreshCommentCounts = useCallback(async (newsList: News[]) => {
    if (newsList.length === 0) { setCommentCounts({}); return; }
    const counts = await newsCommentRepository.getCommentCountMap(newsList.map((n) => n.id));
    setCommentCounts(counts);
  }, [newsCommentRepository]);

  const refresh = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError('');
    try {
      const list = await uc.get.execute(user.id, userRole ?? 'USER', tenantId);
      setNews(list);
      void refreshCommentCounts(list);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('[NewsStore] refresh failed:', msg);
      setLoadError(msg);
    } finally {
      setLoading(false);
    }
  }, [user, userRole, tenantId, uc, refreshCommentCounts]);

  // Carga inicial quando usuário ou tenant muda
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing news synchronously when user logs out is architecturally required
    if (!user) { setNews([]); setCommentCounts({}); return; }
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const list = await uc.get.execute(user.id, userRole ?? 'USER', tenantId);
        if (!cancelled) {
          setNews(list);
          void refreshCommentCounts(list);
        }
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error('[NewsStore] load failed:', msg);
        if (!cancelled) setLoadError(msg);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [user, userRole, tenantId, uc, refreshCommentCounts]);

  // Subscription em tempo real — também atualiza contadores ao detectar mudança nos docs de news
  useEffect(() => {
    if (!user) return;
    const unsub = newsRepository.subscribeToNews(tenantId, (fresh) => {
      setNews(fresh);
      void refreshCommentCounts(fresh);
    });
    return () => unsub();
  }, [user, tenantId, newsRepository, refreshCommentCounts]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && user) void refresh();
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [refresh, user]);

  const createNews = async (
    data: Omit<News, 'id' | 'userId' | 'createdBy' | 'createdAt' | 'updatedAt'>,
  ): Promise<News> => {
    if (!user) throw new Error('unauthenticated');
    const n = await uc.create.execute(user.id, { ...data, createdBy: user.id });
    storeEvents.emit(StoreEvents.NEWS_UPDATED);
    return n;
  };

  const updateNews = async (
    id: string,
    data: Partial<Omit<News, 'id' | 'userId' | 'createdAt'>>,
  ) => {
    await uc.update.execute(id, data);
    setNews((prev) => prev.map((n) => (n.id === id ? { ...n, ...data } : n)));
    storeEvents.emit(StoreEvents.NEWS_UPDATED);
  };

  const deleteNews = async (id: string) => {
    await uc.delete.execute(id);
    setNews((prev) => prev.filter((n) => n.id !== id));
    storeEvents.emit(StoreEvents.NEWS_UPDATED);
  };

  const toggleLike = async (id: string, userId: string, hasLiked: boolean) => {
    setNews((prev) =>
      prev.map((n) =>
        n.id !== id ? n : {
          ...n,
          likeCount: hasLiked ? n.likeCount - 1 : n.likeCount + 1,
          likedBy: hasLiked
            ? n.likedBy.filter((uid) => uid !== userId)
            : [...n.likedBy, userId],
        },
      ),
    );
    await uc.like.execute(id, userId, hasLiked);
  };

  return (
    <NewsContext.Provider value={{
      news, loading, loadError, commentCounts, refresh,
      createNews, updateNews, deleteNews, toggleLike,
    }}>
      {children}
    </NewsContext.Provider>
  );
};
