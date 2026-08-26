import { useCallback, useMemo } from 'react';
import {
  useCan, useCurrentUser, useEntity, useEntityList, useLookup, useNotify, useUpdateRecord, useWorkspace,
} from '@microteia/data';
import { useLocaleFormat, useT } from '@microteia/i18n';
import {
  UNREAD_TOKENS,
  asDate,
  categoryLabelOf,
  commentCountsOf,
  indexById,
  listOf,
  has,
  matchesReadStatus,
  removed,
  tagsOf,
  toggled,
  unreadCountOf,
} from './NewsList.rules';

const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';
const READ_TAB_PREFIX = 'news-read:';

export const useNewsListViewModel = () => {
  const t = useT('com.microteia.news');
  const { formatDateTime } = useLocaleFormat();
  const me = useCurrentUser();
  const can = useCan();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: UNREAD_TOKENS });
  const comments = useEntity(COMMENT_SOURCE_ID);
  const categories = useLookup('newsCategories');
  const updateRecord = useUpdateRecord();
  const notify = useNotify();
  const { openTab } = useWorkspace();

  // The collection is the one the SCREEN resolves, not a fixed name: the install may disambiguate the
  // key, and a write addressed to the wrong collection fails silently.
  const collection = list.collection;

  const patch = useCallback((record, data) => {
    void updateRecord(collection, record.id, data).catch(() => {
      notify(t('view.write-denied'), 'error');
    });
  }, [updateRecord, collection, notify, t]);

  /**
   * The reading-status filter is the only one assembled here, and it has to be: it does not look at a
   * field, it looks at the relation between the item and whoever is reading the screen. Its labels go
   * through the catalog like any other text.
   */
  const filterDefs = useMemo(() => list.filterDefs.concat([{
    key: 'readStatus',
    label: t('list.filter.read-status'),
    type: 'select',
    options: [
      { value: 'UNREAD', label: t('list.filter.unread') },
      { value: 'READ', label: t('list.filter.read') },
      { value: 'SAVED', label: t('list.filter.saved') },
    ],
  }]), [list.filterDefs, t]);

  const readStatus = useMemo(() => {
    const token = list.filterTokens.find((item) => item.key === 'readStatus');
    return token ? token.values : [];
  }, [list.filterTokens]);

  const records = useMemo(
    () => list.filteredRecords.filter((record) => matchesReadStatus(record, readStatus, me.id)),
    [list.filteredRecords, readStatus, me.id],
  );

  const commentCounts = useMemo(() => commentCountsOf(comments.records), [comments.records]);
  const unreadCount = useMemo(() => unreadCountOf(list.records, me.id), [list.records, me.id]);
  const tagsById = useMemo(() => indexById(list.tags), [list.tags]);

  const openRead = useCallback((record) => openTab(READ_TAB_PREFIX + record.id), [openTab]);

  const cardClick = useCallback((event, record) => {
    if (event.target.closest('button')) return;
    openRead(record);
  }, [openRead]);

  /**
   * Everything one card shows, decided in one place. The view reads it and draws — it never asks who
   * the reader is, nor whether that reader may edit.
   */
  const cardOf = useCallback((record) => {
    const isRead = has(record.readBy, me.id);
    return {
      isRead,
      isSaved: has(record.savedBy, me.id),
      hasLiked: has(record.likedBy, me.id),
      likes: listOf(record.likedBy).length,
      views: record.viewCount || 0,
      comments: commentCounts[record.id] || 0,
      tags: tagsOf(record, tagsById),
      actions: list.getCardActions(record),
      canEdit: record.createdBy === me.id || can('news.update'),
      category: categoryLabelOf(categories, record, t('category.general')),
      author: record.createdByName || t('view.author'),
      photo: record.createdByPhotoURL || null,
      when: formatDateTime(asDate(record.updatedByName ? record.updatedAt : record.createdAt)),
      editedWhen: formatDateTime(asDate(record.updatedAt)),
    };
  }, [me.id, commentCounts, tagsById, list, can, categories, t, formatDateTime]);

  return {
    t,
    list,
    screenMissing: !list.definition,
    title: list.definition?.titlePlural,
    records,
    unreadCount,
    filter: {
      defs: filterDefs,
      tokens: list.filterTokens,
      onChange: list.setFilterTokens,
      screenKey: list.savedFiltersScreenKey,
    },
    isLoading: list.isLoading && list.records.length === 0,
    cardOf,
    cardClick,
    openRead,
    openNew: list.openNewRecord,
    openEdit: (record) => list.openRecord(record),
    toggleLike: (record) => patch(record, { likedBy: toggled(record.likedBy, me.id) }),
    toggleSaved: (record) => patch(record, { savedBy: toggled(record.savedBy, me.id) }),
    markAsUnread: (record) => patch(record, { readBy: removed(record.readBy, me.id) }),
  };
};
