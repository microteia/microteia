import React from 'react';
import { MarkdownContent } from '../MarkdownContent';
import {
  RiChat3Line,
  RiArrowUpSLine,
  RiArrowDownSLine,
  RiEdit2Line,
  RiDeleteBinLine,
  RiThumbUpLine,
  RiThumbUpFill,
} from 'react-icons/ri';
import {
  useNewsCommentsViewModel,
  CONTENT_TRUNCATE_THRESHOLD,
} from './NewsComments.viewmodel';
import type { NewsCommentsProps } from './NewsComments.viewmodel';
import { S } from './NewsComments.styles';
import { MarkdownEditor } from '../MarkdownEditor';
import { Button } from '../Button';
import { Spinner } from '../Spinner';
import { UserAvatar } from '../UserAvatar';

const formatDate = (date: Date): string =>
  date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

const formatDateTime = (date: Date): string =>
  date.toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

export const NewsComments: React.FC<NewsCommentsProps> = (props) => {
  const vm = useNewsCommentsViewModel(props);

  return (
    <S.Card>
      <S.Header>
        <S.Title>
          <S.TitleIcon><RiChat3Line size={18} /></S.TitleIcon>
          Comentários
          {vm.comments.length > 0 && (
            <S.Count>{vm.comments.length}</S.Count>
          )}
        </S.Title>
        {vm.comments.length > 0 && (
          <S.CollapseBtn onClick={vm.toggleCollapsed}>
            {vm.collapsed
              ? <><RiArrowDownSLine size={14} /> Expandir</>
              : <><RiArrowUpSLine size={14} /> Recolher</>
            }
          </S.CollapseBtn>
        )}
      </S.Header>

      {vm.loading ? (
        <S.Empty><Spinner size={24} /></S.Empty>
      ) : (
        <>
          {!vm.collapsed && (
            vm.comments.length === 0 ? (
              <S.Empty>Nenhum comentário ainda. Seja o primeiro a comentar.</S.Empty>
            ) : (
              <S.List>
                {vm.comments.map((comment) => {
                  const isEditing     = vm.editingId === comment.id;
                  const isConfirming  = vm.confirmDeleteId === comment.id;
                  const isTruncatable = comment.content.length > CONTENT_TRUNCATE_THRESHOLD;
                  const isExpanded    = vm.expandedIds.has(comment.id);
                  const isLiked       = !!vm.currentUserId && comment.likedBy.includes(vm.currentUserId);
                  const canMod        = vm.canModify(comment);

                  return (
                    <S.CommentWrapper key={comment.id}>
                      {isConfirming ? (
                        <S.ConfirmBox>
                          <S.ConfirmText>Excluir este comentário?</S.ConfirmText>
                          <S.ConfirmBtns>
                            <Button variant="secondary" size="sm" onClick={vm.handleCancelDelete}>
                              Cancelar
                            </Button>
                            <Button variant="danger" size="sm" onClick={vm.handleConfirmDelete}>
                              Excluir
                            </Button>
                          </S.ConfirmBtns>
                        </S.ConfirmBox>
                      ) : (
                        <S.CommentRow>
                          <UserAvatar src={comment.authorPhotoURL} name={comment.authorName} />

                          <S.Body>
                            <S.CommentHead>
                              <S.AuthorName>{comment.authorName}</S.AuthorName>
                              <S.Timestamp>{formatDate(comment.createdAt)}</S.Timestamp>
                              {comment.editedAt && (
                                <S.EditedBadge>
                                  (editado)
                                  <S.EditedTooltip>
                                    Editado por {comment.editedByName} em {formatDateTime(comment.editedAt)}
                                  </S.EditedTooltip>
                                </S.EditedBadge>
                              )}
                            </S.CommentHead>

                            {isEditing ? (
                              <S.EditBlock>
                                <MarkdownEditor
                                  value={vm.editContent}
                                  onChange={vm.setEditContent}
                                  placeholder="Editar comentário..."
                                />
                                <S.EditActions>
                                  <Button variant="secondary" size="sm" onClick={vm.handleCancelEdit}>
                                    Cancelar
                                  </Button>
                                  <Button
                                    size="sm"
                                    onClick={vm.handleSaveEdit}
                                    disabled={vm.submitting || !vm.editContent.trim()}
                                  >
                                    Salvar
                                  </Button>
                                </S.EditActions>
                              </S.EditBlock>
                            ) : (
                              <>
                                <S.ContentArea $clamped={isTruncatable && !isExpanded}>
                                  <MarkdownContent>{comment.content}</MarkdownContent>
                                </S.ContentArea>
                                {isTruncatable && (
                                  <S.ReadMoreBtn onClick={() => vm.toggleExpand(comment.id)}>
                                    {isExpanded ? 'menos ▲' : 'mais... ▼'}
                                  </S.ReadMoreBtn>
                                )}
                              </>
                            )}
                          </S.Body>

                          {!isEditing && (
                            <S.CommentActions>
                              {canMod && (
                                <>
                                  <S.ActionBtn
                                    title="Editar comentário"
                                    onClick={() => vm.handleStartEdit(comment)}
                                  >
                                    <RiEdit2Line size={15} />
                                  </S.ActionBtn>
                                  <S.DeleteActionBtn
                                    title="Excluir comentário"
                                    onClick={() => vm.handleAskDelete(comment.id)}
                                  >
                                    <RiDeleteBinLine size={15} />
                                  </S.DeleteActionBtn>
                                </>
                              )}
                              <S.LikeBtn
                                $liked={isLiked}
                                onClick={() => vm.handleToggleLike(comment)}
                                title={isLiked ? 'Remover curtida' : 'Curtir'}
                              >
                                {isLiked ? <RiThumbUpFill size={14} /> : <RiThumbUpLine size={14} />}
                                {comment.likeCount > 0 && vm.formatLikeCount(comment.likeCount)}
                              </S.LikeBtn>
                            </S.CommentActions>
                          )}
                        </S.CommentRow>
                      )}
                    </S.CommentWrapper>
                  );
                })}
              </S.List>
            )
          )}

          {vm.editorOpen ? (
            <S.EditorRow>
              <S.Avatar>
                <RiChat3Line size={16} />
              </S.Avatar>
              <S.EditorBody>
                <MarkdownEditor
                  value={vm.newContent}
                  onChange={vm.setNewContent}
                  placeholder="Escreva um comentário em Markdown..."
                />
                <S.EditorActions>
                  <Button variant="secondary" onClick={vm.handleCancelNew}>
                    Cancelar
                  </Button>
                  <Button
                    onClick={vm.handleSubmitNew}
                    disabled={vm.submitting || !vm.newContent.trim()}
                  >
                    Comentar
                  </Button>
                </S.EditorActions>
              </S.EditorBody>
            </S.EditorRow>
          ) : (
            <S.EditorTriggerRow>
              <S.Avatar>
                <RiChat3Line size={16} />
              </S.Avatar>
              <S.EditorTrigger onClick={vm.openEditor}>
                Adicionar um comentário...
              </S.EditorTrigger>
            </S.EditorTriggerRow>
          )}
        </>
      )}
    </S.Card>
  );
};
