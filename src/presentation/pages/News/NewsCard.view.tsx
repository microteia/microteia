import React from 'react';
import {
  RiHeart3Line, RiHeart3Fill, RiEyeLine, RiChat3Line,
  RiBookmarkLine, RiBookmarkFill, RiMailUnreadLine,
  RiEditLine, RiDeleteBinLine,
} from 'react-icons/ri';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { S } from './NewsCard.styles';
import type { NewsRow } from './News.viewmodel';

function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

interface NewsCardProps {
  row: NewsRow;
  onView: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onToggleLike: () => void;
  onToggleSaved: () => void;
  onMarkAsUnread: () => void;
}

export const NewsCardView: React.FC<NewsCardProps> = ({
  row, onView, onEdit, onDelete,
  onToggleLike, onToggleSaved, onMarkAsUnread,
}) => {
  const n = row.news;

  const handleCardClick = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('button')) return;
    onView();
  };

  return (
    <S.Card $isRead={row.isRead} onClick={handleCardClick}>
      <S.CardBody>
        {n.authorName && (
          <S.AvatarColumn>
            <UserAvatar src={n.authorPhotoURL ?? null} name={n.authorName} size={40} />
            <S.AuthorName>{n.authorName}</S.AuthorName>
          </S.AvatarColumn>
        )}

        <S.ContentColumn>
          <S.TitleLine>
            <S.Title>{n.title}</S.Title>
            <S.DateText>{formatDateTime(n.editedAt ?? n.createdAt)}</S.DateText>
          </S.TitleLine>

          <S.MetaRow>
            <S.CategoryBadge>{row.categoryLabel}</S.CategoryBadge>
            {row.isSystemNews && <S.SystemBadge>Sistema</S.SystemBadge>}
            <S.MetaSpacer />
            {!row.isRead && <S.UnreadBadge>Não lida</S.UnreadBadge>}
          </S.MetaRow>

          {n.editedAt && (
            <S.EditedText>
              editado por {n.editedByName ?? 'desconhecido'} · {formatDateTime(n.editedAt)}
            </S.EditedText>
          )}

          {row.appliedTags.length > 0 && (
            <S.TagsRow>
              {row.appliedTags.map((tag) => (
                <S.TagPill key={tag.id} $color={tag.color}>{tag.name}</S.TagPill>
              ))}
            </S.TagsRow>
          )}

          <S.Summary>{n.summary}</S.Summary>

          <S.FooterRow>
            <S.Stats>
              <S.StatItem $active={row.hasLiked} onClick={(e) => { e.stopPropagation(); onToggleLike(); }} title="Curtir">
                {row.hasLiked ? <RiHeart3Fill size={14} /> : <RiHeart3Line size={14} />}
                {n.likeCount}
              </S.StatItem>
              <S.StatDisplay title="Visualizações">
                <RiEyeLine size={14} />
                {n.viewCount}
              </S.StatDisplay>
              <S.StatItem onClick={(e) => { e.stopPropagation(); onView(); }} title="Comentários">
                <RiChat3Line size={14} />
                {row.commentCount}
              </S.StatItem>
            </S.Stats>

            <S.Actions>
              <S.IconBtn
                $active={row.savedForLater}
                onClick={(e) => { e.stopPropagation(); onToggleSaved(); }}
                title={row.savedForLater ? 'Remover dos salvos' : 'Salvar para depois'}
              >
                {row.savedForLater ? <RiBookmarkFill size={15} /> : <RiBookmarkLine size={15} />}
              </S.IconBtn>
              {row.isRead && (
                <S.IconBtn
                  onClick={(e) => { e.stopPropagation(); onMarkAsUnread(); }}
                  title="Marcar como não lida"
                >
                  <RiMailUnreadLine size={15} />
                </S.IconBtn>
              )}
              {row.canEdit && (
                <S.IconBtn onClick={(e) => { e.stopPropagation(); onEdit(); }} title="Editar">
                  <RiEditLine size={15} />
                </S.IconBtn>
              )}
              {row.canDelete && (
                <S.IconBtn onClick={(e) => { e.stopPropagation(); onDelete(); }} title="Excluir">
                  <RiDeleteBinLine size={15} />
                </S.IconBtn>
              )}
            </S.Actions>
          </S.FooterRow>
        </S.ContentColumn>
      </S.CardBody>
    </S.Card>
  );
};
