import { useState, useMemo, useCallback, useEffect } from 'react';
import { useNews } from '../../../stores/useNews';
import { useNewsTag } from '../../../stores/useNewsTag';
import { useNewsInteraction } from '../../../stores/useNewsInteraction';
import { useNewsCategoryLookup } from '../../../stores/useNewsCategoryLookup';
import { useDocumentTypeLookup } from '../../../stores/useDocumentTypeLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import { makeGetNewsDocumentsUseCase } from '../../../domain/usecases/newsdocuments/GetNewsDocumentsUseCase';
import { makeUploadNewsDocumentUseCase } from '../../../domain/usecases/newsdocuments/UploadNewsDocumentUseCase';
import { makeAddNewsDocumentUseCase } from '../../../domain/usecases/newsdocuments/AddNewsDocumentUseCase';
import { makeDeleteNewsDocumentUseCase } from '../../../domain/usecases/newsdocuments/DeleteNewsDocumentUseCase';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { News, NewsTag, NewsDocument } from '../../../domain/entities';

export type ViewNewsTab = 'news' | 'documents';

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
  handleMarkAsUnread: () => Promise<void>;
  handleEdit: () => void;
  handleCopyDeepLink: () => void;

  activeTab: ViewNewsTab;
  setActiveTab: (tab: ViewNewsTab) => void;

  documents: NewsDocument[];
  docsLoading: boolean;
  isUploadingDoc: boolean;
  pendingFile: File | null;
  pendingType: string;
  setPendingType: (v: string) => void;
  documentTypeOptions: DynamicSelectOption[];
  documentTypeDynamicOptions: DynamicSelectOption[];
  handleAddDocumentType: (name: string) => Promise<void>;
  handleDeleteDocumentType: (key: string) => Promise<void>;
  handleSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmUpload: () => Promise<void>;
  handleCancelPendingUpload: () => void;
  docToDelete: NewsDocument | null;
  requestDeleteDoc: (doc: NewsDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;
}

export const useViewNewsViewModel = (tabKey: string): ViewNewsViewModel => {
  const newsId = tabKey.replace('view-news:', '');
  const { news, toggleLike } = useNews();
  const { tags, getTagsForNews, setTagsForNews, createTag, updateTag, deleteTag } = useNewsTag();
  const { getInteraction, markAsRead, markAsUnread, toggleSavedForLater } = useNewsInteraction();
  const { categoryConfigs } = useNewsCategoryLookup();
  const { typeConfigs: documentTypeConfigs, addItem: addDocumentType, removeItem: removeDocumentType } = useDocumentTypeLookup();
  const { user, userRole, effectiveName } = useAuth();
  const { currentTenant } = useTenant();
  const { setTabTitle, openTab } = useWorkspace();
  const { notify } = useNotification();
  const { newsDocumentRepository } = useDI();

  const [tagManagerOpen, setTagManagerOpen] = useState(false);
  const [hasMarkedRead, setHasMarkedRead] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [activeTab, setActiveTab] = useState<ViewNewsTab>('news');

  const [documents, setDocuments] = useState<NewsDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docToDelete, setDocToDelete] = useState<NewsDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');

  const item = useMemo(
    () => news.find((n) => n.id === newsId) ?? null,
    [news, newsId],
  );

  const docUC = useMemo(() => ({
    get:    makeGetNewsDocumentsUseCase(newsDocumentRepository),
    upload: makeUploadNewsDocumentUseCase(newsDocumentRepository),
    add:    makeAddNewsDocumentUseCase(newsDocumentRepository),
    delete: makeDeleteNewsDocumentUseCase(newsDocumentRepository),
  }), [newsDocumentRepository]);

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

  useEffect(() => {
    if (!item) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial após navegação para aba
    setDocsLoading(true);
    docUC.get.execute(item.id)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [item, docUC]);

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

  const handleMarkAsUnread = useCallback(async () => {
    await markAsUnread(newsId);
  }, [newsId, markAsUnread]);

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

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter(t => t.isStatic !== false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter(t => t.isStatic === false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );

  const handleAddDocumentType = useCallback(async (name: string) => { await addDocumentType(name); }, [addDocumentType]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeDocumentType(key); }, [removeDocumentType]);

  const handleSelectFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPendingType('');
    }
    e.target.value = '';
  }, []);

  const handleCancelPendingUpload = useCallback(() => {
    setPendingFile(null);
    setPendingType('');
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFile || !item || !user) return;
    setIsUploadingDoc(true);
    try {
      const raw = await docUC.upload.execute(item.id, pendingFile);
      const { url, storagePath } = JSON.parse(raw) as { url: string; storagePath: string };
      const addedDoc = await docUC.add.execute(item.id, {
        name: pendingFile.name,
        type: pendingType.trim() || undefined,
        url,
        storagePath,
        createdBy: user.id,
        createdByName: effectiveName,
        createdByPhotoUrl: user.photoURL ?? undefined,
      });
      setDocuments((prev) => [addedDoc, ...prev]);
      setPendingFile(null);
      setPendingType('');
      notify('Documento enviado com sucesso.', 'success');
    } catch {
      notify('Erro ao enviar documento.', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  }, [pendingFile, pendingType, item, user, effectiveName, docUC, notify]);

  const requestDeleteDoc = useCallback((doc: NewsDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !item) return;
    try {
      await docUC.delete.execute(item.id, docToDelete.id, docToDelete.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, item, docUC, notify]);

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
    handleMarkAsUnread,
    handleEdit,
    handleCopyDeepLink,
    activeTab,
    setActiveTab,
    documents,
    docsLoading,
    isUploadingDoc,
    pendingFile,
    pendingType,
    setPendingType,
    documentTypeOptions,
    documentTypeDynamicOptions,
    handleAddDocumentType,
    handleDeleteDocumentType,
    handleSelectFile,
    handleConfirmUpload,
    handleCancelPendingUpload,
    docToDelete,
    requestDeleteDoc,
    confirmDeleteDoc,
    cancelDeleteDoc,
  };
};
