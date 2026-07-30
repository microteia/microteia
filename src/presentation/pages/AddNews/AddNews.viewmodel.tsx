import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNews } from '../../../stores/useNews';
import { useNewsInteraction } from '../../../stores/useNewsInteraction';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useLookups } from '../../../stores/useLookups';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';

export interface AddNewsViewModel {
  isEdit: boolean;
  title: string;
  summary: string;
  content: string;
  category: string;
  // true = notícia do Sistema (tenantId null), false = notícia do escritório
  isSystemScope: boolean;
  canChooseScope: boolean;
  sourceURL: string;
  saving: boolean;
  canSave: boolean;
  categoryOptions: DynamicSelectOption[];
  categoryDynamicOptions: DynamicSelectOption[];
  setTitle: (v: string) => void;
  setSummary: (v: string) => void;
  setContent: (v: string) => void;
  setCategory: (v: string) => void;
  setIsSystemScope: (v: boolean) => void;
  setSourceURL: (v: string) => void;
  handleAddCategory: (name: string) => Promise<void>;
  handleDeleteCategory: (key: string) => Promise<void>;
  isAdmin: boolean;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
}

export const useAddNewsViewModel = (tabKey: string): AddNewsViewModel => {
  const isEdit = tabKey.startsWith('edit-news:');
  const editId = isEdit ? tabKey.replace('edit-news:', '') : null;

  const { news, createNews, updateNews } = useNews();
  const { markAsRead } = useNewsInteraction();
  const { getOptions, addOption, removeOption } = useLookups();
  const categoryConfigs = getOptions('newsCategories');
  const { panels, closeTab } = useWorkspace();
  const { userRole, effectiveName, effectivePhotoURL } = useAuth();
  const { currentTenant, tenantRole } = useTenant();
  const isAdmin = tenantRole === 'admin';

  const [title, setTitle]         = useState('');
  const [summary, setSummary]     = useState('');
  const [content, setContent]     = useState('');
  const [category, setCategory]   = useState('GENERAL');
  // ADMIN começa com escopo do escritório por padrão; pode trocar para Sistema
  const [isSystemScope, setIsSystemScope] = useState(false);
  const [sourceURL, setSourceURL] = useState('');
  const [saving, setSaving]       = useState(false);

  const initRef = useRef(false);

  const existing = useMemo(
    () => (editId ? news.find((n) => n.id === editId) ?? null : null),
    [news, editId],
  );

  useEffect(() => {
    if (initRef.current || !isEdit || !existing) return;
    initRef.current = true;
    setTitle(existing.title);
    setSummary(existing.summary);
    setContent(existing.content ?? '');
    setCategory(existing.category);
    setIsSystemScope(existing.tenantId === null);
    setSourceURL(existing.sourceURL ?? '');
  }, [isEdit, existing]);

  const canChooseScope = userRole === 'SYSTEM';

  const closeThisTab = useCallback(() => {
    const panelId = Object.entries(panels).find(([, p]) => p.tabKeys.includes(tabKey))?.[0];
    if (panelId) closeTab(tabKey, panelId);
  }, [panels, closeTab, tabKey]);

  const categoryOptions = useMemo<DynamicSelectOption[]>(
    () => categoryConfigs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );
  const categoryDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => categoryConfigs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );

  const handleAddCategory = useCallback(async (name: string) => { await addOption('newsCategories', name); }, [addOption]);
  const handleDeleteCategory = useCallback(async (key: string) => { await removeOption('newsCategories', key); }, [removeOption]);

  const handleSave = async () => {
    if (!title.trim() || !summary.trim()) return;
    setSaving(true);
    try {
      // Resolve o tenantId: ADMIN com escopo sistema → null; demais → tenant atual
      const effectiveTenantId: string | null =
        canChooseScope && isSystemScope ? null : (currentTenant?.id ?? null);

      const payload = {
        title: title.trim(),
        summary: summary.trim(),
        content: content.trim() || undefined,
        category,
        sourceURL: sourceURL.trim() || undefined,
        tenantId: effectiveTenantId,
        likeCount: existing?.likeCount ?? 0,
        likedBy: existing?.likedBy ?? [],
        viewCount: existing?.viewCount ?? 0,
      };

      if (isEdit && editId) {
        await updateNews(editId, {
          ...payload,
          editedAt: new Date(),
          editedByName: effectiveName,
        });
      } else {
        const created = await createNews({
          ...payload as Parameters<typeof createNews>[0],
          authorName: effectiveName,
          authorPhotoURL: effectivePhotoURL ?? null,
        });
        await markAsRead(created.id);
      }
      closeThisTab();
    } finally {
      setSaving(false);
    }
  };

  return {
    isEdit,
    title, summary, content, category,
    isSystemScope,
    canChooseScope,
    sourceURL,
    saving,
    canSave: title.trim().length > 0 && summary.trim().length > 0,
    categoryOptions,
    categoryDynamicOptions,
    setTitle, setSummary, setContent,
    setCategory,
    setIsSystemScope,
    setSourceURL,
    handleAddCategory,
    handleDeleteCategory,
    isAdmin,
    handleSave,
    handleCancel: closeThisTab,
  };
};
