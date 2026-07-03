import { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '../../../../stores/useAuth';
import { useNewsInteraction } from '../../../../stores/useNewsInteraction';
import { useDI } from '../../../../infrastructure/di/useDI';
import { makeGetNewsCommentsUseCase } from '../../../../domain/usecases/newscomments/GetNewsCommentsUseCase';
import { makeCreateNewsCommentUseCase } from '../../../../domain/usecases/newscomments/CreateNewsCommentUseCase';
import { makeUpdateNewsCommentUseCase } from '../../../../domain/usecases/newscomments/UpdateNewsCommentUseCase';
import { makeDeleteNewsCommentUseCase } from '../../../../domain/usecases/newscomments/DeleteNewsCommentUseCase';
import { makeToggleNewsCommentLikeUseCase } from '../../../../domain/usecases/newscomments/ToggleNewsCommentLikeUseCase';
import type { NewsComment, DeletionActor } from '../../../../domain/entities';

export const CONTENT_TRUNCATE_THRESHOLD = 500;

export interface NewsCommentsProps {
  newsId: string;
}

export interface NewsCommentsViewModel {
  comments: NewsComment[];
  loading: boolean;
  collapsed: boolean;
  expandedIds: Set<string>;
  editingId: string | null;
  editContent: string;
  newContent: string;
  editorOpen: boolean;
  submitting: boolean;
  confirmDeleteId: string | null;
  currentUserId: string | null;
  canModify: (comment: NewsComment) => boolean;
  formatLikeCount: (count: number) => string;
  toggleCollapsed: () => void;
  toggleExpand: (id: string) => void;
  openEditor: () => void;
  setNewContent: (value: string) => void;
  handleSubmitNew: () => Promise<void>;
  handleCancelNew: () => void;
  handleStartEdit: (comment: NewsComment) => void;
  setEditContent: (value: string) => void;
  handleSaveEdit: () => Promise<void>;
  handleCancelEdit: () => void;
  handleAskDelete: (id: string) => void;
  handleConfirmDelete: () => Promise<void>;
  handleCancelDelete: () => void;
  handleToggleLike: (comment: NewsComment) => Promise<void>;
}

export const useNewsCommentsViewModel = (
  props: NewsCommentsProps,
): NewsCommentsViewModel => {
  const { user, userRole, effectiveName, effectivePhotoURL } = useAuth();
  const { resetReadStatus } = useNewsInteraction();
  const { newsCommentRepository } = useDI();

  const getUC    = useMemo(() => makeGetNewsCommentsUseCase(newsCommentRepository), [newsCommentRepository]);
  const createUC = useMemo(() => makeCreateNewsCommentUseCase(newsCommentRepository), [newsCommentRepository]);
  const updateUC = useMemo(() => makeUpdateNewsCommentUseCase(newsCommentRepository), [newsCommentRepository]);
  const deleteUC = useMemo(() => makeDeleteNewsCommentUseCase(newsCommentRepository), [newsCommentRepository]);
  const likeUC   = useMemo(() => makeToggleNewsCommentLikeUseCase(newsCommentRepository), [newsCommentRepository]);

  const [comments, setComments]               = useState<NewsComment[]>([]);
  const [loading, setLoading]                 = useState(true);
  const [collapsed, setCollapsed]             = useState(false);
  const [expandedIds, setExpandedIds]         = useState<Set<string>>(new Set());
  const [editingId, setEditingId]             = useState<string | null>(null);
  const [editContent, setEditContent]         = useState('');
  const [newContent, setNewContent]           = useState('');
  const [editorOpen, setEditorOpen]           = useState(false);
  const [submitting, setSubmitting]           = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initializing loading state before async operation
    setLoading(true);
    getUC.execute(props.newsId)
      .then((data) => { if (!cancelled) setComments(data); })
      .catch((err) => { console.error('[NewsComments] load:', err); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [props.newsId, getUC, user]);

  const sorted = useMemo(
    () => [...comments].sort((a, b) => {
      if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
      return b.createdAt.getTime() - a.createdAt.getTime();
    }),
    [comments],
  );

  const canModify = useCallback(
    (comment: NewsComment) =>
      !!user && (
        comment.userId === user.id ||
        userRole === 'SYSTEM'
      ),
    [user, userRole],
  );

  const formatLikeCount = useCallback((count: number): string => {
    if (count < 1000) return String(count);
    const k = count / 1000;
    return k % 1 === 0 ? `${k}k` : `${k.toFixed(1)}k`;
  }, []);

  const toggleCollapsed = useCallback(() => setCollapsed((p) => !p), []);

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const openEditor = useCallback(() => setEditorOpen(true), []);

  const handleCancelNew = useCallback(() => {
    setEditorOpen(false);
    setNewContent('');
  }, []);

  const handleSubmitNew = useCallback(async () => {
    if (!user || !newContent.trim()) return;
    setSubmitting(true);
    try {
      const created = await createUC.execute({
        userId: user.id,
        newsId: props.newsId,
        content: newContent.trim(),
        authorName: effectiveName,
        authorPhotoURL: effectivePhotoURL,
        createdAt: new Date(),
        likeCount: 0,
        likedBy: [],
      });
      setComments((prev) => [created, ...prev]);
      setNewContent('');
      setEditorOpen(false);
      await resetReadStatus(props.newsId);
    } finally {
      setSubmitting(false);
    }
  }, [user, newContent, props.newsId, createUC, effectiveName, effectivePhotoURL, resetReadStatus]);

  const handleStartEdit = useCallback((comment: NewsComment) => {
    setEditingId(comment.id);
    setEditContent(comment.content);
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!user || !editingId || !editContent.trim()) return;
    setSubmitting(true);
    const now = new Date();
    try {
      await updateUC.execute(editingId, {
        content: editContent.trim(),
        editedAt: now,
        editedByName: effectiveName,
      });
      setComments((prev) =>
        prev.map((c) =>
          c.id === editingId
            ? { ...c, content: editContent.trim(), editedAt: now, editedByName: effectiveName }
            : c,
        ),
      );
      setEditingId(null);
      setEditContent('');
      await resetReadStatus(props.newsId);
    } finally {
      setSubmitting(false);
    }
  }, [user, editingId, editContent, updateUC, effectiveName, props.newsId, resetReadStatus]);

  const handleCancelEdit = useCallback(() => {
    setEditingId(null);
    setEditContent('');
  }, []);

  const handleAskDelete    = useCallback((id: string) => setConfirmDeleteId(id), []);
  const handleCancelDelete = useCallback(() => setConfirmDeleteId(null), []);

  const handleConfirmDelete = useCallback(async () => {
    if (!confirmDeleteId) return;
    try {
      const actor: DeletionActor = { uid: user?.id ?? '', name: effectiveName, photoURL: effectivePhotoURL ?? '' };
      await deleteUC.execute(confirmDeleteId, props.newsId, actor);
      setComments((prev) => prev.filter((c) => c.id !== confirmDeleteId));
      await resetReadStatus(props.newsId);
    } finally {
      setConfirmDeleteId(null);
    }
  }, [confirmDeleteId, deleteUC, props.newsId, resetReadStatus, user, effectiveName, effectivePhotoURL]);

  const handleToggleLike = useCallback(async (comment: NewsComment) => {
    if (!user) return;
    const hasLiked = comment.likedBy.includes(user.id);
    setComments((prev) =>
      prev.map((c) =>
        c.id !== comment.id ? c : {
          ...c,
          likeCount: hasLiked ? c.likeCount - 1 : c.likeCount + 1,
          likedBy: hasLiked
            ? c.likedBy.filter((uid) => uid !== user.id)
            : [...c.likedBy, user.id],
        },
      ),
    );
    await likeUC.execute(comment.id, user.id, hasLiked);
  }, [user, likeUC]);

  return {
    comments: sorted,
    loading,
    collapsed,
    expandedIds,
    editingId,
    editContent,
    newContent,
    editorOpen,
    submitting,
    confirmDeleteId,
    currentUserId: user?.id ?? null,
    canModify,
    formatLikeCount,
    toggleCollapsed,
    toggleExpand,
    openEditor,
    setNewContent,
    handleSubmitNew,
    handleCancelNew,
    handleStartEdit,
    setEditContent,
    handleSaveEdit,
    handleCancelEdit,
    handleAskDelete,
    handleConfirmDelete,
    handleCancelDelete,
    handleToggleLike,
  };
};
