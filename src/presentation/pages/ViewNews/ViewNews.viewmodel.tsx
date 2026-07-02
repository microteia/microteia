import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNews } from '../../../stores/useNews';
import { useNewsTag } from '../../../stores/useNewsTag';
import { useNewsInteraction } from '../../../stores/useNewsInteraction';
import { useNewsCategoryLookup } from '../../../stores/useNewsCategoryLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { News, NewsTag } from '../../../domain/entities';

export interface ViewNewsViewModel {
  news: News | null;
  appliedTags: NewsTag[];
  tagManagerOpen: boolean;
  tagAdapter: TagStoreAdapter;
  isRead: boolean;
  savedForLater: boolean;
  hasLiked: boolean;
  canEdit: boolean;
  copyLinkDone: boolean;
  getCategoryLabel: (category: string) => string;
  openTagManager: () => void;
  closeTagManager: () => void;
  handleToggleLike: () => Promise<void>;
  handleToggleSaved: () => Promise<void>;
  handleEdit: () => void;
  handleCopyDeepLink: () => void;
}

export const useViewNewsViewModel = (tabKey: string): ViewNewsViewModel => {
  const newsId = tabKey.replace('view-news:', '');
  const { news, toggleLike } = useNews();
  const { tags, getTagsForNews, setTagsForNews, createTag, updateTag, deleteTag } = useNewsTag();
  const { getInteraction, markAsRead, toggleSavedForLater } = useNewsInteraction();
  const { categoryConfigs } = useNewsCategoryLookup();
  const { user, userRole } = useAuth();
  const { currentTenant } = useTenant();
  const { setTabTitle, openTab } = useWorkspace();

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);

  const item = useMemo(
    () => news.find((n) => n.id === newsId) ?? null,
    [news, newsId],
  );

  useEffect(() => {
    if (!item) return;
    setTabTitle(tabKey, item.title);
  }, [item, tabKey, setTabTitle]);

  useEffect(() => {
    if (!item || hasMarkedRead) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- setting guard flag synchronously before async side-effect is architecturally required
    setHasMarkedRead(true);
    void markAsRead(newsId);
  }, [item, newsId, markAsRead, hasMarkedRead]);

  const interaction = useMemo(() => getInteraction(newsId), [getInteraction, newsId]);
  const isRead        = interaction?.isRead ?? false;
  const savedForLater = interaction?.savedForLater ?? false;
  const hasLiked      = !!(user && item && item.likedBy.includes(user.id));

  const appliedTags = useMemo(
    () => getTagsForNews(newsId),
    [getTagsForNews, newsId],
  );

  const tagAdapter = useMemo<TagStoreAdapter>(() => ({
    tags,
    getAppliedTags: getTagsForNews,
    setTags: setTagsForNews,
    createTag,
    updateTag,
    deleteTag,
  }), [tags, getTagsForNews, setTagsForNews, createTag, updateTag, deleteTag]);

  const openTagManager  = useCallback(() => setTagManagerOpen(true), []);
  const closeTagManager = useCallback(() => setTagManagerOpen(false), []);

  const handleToggleLike = useCallback(async () => {
    if (!user || !item) return;
    await toggleLike(item.id, user.id, item.likedBy.includes(user.id));
  }, [user, item, toggleLike]);

  const handleToggleSaved = useCallback(async () => {
    await toggleSavedForLater(newsId, savedForLater);
  }, [newsId, savedForLater, toggleSavedForLater]);

  const canEdit = useMemo(() => {
    if (!item) return false;
    const isAdmin = userRole === 'SYSTEM';
    const isCreator = item.createdBy === user?.id;
    const isSystemNews = item.tenantId === null;
    const tenantRole = currentTenant
      ? (currentTenant as unknown as { memberRole?: string }).memberRole
      : null;
    const isTenantAdmin = tenantRole === 'admin';

    if (isSystemNews) return isAdmin;
    return isCreator || isTenantAdmin || isAdmin;
  }, [item, user, userRole, currentTenant]);

  const handleEdit = useCallback(() => {
    openTab(`edit-news:${newsId}`);
  }, [openTab, newsId]);

  const handleCopyDeepLink = useCallback(() => {
    void navigator.clipboard.writeText(generateDeepLink(`view-news:${newsId}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [newsId]);

  const getCategoryLabel = useCallback(
    (category: string) => categoryConfigs.find((c) => c.key === category)?.label ?? category,
    [categoryConfigs],
  );

  return {
    news: item,
    appliedTags,
    tagManagerOpen,
    tagAdapter,
    isRead,
    savedForLater,
    hasLiked,
    canEdit,
    copyLinkDone,
    getCategoryLabel,
    openTagManager,
    closeTagManager,
    handleToggleLike,
    handleToggleSaved,
    handleEdit,
    handleCopyDeepLink,
  };
};
