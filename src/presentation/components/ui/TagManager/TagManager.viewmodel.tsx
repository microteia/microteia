import { useState, useCallback } from 'react';
import { useTheme } from 'styled-components';
import { useTenant } from '../../../../stores/useTenant';
import { useNotification } from '../../../../stores/useNotification';
import { DEFAULT_TAG_COLOR_LABEL } from '../../../../shared/styles/colorUtils';
import { useT } from '../../../shared/i18n/useT';

export type BaseTag = { id: string; name: string; color: string };

export interface TagStoreAdapter {
  tags: BaseTag[];
  getAppliedTags: (entityId: string) => BaseTag[];
  setTags: (entityId: string, tagIds: string[]) => void | Promise<void>;
  createTag: (name: string, color: string) => Promise<BaseTag>;
  updateTag: (id: string, data: { name: string; color: string }) => Promise<void>;
  deleteTag: (id: string) => Promise<void>;
}

export interface TagManagerProps {
  entityId: string;
  onClose: () => void;
  adapter: TagStoreAdapter;
}

export interface TagManagerViewModel {
  isAdmin: boolean;
  appliedTagIds: string[];
  allTags: BaseTag[];
  appliedFilteredTags: BaseTag[];
  restFilteredTags: BaseTag[];
  searchFilter: string;
  tagColors: { label: string; value: string }[];
  editingTag: BaseTag | null;
  isCreating: boolean;
  newTagName: string;
  newTagColor: string;
  editName: string;
  editColor: string;
  saving: boolean;
  setSearchFilter: (v: string) => void;
  toggleTag: (tagId: string) => void;
  startCreate: () => void;
  cancelCreate: () => void;
  setNewTagName: (v: string) => void;
  setNewTagColor: (v: string) => void;
  handleCreate: () => Promise<void>;
  startEdit: (tag: BaseTag) => void;
  cancelEdit: () => void;
  setEditName: (v: string) => void;
  setEditColor: (v: string) => void;
  handleSaveEdit: () => Promise<void>;
  handleDelete: (id: string) => Promise<void>;
}

export const useTagManagerViewModel = (props: TagManagerProps): TagManagerViewModel => {
  const { adapter, entityId } = props;
  const { tags, getAppliedTags, setTags, createTag, updateTag, deleteTag } = adapter;
  const { tenantRole } = useTenant();
  const { notify } = useNotification();
  const isAdmin = tenantRole === 'admin';
  const theme = useTheme();
  const t = useT('core.ui');
  const tagColors = theme.tagColors;
  const defaultTagColor = tagColors.find((c) => c.label === DEFAULT_TAG_COLOR_LABEL)?.value ?? tagColors[0].value;

  const appliedTags = getAppliedTags(entityId);
  const [appliedTagIds, setAppliedTagIds] = useState<string[]>(appliedTags.map((t) => t.id));

  const [searchFilter, setSearchFilter] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newTagName, setNewTagName] = useState('');
  const [newTagColor, setNewTagColor] = useState(defaultTagColor);

  const [editingTag, setEditingTag] = useState<BaseTag | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('');

  const [saving, setSaving] = useState(false);

  const baseFiltered = searchFilter.trim()
    ? tags.filter((t) => t.name.toLowerCase().includes(searchFilter.toLowerCase()))
    : tags;

  const appliedFilteredTags = baseFiltered.filter((t) => appliedTagIds.includes(t.id));
  const restFilteredTags = baseFiltered.filter((t) => !appliedTagIds.includes(t.id));

  const toggleTag = useCallback((tagId: string) => {
    const next = appliedTagIds.includes(tagId)
      ? appliedTagIds.filter((id) => id !== tagId)
      : [...appliedTagIds, tagId];
    setAppliedTagIds(next);
    void setTags(entityId, next);
  }, [appliedTagIds, entityId, setTags]);

  const startCreate = () => {
    setEditingTag(null);
    setNewTagName('');
    setNewTagColor(defaultTagColor);
    setIsCreating(true);
  };

  const cancelCreate = () => setIsCreating(false);

  const handleCreate = async () => {
    if (!newTagName.trim()) return;
    setSaving(true);
    try {
      const tag = await createTag(newTagName.trim(), newTagColor);
      const next = [...appliedTagIds, tag.id];
      setAppliedTagIds(next);
      await setTags(entityId, next);
      setIsCreating(false);
      setNewTagName('');
    } catch {
      notify(t('tags.error.create'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (tag: BaseTag) => {
    setIsCreating(false);
    setEditingTag(tag);
    setEditName(tag.name);
    setEditColor(tag.color);
  };

  const cancelEdit = () => setEditingTag(null);

  const handleSaveEdit = async () => {
    if (!editingTag || !editName.trim()) return;
    setSaving(true);
    try {
      await updateTag(editingTag.id, { name: editName.trim(), color: editColor });
      setEditingTag(null);
    } catch {
      notify(t('tags.error.save'), 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await deleteTag(id);
      const next = appliedTagIds.filter((tid) => tid !== id);
      setAppliedTagIds(next);
    } catch {
      notify(t('tags.error.delete'), 'error');
    }
  };

  return {
    isAdmin,
    appliedTagIds,
    allTags: tags,
    appliedFilteredTags,
    restFilteredTags,
    searchFilter,
    tagColors,
    editingTag,
    isCreating,
    newTagName,
    newTagColor,
    editName,
    editColor,
    saving,
    setSearchFilter,
    toggleTag,
    startCreate,
    cancelCreate,
    setNewTagName,
    setNewTagColor,
    handleCreate,
    startEdit,
    cancelEdit,
    setEditName,
    setEditColor,
    handleSaveEdit,
    handleDelete,
  };
};
