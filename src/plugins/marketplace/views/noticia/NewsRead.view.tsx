import { useEffect, useMemo, useState } from 'react';
import { styled } from 'styled-components';
import {
  Button, DocumentsPanel, EntityListModals, Icon, InfoBanner,
  MarkdownContent, MarkdownEditor, Spinner, UserAvatar, cardActionIcon,
} from '@microteia/ui';
import {
  useCreateRecord, useCurrentUser, useDeleteRecord, useEntity, useEntityList,
  useLookup, useNotify, useRecordDocuments, useUpdateRecord, useWorkspace,
} from '@microteia/data';

const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';
const READ_TAB_PREFIX = 'news-read:';
const TRUNCATE = 500;

const Root = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  max-width: 860px;
  margin: 0 auto;
`;

const NotFound = styled.div`
  padding: ${({ theme }) => theme.spacing.xl};
  color: ${({ theme }) => theme.colors.textMuted};
  text-align: center;
`;

const TabBar = styled.div`
  display: flex;
  border-bottom: 1px solid ${({ theme }) => theme.colors.border};
  flex-shrink: 0;
`;

const TabBtn = styled.button`
  padding: ${({ theme }) => theme.spacing.md} ${({ theme }) => theme.spacing.lg};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  color: ${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  border-bottom: 2px solid ${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  transition: ${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  &:hover { color: ${({ theme }) => theme.colors.text}; }
`;

const Article = styled.article`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
`;

const CardBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.lg};
`;

const AvatarColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 56px;
  flex-shrink: 0;
`;

const AuthorName = styled.span`
  font-size: 11px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
`;

const ContentColumn = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const TitleRow = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h1`
  font-size: ${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
`;

const ActionBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme }) => theme.colors.textMuted};
  transition: color ${({ theme }) => theme.transitions.fast},
              background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

const MetaChips = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const CategoryBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 3px 10px;
  letter-spacing: 0.04em;
`;

const DateText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const EditedMeta = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
  margin-top: ${({ theme }) => theme.spacing.xs};
`;

const TagPill = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ $color }) => $color}33;
  color: ${({ $color }) => $color};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  font-weight: 500;
`;

const Divider = styled.hr`
  border: none;
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  margin: 0;
  width: 100%;
`;

const Summary = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  line-height: 1.7;
  margin: 0;
  font-style: italic;
`;

const ContentWrapper = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.8;
`;

const SourceLink = styled.a`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.primary};
  text-decoration: none;
  &:hover { text-decoration: underline; }
`;

const StatsRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.lg};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
  flex-wrap: wrap;
`;

const StatItem = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover { color: ${({ theme }) => theme.colors.primary}; }
  &:disabled { cursor: default; }
`;

const SaveBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme, $active }) => ($active ? theme.colors.secondary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  margin-left: auto;
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover { color: ${({ theme }) => theme.colors.secondary}; }
`;

const CommentsCard = styled.div`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.lg};
  padding: ${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.md};
`;

const CommentsHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const CommentsTitle = styled.h3`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const TitleIcon = styled.span`
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
`;

const Count = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 700;
`;

const CollapseBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textSecondary};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${({ theme }) => theme.colors.surfaceHover}; }
`;

const Empty = styled.div`
  text-align: center;
  padding: ${({ theme }) => theme.spacing.lg};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
`;

const CommentList = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ConfirmBox = styled.div`
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ConfirmText = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
`;

const RowEnd = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.sm};
  justify-content: flex-end;
`;

const CommentRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding: ${({ theme }) => theme.spacing.sm};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  transition: background ${({ theme }) => theme.transitions.fast};

  &:hover { background: ${({ theme }) => theme.colors.background}; }
`;

const CommentBody = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
`;

const CommentHead = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const CommentAuthor = styled.span`
  font-weight: 600;
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
`;

const Timestamp = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
`;

const EditedBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: help;
`;

const EditBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const ContentArea = styled.div`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.text};
  line-height: 1.6;
  overflow: hidden;
  display: ${({ $clamped }) => ($clamped ? '-webkit-box' : 'block')};
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
`;

const ReadMoreBtn = styled.button`
  background: none;
  border: none;
  padding: 0;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.primary};
  cursor: pointer;
  margin-top: 4px;
  align-self: flex-start;

  &:hover { text-decoration: underline; }
`;

const CommentActions = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
`;

const CommentIconBtn = styled.button`
  background: none;
  border: none;
  padding: 4px;
  color: ${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  transition: color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.text)};
    background: ${({ theme, $danger }) => ($danger ? theme.colors.dangerLight : theme.colors.surfaceHover)};
  }
`;

const LikeBtn = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 4px 6px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ $liked, theme }) => ($liked ? theme.colors.primary : theme.colors.textMuted)};
  cursor: pointer;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &:hover {
    color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.primaryLight};
  }
`;

const EditorRow = styled.div`
  display: flex;
  gap: ${({ theme }) => theme.spacing.md};
  padding-top: ${({ theme }) => theme.spacing.sm};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const EditorAvatar = styled.div`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
`;

const EditorBody = styled.div`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const EditorTrigger = styled.button`
  flex: 1;
  padding: 10px 14px;
  background: ${({ theme }) => theme.colors.background};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  color: ${({ theme }) => theme.colors.textMuted};
  font-size: ${({ theme }) => theme.fontSizes.sm};
  text-align: left;
  cursor: pointer;
  transition: border-color ${({ theme }) => theme.transitions.fast}, background ${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: ${({ theme }) => theme.colors.primary};
    background: ${({ theme }) => theme.colors.surfaceHover};
  }
