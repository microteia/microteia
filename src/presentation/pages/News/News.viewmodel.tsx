import { useState, useMemo, useCallback } from 'react';
import { useNews } from '../../../stores/useNews';
import { useNewsTag } from '../../../stores/useNewsTag';
import { useNewsInteraction } from '../../../stores/useNewsInteraction';
import { useNewsCategoryLookup } from '../../../stores/useNewsCategoryLookup';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import type { News, NewsTag, UserRole } from '../../../domain/entities';
import type { FilterDef, FilterToken } from '../../components/ui/CompositeFilter';

export interface ConfirmState {
  open: boolean;
  title: string;
  message: string;
  onConfirm: () => Promise<void>;
}

const closedConfirm = (): ConfirmState => ({
  open: false, title: '', message: '', onConfirm: async () => {},
});

export interface NewsRow {
  news: News;
  categoryLabel: string;
  isOwner: boolean;
  isSystemNews: boolean;
  canEdit: boolean;
  canDelete: boolean;
  appliedTags: NewsTag[];
  isRead: boolean;
  savedForLater: boolean;
  hasLiked: boolean;
  commentCount: number;
}

export interface NewsViewModel {
  rows: NewsRow[];
  filterTokens: FilterToken[];
  filterDefs: FilterDef[];
  savedFiltersScreenKey: string;
  confirm: ConfirmState;
  userRole: UserRole | null;
  unreadCount: number;
  canCreate: boolean;
  setFilterTokens: (tokens: FilterToken[]) => void;
  openCreate: () => void;
  openEdit: (n: News) => void;
  askDelete: (id: string) => void;
  cancelConfirm: () => void;
  runConfirm: () => Promise<void>;
  openView: (id: string) => void;
  handleToggleLike: (n: News) => Promise<void>;
  handleToggleSaved: (n: News) => Promise<void>;
}

const ORIGIN_OPTIONS: FilterDef['options'] = [
  { value: 'SYSTEM', label: 'Sistema' },
  { value: 'TENANT', label: 'Escritório' },
];

const READ_STATUS_OPTIONS: FilterDef['options'] = [
  { value: 'UNREAD', label: 'Não lidas' },
  { value: 'READ', label: 'Lidas' },
  { value: 'SAVED', label: 'Salvos para depois' },
];

