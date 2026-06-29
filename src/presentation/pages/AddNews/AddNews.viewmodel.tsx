import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useNews } from '../../../stores/useNews';
import { useNewsInteraction } from '../../../stores/useNewsInteraction';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import type { NewsCategory } from '../../../domain/entities';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

export interface AddNewsViewModel {
  isEdit: boolean;
  title: string;
  summary: string;
  content: string;
  category: NewsCategory;
  // true = notícia do Sistema (tenantId null), false = notícia do escritório
  isSystemScope: boolean;
  canChooseScope: boolean;
  sourceURL: string;
  saving: boolean;
  canSave: boolean;
  categoryOptions: SearchSelectOption[];
  setTitle: (v: string) => void;
  setSummary: (v: string) => void;
  setContent: (v: string) => void;
  setCategory: (v: NewsCategory) => void;
  setIsSystemScope: (v: boolean) => void;
  setSourceURL: (v: string) => void;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
}

const CATEGORY_OPTIONS: SearchSelectOption[] = [
  { value: 'GENERAL', label: 'Geral' },
  { value: 'JURISPRUDENCE', label: 'Jurisprudência' },
  { value: 'LEGISLATION', label: 'Legislação' },
  { value: 'ANNOUNCEMENT', label: 'Comunicado' },
  { value: 'CIRCULAR', label: 'Circular' },
];

export const useAddNewsViewModel = (tabKey: string): AddNewsViewModel => {
  const isEdit = tabKey.startsWith('edit-news:');
  const editId = isEdit ? tabKey.replace('edit-news:', '') : null;

  const { news, createNews, updateNews } = useNews();
  const { markAsRead } = useNewsInteraction();
  const { panels, closeTab } = useWorkspace();
  const { userRole, effectiveName, effectivePhotoURL } = useAuth();
  const { currentTenant } = useTenant();

  const [title, setTitle]         = useState('');
  const [summary, setSummary]     = useState('');
  const [content, setContent]     = useState('');
  const [category, setCategory]   = useState<NewsCategory>('GENERAL');
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
    categoryOptions: CATEGORY_OPTIONS,
    setTitle, setSummary, setContent,
    setCategory: setCategory as (v: NewsCategory) => void,
    setIsSystemScope,
    setSourceURL,
    handleSave,
    handleCancel: closeThisTab,
  };
};
