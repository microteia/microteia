import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { useNews } from './useNews';
import { makeUpsertNewsInteractionUseCase } from '../domain/usecases/newsinteractions/UpsertNewsInteractionUseCase';
import { makeResetNewsReadStatusUseCase } from '../domain/usecases/newsinteractions/ResetNewsReadStatusUseCase';
import { makeIncrementNewsViewUseCase } from '../domain/usecases/news/IncrementNewsViewUseCase';
import type { NewsInteraction } from '../domain/entities';
import { NewsInteractionContext } from './useNewsInteraction';

export const NewsInteractionStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { newsInteractionRepository, newsRepository } = useDI();
  const { user } = useAuth();
  const { news } = useNews();

  const [interactions, setInteractions] = useState<NewsInteraction[]>([]);
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    upsert:      makeUpsertNewsInteractionUseCase(newsInteractionRepository),
    reset:       makeResetNewsReadStatusUseCase(newsInteractionRepository),
    incrView:    makeIncrementNewsViewUseCase(newsRepository),
  }), [newsInteractionRepository, newsRepository]);

  // Subscription em tempo real — garante que a leitura de uma notícia seja
  // refletida imediatamente para os demais usuários (ex: ao comentar, editar
  // ou excluir um comentário, que reseta o status de leitura de todos).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- clearing interactions synchronously when user logs out is architecturally required
    if (!user) { setInteractions([]); return; }
    setLoading(true);
    const unsub = newsInteractionRepository.subscribeToInteractionsForUser(user.id, (fresh) => {
      setInteractions(fresh);
      setLoading(false);
    });
    return () => unsub();
  }, [user, newsInteractionRepository]);

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

  const markAsUnread = useCallback(async (newsId: string) => {
    if (!user) return;
    const updated = await uc.upsert.execute(user.id, newsId, { isRead: false });
    setInteractions((prev) => {
      const without = prev.filter((i) => i.newsId !== newsId);
      return [...without, updated];
    });
  }, [user, uc]);

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
    const interactionByNewsId = new Map(interactions.map((i) => [i.newsId, i]));
    return news.filter((n) => {
      const interaction = interactionByNewsId.get(n.id);
      // Notícia com interação registrada: o status explícito de leitura manda,
      // mesmo para o autor (permite "marcar como não lida" na própria notícia).
      if (interaction) return !interaction.isRead;
      // Sem interação: notícia própria nunca conta como não lida por padrão
      // (o autor já sabe do que escreveu ao criá-la).
      return n.createdBy !== user?.id;
    }).length;
  }, [news, interactions, user]);

  return (
    <NewsInteractionContext.Provider value={{
      interactions, loading,
      getInteraction, markAsRead, markAsUnread, toggleSavedForLater, resetReadStatus,
      unreadCount,
    }}>
      {children}
    </NewsInteractionContext.Provider>
  );
};