`;

const listOf = (value) => (Array.isArray(value) ? value : []);
const has = (value, id) => !!id && listOf(value).indexOf(id) !== -1;
const without = (value, id) => listOf(value).filter((item) => item !== id);
const withValue = (value, id) => (has(value, id) ? listOf(value) : listOf(value).concat([id]));

const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

const longStamp = (value) => {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const shortStamp = (value) => {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });
};

const stamp = (value) => {
  const date = asDate(value);
  if (!date) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const formatLikes = (count) => {
  if (count < 1000) return String(count);
  const k = count / 1000;
  return k % 1 === 0 ? k + 'k' : k.toFixed(1) + 'k';
};

export default function NewsReadView({ tabKey }) {
  const newsId = String(tabKey || '').slice(READ_TAB_PREFIX.length);
  const me = useCurrentUser();
  const list = useEntityList(SOURCE_ID);
  const comments = useEntity(COMMENT_SOURCE_ID);
  const categories = useLookup('newsCategories');
  const createRecord = useCreateRecord();
  const updateRecord = useUpdateRecord();
  const deleteRecord = useDeleteRecord();
  const notify = useNotify();
  const { setTabTitle } = useWorkspace();

  // A coleção é a que a TELA resolve, e não um nome fixo — ver a listagem.
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
  const threadComments = useMemo(() => {
    const found = comments.records.filter((item) => item.newsId === newsId);
    return found.sort((a, b) => {
      const likes = listOf(b.likedBy).length - listOf(a.likedBy).length;
      if (likes !== 0) return likes;
      const at = asDate(a.createdAt);
      const bt = asDate(b.createdAt);
      return (bt ? bt.getTime() : 0) - (at ? at.getTime() : 0);
    });
  }, [comments.records, newsId]);

  useEffect(() => {
    if (record) setTabTitle(tabKey, record.title);
  }, [record, tabKey, setTabTitle]);

  // Abrir É ler: a leitura entra no vetor do próprio documento e o selo do menu desce sozinho, porque
  // ele conta com uma expressão sobre este mesmo campo.
  //
  // A marca é UMA VEZ por abertura, e não "sempre que a notícia não estiver lida": sem a trava,
  // "marcar como não lida" tirava o id do vetor e este mesmo efeito o repunha no render seguinte —
  // o botão parecia não fazer nada e o selo não voltava.
  useEffect(() => {
    if (!record || !me.id || readMarked) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- a trava É o efeito: ver o comentário acima
    setReadMarked(true);
    if (has(record.readBy, me.id)) return;
    void updateRecord(collection, record.id, {
      readBy: withValue(record.readBy, me.id),
      viewCount: (record.viewCount || 0) + 1,
    }).catch(() => {
      // Marcar como lida é gravação no documento de OUTRA pessoa. Se ela for recusada, o selo do
      // menu não desce — e um selo que não desce sem explicação é pior do que o aviso.
      notify('Não foi possível registrar a leitura desta notícia.', 'error');
    });
  }, [record, me.id, readMarked, collection, updateRecord, notify]);

  if (!list.definition) {
    return (
      <div style={{ padding: '24px' }}>
        <InfoBanner message='Tela "Notícias" não encontrada. Instale a extensão para ativá-la.' variant="warning" />
      </div>
    );
  }

  if (!record) return <NotFound>Notícia não encontrada.</NotFound>;

  const isSaved = has(record.savedBy, me.id);
  const hasLiked = has(record.likedBy, me.id);
  const isRead = has(record.readBy, me.id);
  const canEdit = record.createdBy === me.id || me.tenantRole === 'admin';
  const likeCount = listOf(record.likedBy).length;
  const viewCount = record.viewCount || 0;
  const categoryOption = categories.find((item) => item.key === record.category);
  const tags = listOf(record.tagIds)
    .map((id) => list.tags.find((tag) => tag.id === id))
    .filter(Boolean);
  const actions = list.getCardActions(record);

  const patch = (data) => updateRecord(collection, record.id, data).catch(() => {
    notify('Não foi possível gravar. Verifique se você tem permissão neste escritório.', 'error');
  });

  const toggleLike = () => patch({
    likedBy: hasLiked ? without(record.likedBy, me.id) : withValue(record.likedBy, me.id),
  });

  const toggleSaved = () => patch({
    savedBy: isSaved ? without(record.savedBy, me.id) : withValue(record.savedBy, me.id),
  });

  const markAsUnread = () => patch({
    readBy: without(record.readBy, me.id),
  });

  // Comentar, editar e excluir um comentário devolvem a notícia à caixa de todos: o vetor de leitura
  // fica só com quem acabou de mexer. É o que a coleção de interações fazia com uma escrita por
  // usuário, e aqui é uma só.
  const reopenForEveryone = () => patch({ readBy: [me.id] });

  const submitComment = async () => {
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
  };

  const saveEdit = async () => {
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
  };

  const removeComment = async () => {
    if (!confirmDeleteId) return;
    try {
      await deleteRecord(commentCollection, confirmDeleteId);
      await reopenForEveryone();
    } finally {
      setConfirmDeleteId(null);
    }
  };

  const toggleCommentLike = (comment) => updateRecord(commentCollection, comment.id, {
    likedBy: has(comment.likedBy, me.id)
      ? without(comment.likedBy, me.id)
      : withValue(comment.likedBy, me.id),
  });

  const toggleExpanded = (id) => setExpandedIds((prev) => {
    const next = Object.assign({}, prev);
    next[id] = !next[id];
    return next;
  });

  const renderComment = (comment) => {
    const isEditing = editingId === comment.id;
    const isConfirming = confirmDeleteId === comment.id;
    const content = String(comment.content || '');
    const truncatable = content.length > TRUNCATE;
    const expanded = !!expandedIds[comment.id];
    const liked = has(comment.likedBy, me.id);
    const canModify = comment.createdBy === me.id || me.role === 'SYSTEM' || me.tenantRole === 'admin';

    if (isConfirming) {
      return (
        <ConfirmBox key={comment.id}>
          <ConfirmText>Excluir este comentário?</ConfirmText>
          <RowEnd>
            <Button variant="secondary" size="sm" onClick={() => setConfirmDeleteId(null)}>Cancelar</Button>
            <Button variant="danger" size="sm" onClick={removeComment}>Excluir</Button>
          </RowEnd>
        </ConfirmBox>
      );
    }

    return (
      <CommentRow key={comment.id}>
        <UserAvatar src={comment.createdByPhotoURL || null} name={comment.createdByName || 'Autor'} />

        <CommentBody>
          <CommentHead>
            <CommentAuthor>{comment.createdByName || 'Autor'}</CommentAuthor>
            <Timestamp>{shortStamp(comment.createdAt)}</Timestamp>
            {comment.updatedByName ? (
              <EditedBadge title={'Editado por ' + comment.updatedByName + ' em ' + stamp(comment.updatedAt)}>
                (editado)
              </EditedBadge>
            ) : null}
          </CommentHead>

          {isEditing ? (
            <EditBlock>
              <MarkdownEditor value={editContent} onChange={setEditContent} placeholder="Editar comentário..." />
              <RowEnd>
                <Button variant="secondary" size="sm" onClick={() => { setEditingId(null); setEditContent(''); }}>
                  Cancelar
                </Button>
                <Button size="sm" onClick={saveEdit} disabled={submitting || !editContent.trim()}>Salvar</Button>
              </RowEnd>
            </EditBlock>
          ) : (
            <>
              <ContentArea $clamped={truncatable && !expanded}>
                <MarkdownContent>{content}</MarkdownContent>
              </ContentArea>
              {truncatable ? (
                <ReadMoreBtn onClick={() => toggleExpanded(comment.id)}>
                  {expanded ? 'menos ▲' : 'mais... ▼'}
                </ReadMoreBtn>
              ) : null}
            </>
          )}
        </CommentBody>

        {isEditing ? null : (
          <CommentActions>
            {canModify ? (
              <>
                <CommentIconBtn
                  title="Editar comentário"
                  onClick={() => { setEditingId(comment.id); setEditContent(content); }}
                >
                  <Icon name="edit" size={15} />
                </CommentIconBtn>
                <CommentIconBtn $danger title="Excluir comentário" onClick={() => setConfirmDeleteId(comment.id)}>
                  <Icon name="deleteBin" size={15} />
                </CommentIconBtn>
              </>
            ) : null}
            <LikeBtn
              $liked={liked}
              onClick={() => toggleCommentLike(comment)}
              title={liked ? 'Remover curtida' : 'Curtir'}
            >
              <Icon name="thumbUp" size={14} />
              {listOf(comment.likedBy).length > 0 ? formatLikes(listOf(comment.likedBy).length) : null}
            </LikeBtn>
          </CommentActions>
        )}
      </CommentRow>
    );
  };

  return (
    <>
      <Root>
        <TabBar>
          <TabBtn $active={activeTab === 'news'} onClick={() => setActiveTab('news')}>Notícia</TabBtn>
          <TabBtn $active={activeTab === 'documents'} onClick={() => setActiveTab('documents')}>Documentos</TabBtn>
        </TabBar>

        {activeTab === 'news' ? (
          <>
            <Article>
              <CardBody>
                <AvatarColumn>
                  <UserAvatar src={record.createdByPhotoURL || null} name={record.createdByName || 'Autor'} size={52} />
                  <AuthorName title={record.createdByName}>{record.createdByName || 'Autor'}</AuthorName>
                </AvatarColumn>

                <ContentColumn>
                  <TitleRow>
                    <Title>{record.title}</Title>
                    {canEdit ? (
                      <ActionBtn onClick={() => list.openRecord(record)} title="Editar notícia">
                        <Icon name="edit" size={16} />
                      </ActionBtn>
                    ) : null}
                    {actions.map((action) => (
                      <ActionBtn key={action.key} onClick={action.onClick} title={action.title}>
                        {cardActionIcon(action, 16)}
                      </ActionBtn>
                    ))}
                  </TitleRow>

                  <MetaChips>
                    <CategoryBadge>{categoryOption ? categoryOption.label : (record.category || 'Geral')}</CategoryBadge>
                    <DateText>{longStamp(record.updatedByName ? record.updatedAt : record.createdAt)}</DateText>
                  </MetaChips>

                  {record.updatedByName ? (
                    <EditedMeta>
                      editado por {record.updatedByName} · publicado em {longStamp(record.createdAt)}
                    </EditedMeta>
                  ) : null}

                  {tags.length > 0 ? (
                    <TagsRow>
                      {tags.map((tag) => <TagPill key={tag.id} $color={tag.color}>{tag.name}</TagPill>)}
                    </TagsRow>
                  ) : null}

                  <Divider />

                  <Summary>{record.summary}</Summary>

                  {record.content ? (
                    <>
                      <Divider />
                      <ContentWrapper><MarkdownContent>{record.content}</MarkdownContent></ContentWrapper>
                    </>
                  ) : null}

                  {record.sourceURL ? (
                    <SourceLink href={record.sourceURL} target="_blank" rel="noopener noreferrer">
                      <Icon name="fileText" size={14} />
                      Ver fonte original
                    </SourceLink>
                  ) : null}

                  <StatsRow>
                    <StatItem $active={hasLiked} onClick={toggleLike} title={hasLiked ? 'Descurtir' : 'Curtir'}>
                      <Icon name="heart" size={16} />
                      {likeCount} {likeCount === 1 ? 'curtida' : 'curtidas'}
                    </StatItem>
                    <StatItem disabled title="Visualizações">
                      <Icon name="eye" size={16} />
                      {viewCount} {viewCount === 1 ? 'visualização' : 'visualizações'}
                    </StatItem>
                    {isRead ? (
                      <StatItem onClick={markAsUnread} title="Marcar como não lida">
                        <Icon name="mailOpen" size={16} />
                        Marcar como não lida
                      </StatItem>
                    ) : null}
                    <SaveBtn
                      $active={isSaved}
                      onClick={toggleSaved}
                      title={isSaved ? 'Remover dos salvos' : 'Salvar para depois'}
                    >
                      <Icon name="bookmark" size={16} />
                      {isSaved ? 'Salvo' : 'Salvar para depois'}
                    </SaveBtn>
                  </StatsRow>
                </ContentColumn>
              </CardBody>
            </Article>

            <CommentsCard>
              <CommentsHeader>
                <CommentsTitle>
                  <TitleIcon><Icon name="chat3" size={18} /></TitleIcon>
                  Comentários
                  {threadComments.length > 0 ? <Count>{threadComments.length}</Count> : null}
                </CommentsTitle>
                {threadComments.length > 0 ? (
                  <CollapseBtn onClick={() => setCollapsed(!collapsed)}>
                    {collapsed ? 'Expandir' : 'Recolher'}
                  </CollapseBtn>
                ) : null}
              </CommentsHeader>

              {comments.isLoading ? (
                <Empty><Spinner size={24} /></Empty>
              ) : (
                <>
                  {collapsed ? null : (
                    threadComments.length === 0 ? (
                      <Empty>Nenhum comentário ainda. Seja o primeiro a comentar.</Empty>
                    ) : (
                      <CommentList>{threadComments.map(renderComment)}</CommentList>
                    )
                  )}

                  {editorOpen ? (
                    <EditorRow>
                      <EditorAvatar><Icon name="chat3" size={16} /></EditorAvatar>
                      <EditorBody>
                        <MarkdownEditor
                          value={newContent}
                          onChange={setNewContent}
                          placeholder="Escreva um comentário em Markdown..."
                        />
                        <RowEnd>
                          <Button variant="secondary" onClick={() => { setEditorOpen(false); setNewContent(''); }}>
                            Cancelar
                          </Button>
                          <Button onClick={submitComment} disabled={submitting || !newContent.trim()}>
                            Comentar
                          </Button>
                        </RowEnd>
                      </EditorBody>
                    </EditorRow>
                  ) : (
                    <EditorRow>
                      <EditorAvatar><Icon name="chat3" size={16} /></EditorAvatar>
                      <EditorTrigger onClick={() => setEditorOpen(true)}>
                        Adicionar um comentário...
                      </EditorTrigger>
                    </EditorRow>
                  )}
                </>
              )}
            </CommentsCard>
          </>
        ) : (
          <DocumentsPanel controller={docs} isAdmin={me.tenantRole === 'admin'} />
        )}
      </Root>

      <EntityListModals vm={list} />
    </>
  );
}
