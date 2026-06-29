import React from 'react';
import {
  RiHeart3Line, RiHeart3Fill, RiEyeLine,
  RiBookmarkLine, RiBookmarkFill, RiExternalLinkLine, RiEditLine,
  RiLinkM, RiCheckLine,
} from 'react-icons/ri';
import { useViewNewsViewModel } from './ViewNews.viewmodel';
import { S } from './ViewNews.styles';
import { TagManager } from '../../components/ui/TagManager';
import { TagIconButton } from '../../components/ui/TagIconButton';
import { NewsComments } from '../../components/ui/NewsComments';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { UserAvatar } from '../../components/ui/UserAvatar';

function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const ViewNewsView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewNewsViewModel(tabKey);

  if (!vm.news) {
    return <S.NotFound>Notícia não encontrada.</S.NotFound>;
  }

  const n = vm.news;
  const isSystemNews = n.tenantId === null;

  return (
    <>
      {vm.tagManagerOpen && (
        <TagManager
          entityId={n.id}
          onClose={vm.closeTagManager}
          adapter={vm.tagAdapter}
        />
      )}
      <S.Root>
      <S.Card>
        <S.CardBody>
          {n.authorName && (
            <S.AvatarColumn>
              <UserAvatar src={n.authorPhotoURL ?? null} name={n.authorName} size={52} />
              <S.AuthorName title={n.authorName}>{n.authorName}</S.AuthorName>
            </S.AvatarColumn>
          )}

          <S.ContentColumn>
            <S.TitleRow>
              <S.Title>{n.title}</S.Title>
              {vm.canEdit && (
                <S.ActionBtn onClick={vm.handleEdit} title="Editar notícia">
                  <RiEditLine size={16} />
                </S.ActionBtn>
              )}
              <S.ActionBtn onClick={vm.handleCopyDeepLink} title={vm.copyLinkDone ? 'Link copiado!' : 'Copiar link'}>
                {vm.copyLinkDone ? <RiCheckLine size={16} /> : <RiLinkM size={16} />}
              </S.ActionBtn>
              <TagIconButton onClick={vm.openTagManager} />
            </S.TitleRow>

            <S.MetaChips>
              <S.CategoryBadge>{vm.getCategoryLabel(n.category)}</S.CategoryBadge>
              {isSystemNews && <S.SystemBadge>Sistema</S.SystemBadge>}
              <S.DateText>{formatDateTime(n.editedAt ?? n.createdAt)}</S.DateText>
            </S.MetaChips>

            {n.editedAt && (
              <S.EditedMeta>
                editado por {n.editedByName ?? 'desconhecido'} · publicado em {formatDateTime(n.createdAt)}
              </S.EditedMeta>
            )}

            {vm.appliedTags.length > 0 && (
              <S.TagsRow>
                {vm.appliedTags.map((tag) => (
                  <S.TagPill key={tag.id} $color={tag.color}>{tag.name}</S.TagPill>
                ))}
              </S.TagsRow>
            )}

            <S.Divider />

            <S.Summary>{n.summary}</S.Summary>

            {n.content && (
              <>
                <S.Divider />
                <S.ContentWrapper>
                  <MarkdownContent>{n.content}</MarkdownContent>
                </S.ContentWrapper>
              </>
            )}

            {n.sourceURL && (
              <S.SourceLink href={n.sourceURL} target="_blank" rel="noopener noreferrer">
                <RiExternalLinkLine size={14} />
                Ver fonte original
              </S.SourceLink>
            )}

            <S.StatsRow>
              <S.StatItem
                $active={vm.hasLiked}
                onClick={vm.handleToggleLike}
                title={vm.hasLiked ? 'Descurtir' : 'Curtir'}
              >
                {vm.hasLiked ? <RiHeart3Fill size={16} /> : <RiHeart3Line size={16} />}
                {n.likeCount} {n.likeCount === 1 ? 'curtida' : 'curtidas'}
              </S.StatItem>
              <S.StatItem disabled title="Visualizações">
                <RiEyeLine size={16} />
                {n.viewCount} {n.viewCount === 1 ? 'visualização' : 'visualizações'}
              </S.StatItem>
              <S.SaveBtn
                $active={vm.savedForLater}
                onClick={vm.handleToggleSaved}
                title={vm.savedForLater ? 'Remover dos salvos' : 'Salvar para depois'}
              >
                {vm.savedForLater ? <RiBookmarkFill size={16} /> : <RiBookmarkLine size={16} />}
                {vm.savedForLater ? 'Salvo' : 'Salvar para depois'}
              </S.SaveBtn>
            </S.StatsRow>
          </S.ContentColumn>
        </S.CardBody>
      </S.Card>

      <NewsComments newsId={n.id} />
    </S.Root>
    </>
  );
};
