import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { useDI } from '../infrastructure/di/useDI';
import { useAuth } from './useAuth';
import { makeGetNewsTagsUseCase } from '../domain/usecases/newstags/GetNewsTagsUseCase';
import { makeCreateNewsTagUseCase } from '../domain/usecases/newstags/CreateNewsTagUseCase';
import { makeUpdateNewsTagUseCase } from '../domain/usecases/newstags/UpdateNewsTagUseCase';
import { makeDeleteNewsTagUseCase } from '../domain/usecases/newstags/DeleteNewsTagUseCase';
import { makeGetNewsTagLinksUseCase } from '../domain/usecases/newstags/GetNewsTagLinksUseCase';
import { makeSetNewsTagLinksUseCase } from '../domain/usecases/newstags/SetNewsTagLinksUseCase';
import type { NewsTag, DeletionActor } from '../domain/entities';
import { NewsTagContext } from './useNewsTag';
import { storeEvents, StoreEvents } from '../infrastructure/events/StoreEventEmitter';

export const NewsTagStoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { newsTagRepository, newsTagLinkRepository } = useDI();
  const { user, effectiveName } = useAuth();

  const [tags, setTags] = useState<NewsTag[]>([]);
  const [links, setLinks] = useState<Map<string, string[]>>(new Map());
  const [loading, setLoading] = useState(false);

  const uc = useMemo(() => ({
    getTags:    makeGetNewsTagsUseCase(newsTagRepository),
    createTag:  makeCreateNewsTagUseCase(newsTagRepository),
    updateTag:  makeUpdateNewsTagUseCase(newsTagRepository),
    deleteTag:  makeDeleteNewsTagUseCase(newsTagRepository),
    getLinks:   makeGetNewsTagLinksUseCase(newsTagLinkRepository),
    setLinks:   makeSetNewsTagLinksUseCase(newsTagLinkRepository),
  }), [newsTagRepository, newsTagLinkRepository]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const [tagList, linkList] = await Promise.all([
      uc.getTags.execute(user.id),
      uc.getLinks.execute(user.id),
    ]);
    setTags(tagList);
    const map = new Map<string, string[]>();
    linkList.forEach((l) => map.set(l.newsId, l.tagIds));
    setLinks(map);
  }, [user, uc]);

  useEffect(() => {
    if (!user) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async subscription is architecturally required
    setLoading(true);
    refresh().finally(() => setLoading(false));
  }, [user, refresh]);

  useEffect(() => {
    const unsub = storeEvents.on(StoreEvents.NEWS_TAG_UPDATED, () => void refresh());
    return () => unsub();
  }, [refresh]);

  useEffect(() => {
    const handle = () => { if (!document.hidden && user) void refresh(); };
    document.addEventListener('visibilitychange', handle);
    return () => document.removeEventListener('visibilitychange', handle);
  }, [refresh, user]);

  const getTagsForNews = useCallback(
    (newsId: string): NewsTag[] => {
      const ids = links.get(newsId) ?? [];
      return tags.filter((t) => ids.includes(t.id));
    },
    [tags, links],
  );

  const setTagsForNews = useCallback(async (newsId: string, tagIds: string[]) => {
    if (!user) return;
    await uc.setLinks.execute(user.id, newsId, tagIds);
    setLinks((prev) => {
      const next = new Map(prev);
      if (tagIds.length === 0) next.delete(newsId);
      else next.set(newsId, tagIds);
      return next;
    });
    storeEvents.emit(StoreEvents.NEWS_TAG_UPDATED);
  }, [user, uc]);

  const createTag = useCallback(async (name: string, color: string) => {
    if (!user) throw new Error('Not authenticated');
    const tag = await uc.createTag.execute(user.id, { name, color });
    storeEvents.emit(StoreEvents.NEWS_TAG_UPDATED);
    return tag;
  }, [user, uc]);

  const updateTag = useCallback(async (id: string, data: { name?: string; color?: string }) => {
    await uc.updateTag.execute(id, data);
    setTags((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    storeEvents.emit(StoreEvents.NEWS_TAG_UPDATED);
  }, [uc]);

  const deleteTag = useCallback(async (id: string) => {
    const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: user?.photoURL ?? '' };
    await uc.deleteTag.execute(id, actor);
    setTags((prev) => prev.filter((t) => t.id !== id));
    setLinks((prev) => {
      const next = new Map(prev);
      next.forEach((tagIds, newsId) => {
        const filtered = tagIds.filter((tid) => tid !== id);
        if (filtered.length === 0) next.delete(newsId);
        else next.set(newsId, filtered);
      });
      return next;
    });
    storeEvents.emit(StoreEvents.NEWS_TAG_UPDATED);
  }, [uc, user, effectiveName]);

  return (
    <NewsTagContext.Provider value={{
      tags, links, loading,
      getTagsForNews, setTagsForNews,
      createTag, updateTag, deleteTag,
    }}>
      {children}
    </NewsTagContext.Provider>
  );
};