export const useNewsViewModel = (): NewsViewModel => {
  const { news, updateNews, deleteNews, toggleLike, commentCounts } = useNews();
  const { openTab } = useWorkspace();
  const { user, userRole } = useAuth();
  const { currentTenant } = useTenant();
  const { getTagsForNews } = useNewsTag();
  const { getInteraction, toggleSavedForLater, unreadCount } = useNewsInteraction();
  const { categoryConfigs } = useNewsCategoryLookup();

  const [filterTokens, setFilterTokens] = useState<FilterToken[]>([
    { key: 'readStatus', values: ['UNREAD'] },
  ]);
  const [confirm, setConfirm] = useState<ConfirmState>(closedConfirm());

  const categoryOptions = useMemo<FilterDef['options']>(
    () => categoryConfigs.map((c) => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );

  const filterDefs = useMemo<FilterDef[]>(() => [
    { key: 'search', label: 'Busca', type: 'text', placeholder: 'Pesquisar no conteúdo...' },
    { key: 'category', label: 'Categoria', type: 'select', options: categoryOptions },
    { key: 'origin', label: 'Origem', type: 'select', options: ORIGIN_OPTIONS },
    { key: 'readStatus', label: 'Status de leitura', type: 'select', options: READ_STATUS_OPTIONS },
  ], [categoryOptions]);

  const tokenMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    filterTokens.forEach((t) => { map[t.key] = t.values; });
    return map;
  }, [filterTokens]);

  const filteredNews = useMemo(() => {
    const searchQ = (tokenMap['search']?.[0] ?? '').toLowerCase();
    const categoryFilter = tokenMap['category'] ?? [];
    const originFilter = tokenMap['origin'] ?? [];
    const readFilters = tokenMap['readStatus'] ?? [];

    return news.filter((n) => {
      if (
        searchQ &&
        !n.title.toLowerCase().includes(searchQ) &&
        !n.summary.toLowerCase().includes(searchQ) &&
        !(n.content ?? '').toLowerCase().includes(searchQ)
      ) return false;
      if (categoryFilter.length > 0 && !categoryFilter.includes(n.category)) return false;
      if (originFilter.length > 0) {
        const origin = n.tenantId === null ? 'SYSTEM' : 'TENANT';
        if (!originFilter.includes(origin)) return false;
      }
      if (readFilters.length > 0) {
        const interaction = getInteraction(n.id);
        const matches = readFilters.some((rf) => {
          if (rf === 'UNREAD') return !interaction?.isRead;
          if (rf === 'READ') return !!interaction?.isRead;
          if (rf === 'SAVED') return !!interaction?.savedForLater;
          return false;
        });
        if (!matches) return false;
      }
      return true;
    });
  }, [news, tokenMap, getInteraction]);

  const rows = useMemo<NewsRow[]>(() => {
    const isAdmin = userRole === 'SYSTEM';
    const tenantRole = currentTenant
      ? (currentTenant as unknown as { memberRole?: string }).memberRole
      : null;
    const isTenantAdmin = tenantRole === 'admin';

    return filteredNews.map((n) => {
      const isCreator = n.createdBy === user?.id;
      const isSystemNews = n.tenantId === null;
      const interaction = getInteraction(n.id);

      let canEdit: boolean;
      let canDelete: boolean;

      if (isSystemNews) {
        // Notícias do sistema: somente ADMIN global pode editar/excluir
        canEdit   = isAdmin;
        canDelete = isAdmin;
      } else {
        // Notícias do escritório: criador ou admin do tenant pode editar/excluir
        canEdit   = isCreator || isTenantAdmin || isAdmin;
        canDelete = isCreator || isTenantAdmin || isAdmin;
      }

      return {
        news: n,
        categoryLabel: categoryConfigs.find((c) => c.key === n.category)?.label ?? n.category,
        isOwner: isCreator,
        isSystemNews,
        canEdit,
        canDelete,
        appliedTags: getTagsForNews(n.id),
        isRead: interaction?.isRead ?? false,
        savedForLater: interaction?.savedForLater ?? false,
        hasLiked: !!(user && n.likedBy.includes(user.id)),
        commentCount: commentCounts[n.id] ?? n.commentCount,
      };
    });
  }, [filteredNews, user, userRole, currentTenant, getTagsForNews, getInteraction, commentCounts, categoryConfigs]);

  const openCreate  = useCallback(() => openTab('add-news'), [openTab]);
  const openEdit    = useCallback((n: News) => openTab(`edit-news:${n.id}`), [openTab]);
  const openView    = useCallback((id: string) => openTab(`view-news:${id}`), [openTab]);

  const askDelete = (id: string) => setConfirm({
    open: true,
    title: 'Excluir notícia',
    message: 'Excluir esta notícia? Esta ação não pode ser desfeita.',
    onConfirm: async () => { await deleteNews(id); },
  });

  const cancelConfirm = () => setConfirm(closedConfirm());
  const runConfirm    = async () => { await confirm.onConfirm(); setConfirm(closedConfirm()); };

  const handleToggleLike = useCallback(async (n: News) => {
    if (!user) return;
    await toggleLike(n.id, user.id, n.likedBy.includes(user.id));
  }, [user, toggleLike]);

  const handleToggleSaved = useCallback(async (n: News) => {
    const interaction = getInteraction(n.id);
    await toggleSavedForLater(n.id, interaction?.savedForLater ?? false);
  }, [getInteraction, toggleSavedForLater]);

  // Qualquer usuário autenticado com acesso ao escritório pode criar notícias
  const canCreate = !!user;

  // updateNews precisa existir para o ViewModel ser válido, mesmo sem approval
  void updateNews;

  return {
    rows,
    filterTokens,
    filterDefs,
    savedFiltersScreenKey: 'news',
    confirm,
    userRole,
    unreadCount,
    canCreate,
    setFilterTokens,
    openCreate, openEdit, openView,
    askDelete, cancelConfirm, runConfirm,
    handleToggleLike, handleToggleSaved,
  };
};
