import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  useCan, useCreateRecord, useCurrentUser, useDeleteRecord, useEntity, useEntityList,
  useLookup, useNotify, useRecordDocuments, useUpdateRecord, useWorkspace,
} from '@microteia/data';
import { useLocaleFormat, useT } from '@microteia/i18n';
import {
  added,
  asDate,
  categoryLabelOf,
  formatLikes,
  has,
  isTruncatable,
  listOf,
  newsIdOf,
  removed,
  tagsOf,
  threadOf,
  toggled,
  withExpanded,
} from './NewsRead.rules';

const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';

export const useNewsReadViewModel = (tabKey) => {
  const t = useT('com.microteia.news');
  const { formatDate, formatDateTime } = useLocaleFormat();
  const newsId = newsIdOf(tabKey);
  const me = useCurrentUser();
  const list = useEntityList(SOURCE_ID);
  const can = useCan();
  const comments = useEntity(COMMENT_SOURCE_ID);
  const categories = useLookup('newsCategories');
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const notify = useNotify();
  const { setTabTitle } = useWorkspace();

  // The collection is the one the SCREEN resolves, not a fixed name — see the list view.
  const collection = list.collection;

  const [activeTab, setActiveTab] = useState('news');
  const [collapsed, setCollapsed] = useState(false);
  const [expandedIds, setExpandedIds] = useState({});
  const [editingId, setEditingId] = useState(null);
  const [editContent, setEditContent] = useState('');
  const [newContent, setNewContent] = useState('');
  const [editorOpen, setEditorOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const [readMarked, setReadMarked] = useState(false);

  const docs = useRecordDocuments(collection, newsId, activeTab === 'documents');

  const record = useMemo(
    () => list.records.find((item) => item.id === newsId) || null,
    [list.records, newsId],
  );

  const commentCollection = comments.collection;
  const threadComments = useMemo(() => threadOf(comments.records, newsId), [comments.records, newsId]);

  useEffect(() => {
    if (record) setTabTitle(tabKey, record.title);
  }, [record, tabKey, setTabTitle]);

  // Opening IS reading: the reading goes into the array on the document itself and the menu badge
  // goes down on its own, because it counts with an expression over this very field.
  //
  // The mark happens ONCE per opening, and not "whenever the item is unread": without the latch,
  // "mark as unread" removed the id from the array and this same effect put it back on the next
  // render — the button looked as if it did nothing and the badge never came back.
  useEffect(() => {
    if (!record || !me.id || readMarked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- the latch IS the effect: see the comment above
    setReadMarked(true);
    if (has(record.readBy, me.id)) return;
    void updateRecord(collection, record.id, {
      readBy: added(record.readBy, me.id),
      viewCount: (record.viewCount || 0) + 1,
    }).catch(() => {
      // Marking as read is a write on ANOTHER person's document. If it is refused, the menu badge
      // does not go down — and a badge that does not go down without explanation is worse than the
      // warning.
      notify(t('read.mark-failed'), 'error');
    });
  }, [record, me.id, readMarked, collection, updateRecord, notify, t]);

  const patch = useCallback((data) => {
    if (!record) return Promise.resolve();
    return updateRecord(collection, record.id, data).catch(() => {
      notify(t('view.write-denied'), 'error');
    });
  }, [record, updateRecord, collection, notify, t]);

  // Commenting, editing and deleting a comment return the item to everyone's inbox: the reading array
  // keeps only whoever just touched it. It is what the interactions collection did with one write per
  // person, and here it is a single one.
  const reopenForEveryone = useCallback(() => patch({ readBy: [me.id] }), [patch, me.id]);

  const submitComment = useCallback(async () => {
    if (!newContent.trim()) return;
    setSubmitting(true);
    try {
      await createRecord(commentCollection, { newsId: newsId, content: newContent.trim() });
      setNewContent('');
      setEditorOpen(false);
      await reopenForEveryone();
    } finally {
      setSubmitting(false);
    }
  }, [newContent, createRecord, commentCollection, newsId, reopenForEveryone]);

  const saveEdit = useCallback(async () => {
    if (!editingId || !editContent.trim()) return;
    setSubmitting(true);
    try {
      await updateRecord(commentCollection, editingId, {
        content: editContent.trim(),
        updatedBy: me.id,
        updatedByName: me.name,
        updatedByPhotoURL: me.photoURL || '',
      });
      setEditingId(null);
      setEditContent('');
      await reopenForEveryone();
    } finally {
      setSubmitting(false);
    }
  }, [editingId, editContent, updateRecord, commentCollection, me, reopenForEveryone]);

  const removeComment = useCallback(async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteRecord(commentCollection, confirmDeleteId);
      await reopenForEveryone();
    } finally {
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, deleteRecord, commentCollection, reopenForEveryone]);

  const toggleCommentLike = useCallback((comment) => updateRecord(commentCollection, comment.id, {
    likedBy: toggled(comment.likedBy, me.id),
  }), [updateRecord, commentCollection, me.id]);

  const article = useMemo(() => (record === null ? null : {
    author: record.createdByName || t('view.author'),
    photo: record.createdByPhotoURL || null,
    authorTitle: record.createdByName,
    category: categoryLabelOf(categories, record, t('category.general')),
    when: formatDateTime(asDate(record.updatedByName ? record.updatedAt : record.createdAt)),
    editedWhen: formatDateTime(asDate(record.createdAt)),
    tags: tagsOf(record, list.tags),
    actions: list.getCardActions(record),
    canEdit: record.createdBy === me.id || can('news.update'),
    isSaved: has(record.savedBy, me.id),
    hasLiked: has(record.likedBy, me.id),
    isRead: has(record.readBy, me.id),
    likes: listOf(record.likedBy).length,
    views: record.viewCount || 0,
  }), [record, categories, list, me.id, can, t, formatDateTime]);

  /** Everything one comment shows, decided in one place — including who may edit or delete it. */
  const commentOf = useCallback((comment) => {
    const content = String(comment.content || '');
    const likes = listOf(comment.likedBy).length;
    return {
      content,
      isEditing: editingId === comment.id,
      isConfirming: confirmDeleteId === comment.id,
      truncatable: isTruncatable(content),
      expanded: !!expandedIds[comment.id],
      liked: has(comment.likedBy, me.id),
      canModify: comment.createdBy === me.id || can('newsComments.delete'),
      author: comment.createdByName || t('view.author'),
      photo: comment.createdByPhotoURL || null,
      when: formatDate(asDate(comment.createdAt)),
      editedTitle: !comment.updatedByName ? '' : t('comment.edited.title', {
        name: comment.updatedByName,
        when: formatDateTime(asDate(comment.updatedAt)),
      }),
      likesLabel: likes > 0 ? formatLikes(likes) : null,
    };
  }, [editingId, confirmDeleteId, expandedIds, me.id, can, t, formatDate, formatDateTime]);

  return {
    t,
    list,
    record,
    article,
    screenMissing: !list.definition,
    notFound: record === null,
    activeTab,
    showTab: setActiveTab,
    docs,
    canDeleteDocuments: can('news.delete'),
    canManageDocumentTypes: can('document-types.manage'),
    openEdit: () => list.openRecord(record),
    toggleLike: () => patch({ likedBy: toggled(record.likedBy, me.id) }),
    toggleSaved: () => patch({ savedBy: toggled(record.savedBy, me.id) }),
    markAsUnread: () => patch({ readBy: removed(record.readBy, me.id) }),
    comments: {
      isLoading: comments.isLoading,
      items: threadComments,
      count: threadComments.length,
      collapsed,
      toggleCollapsed: () => setCollapsed(!collapsed),
    },
    commentOf,
    toggleExpanded: (id) => setExpandedIds((prev) => withExpanded(prev, id)),
    toggleCommentLike,
    startEdit: (comment) => { setEditingId(comment.id); setEditContent(String(comment.content || '')); },
    cancelEdit: () => { setEditingId(null); setEditContent(''); },
    editContent,
    setEditContent,
    saveEdit,
    askDelete: (comment) => setConfirmDeleteId(comment.id),
    cancelDelete: () => setConfirmDeleteId(null),
    removeComment,
    editorOpen,
    openEditor: () => setEditorOpen(true),
    closeEditor: () => { setEditorOpen(false); setNewContent(''); },
    newContent,
    setNewContent,
    submitComment,
    submitting,
  };
};
