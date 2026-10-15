import {
  Button, DocumentsPanel, EntityListModals, Icon, InfoBanner,
  MarkdownContent, MarkdownEditor, Spinner, UserAvatar, cardActionIcon,
} from '@microteia/ui';
import { useNewsReadViewModel } from './NewsRead.viewmodel';
import { S } from './NewsRead.styles';

/**
 * Reading one item, in four files: this one renders, `NewsRead.viewmodel.tsx` holds the state and the
 * writes, `NewsRead.styles.tsx` holds the styles and `NewsRead.rules.ts` holds what a test can call.
 *
 * The thread order is the clearest case for the split: "most liked first, newest among equals" is one
 * function of two arguments, and it used to be reachable only by opening a discussion and reading it.
 */
export default function NewsReadView({ tabKey }) {
  const vm = useNewsReadViewModel(tabKey);

  if (vm.screenMissing) {
    return (
      <S.Missing>
        <InfoBanner message={vm.t('view.screen-missing')} variant="warning" />
      </S.Missing>
    );
  }

  if (vm.notFound) return <S.NotFound>{vm.t('read.not-found')}</S.NotFound>;

  const record = vm.record;
  const article = vm.article;

  const renderComment = (comment) => {
    const it = vm.commentOf(comment);

    if (it.isConfirming) {
      return (
        <S.ConfirmBox key={comment.id}>
          <S.ConfirmText>{vm.t('comment.delete.confirm')}</S.ConfirmText>
          <S.RowEnd>
            <Button variant="secondary" size="sm" onClick={vm.cancelDelete}>
              {vm.t('core.ui/action.cancel')}
            </Button>
            <Button variant="danger" size="sm" onClick={vm.removeComment}>
              {vm.t('core.ui/action.delete')}
            </Button>
          </S.RowEnd>
        </S.ConfirmBox>
      );
    }

    return (
      <S.CommentRow key={comment.id}>
        <UserAvatar src={it.photo} name={it.author} />

        <S.CommentBody>
          <S.CommentHead>
            <S.CommentAuthor>{it.author}</S.CommentAuthor>
            <S.Timestamp>{it.when}</S.Timestamp>
            {comment.updatedByName ? (
              <S.EditedBadge title={it.editedTitle}>{vm.t('comment.edited')}</S.EditedBadge>
            ) : null}
          </S.CommentHead>

          {it.isEditing ? (
            <S.EditBlock>
              <MarkdownEditor
                value={vm.editContent}
                onChange={vm.setEditContent}
                placeholder={vm.t('comment.edit.placeholder')}
              />
              <S.RowEnd>
                <Button variant="secondary" size="sm" onClick={vm.cancelEdit}>
                  {vm.t('core.ui/action.cancel')}
                </Button>
                <Button size="sm" onClick={vm.saveEdit} disabled={vm.submitting || !vm.editContent.trim()}>
                  {vm.t('core.ui/action.save')}
                </Button>
              </S.RowEnd>
            </S.EditBlock>
          ) : (
            <>
              <S.ContentArea $clamped={it.truncatable && !it.expanded}>
                <MarkdownContent>{it.content}</MarkdownContent>
              </S.ContentArea>
              {it.truncatable ? (
                <S.ReadMoreBtn onClick={() => vm.toggleExpanded(comment.id)}>
                  {it.expanded ? vm.t('comment.read-less') : vm.t('comment.read-more')}
                </S.ReadMoreBtn>
              ) : null}
            </>
          )}
        </S.CommentBody>

        {it.isEditing ? null : (
          <S.CommentActions>
            {it.canModify ? (
              <>
                <S.CommentIconBtn title={vm.t('comment.action.edit')} onClick={() => vm.startEdit(comment)}>
                  <Icon name="edit" size={15} />
                </S.CommentIconBtn>
                <S.CommentIconBtn
                  $danger
                  title={vm.t('comment.action.delete')}
                  onClick={() => vm.askDelete(comment)}
                >
                  <Icon name="deleteBin" size={15} />
                </S.CommentIconBtn>
              </>
            ) : null}
            <S.LikeBtn
              $liked={it.liked}
              onClick={() => vm.toggleCommentLike(comment)}
              title={it.liked ? vm.t('comment.action.unlike') : vm.t('comment.action.like')}
            >
              <Icon name="thumbUp" size={14} />
              {it.likesLabel}
            </S.LikeBtn>
          </S.CommentActions>
        )}
      </S.CommentRow>
    );
  };

  return (
    <>
      <S.Root>
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'news'} onClick={() => vm.showTab('news')}>
            {vm.t('read.tab.news')}
          </S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.showTab('documents')}>
            {vm.t('read.tab.documents')}
          </S.TabBtn>
        </S.TabBar>

        {vm.activeTab === 'news' ? (
          <>
            <S.Article>
              <S.CardBody>
                <S.AvatarColumn>
                  <UserAvatar src={article.photo} name={article.author} size={52} />
                  <S.AuthorName title={article.authorTitle}>{article.author}</S.AuthorName>
                </S.AvatarColumn>

                <S.ContentColumn>
                  <S.TitleRow>
                    <S.Title>{record.title}</S.Title>
                    {article.canEdit ? (
                      <S.ActionBtn onClick={vm.openEdit} title={vm.t('read.edit')}>
                        <Icon name="edit" size={16} />
                      </S.ActionBtn>
                    ) : null}
                    {article.actions.map((action) => (
                      <S.ActionBtn key={action.key} onClick={action.onClick} title={action.title} disabled={action.disabled}>
                        {action.active === undefined
                          ? cardActionIcon(action, 16)
                          : <S.ToggleIcon $on={action.active}>{cardActionIcon(action, 16)}</S.ToggleIcon>}
                      </S.ActionBtn>
                    ))}
                  </S.TitleRow>

                  <S.MetaChips>
                    <S.CategoryBadge>{article.category}</S.CategoryBadge>
                    <S.DateText>{article.when}</S.DateText>
                  </S.MetaChips>

                  {record.updatedByName ? (
                    <S.EditedMeta>
                      {vm.t('read.edited-meta', { name: record.updatedByName, when: article.editedWhen })}
                    </S.EditedMeta>
                  ) : null}

                  {article.tags.length > 0 ? (
                    <S.TagsRow>
                      {article.tags.map((tag) => <S.TagPill key={tag.id} $color={tag.color}>{tag.name}</S.TagPill>)}
                    </S.TagsRow>
                  ) : null}

                  <S.Divider />

                  <S.Summary>{record.summary}</S.Summary>

                  {record.content ? (
                    <>
                      <S.Divider />
                      <S.ContentWrapper><MarkdownContent>{record.content}</MarkdownContent></S.ContentWrapper>
                    </>
                  ) : null}

                  {record.sourceURL ? (
                    <S.SourceLink href={record.sourceURL} target="_blank" rel="noopener noreferrer">
                      <Icon name="fileText" size={14} />
                      {vm.t('read.source')}
                    </S.SourceLink>
                  ) : null}

                  <S.StatsRow>
                    <S.StatItem
                      $active={article.hasLiked}
                      onClick={vm.toggleLike}
                      title={article.hasLiked ? vm.t('read.action.unlike') : vm.t('read.action.like')}
                    >
                      <Icon name="heart" size={16} />
                      {vm.t('read.likes', { count: article.likes })}
                    </S.StatItem>
                    <S.StatItem disabled title={vm.t('read.action.views')}>
                      <Icon name="eye" size={16} />
                      {vm.t('read.views', { count: article.views })}
                    </S.StatItem>
                    {article.isRead ? (
                      <S.StatItem onClick={vm.markAsUnread} title={vm.t('read.action.mark-unread')}>
                        <Icon name="mailOpen" size={16} />
                        {vm.t('read.action.mark-unread')}
                      </S.StatItem>
                    ) : null}
                    <S.SaveBtn
                      $active={article.isSaved}
                      onClick={vm.toggleSaved}
                      title={article.isSaved ? vm.t('read.action.unsave') : vm.t('read.action.save')}
                    >
                      <Icon name="bookmark" size={16} />
                      {article.isSaved ? vm.t('read.action.saved') : vm.t('read.action.save')}
                    </S.SaveBtn>
                  </S.StatsRow>
                </S.ContentColumn>
              </S.CardBody>
            </S.Article>

            <S.CommentsCard>
              <S.CommentsHeader>
                <S.CommentsTitle>
                  <S.TitleIcon><Icon name="chat3" size={18} /></S.TitleIcon>
                  {vm.t('comments.title')}
                  {vm.comments.count > 0 ? <S.Count>{vm.comments.count}</S.Count> : null}
                </S.CommentsTitle>
                {vm.comments.count > 0 ? (
                  <S.CollapseBtn onClick={vm.comments.toggleCollapsed}>
                    {vm.comments.collapsed ? vm.t('comments.expand') : vm.t('comments.collapse')}
                  </S.CollapseBtn>
                ) : null}
              </S.CommentsHeader>

              {vm.comments.isLoading ? (
                <S.Empty><Spinner size={24} /></S.Empty>
              ) : (
                <>
                  {vm.comments.collapsed ? null : (
                    vm.comments.count === 0 ? (
                      <S.Empty>{vm.t('comments.empty')}</S.Empty>
                    ) : (
                      <S.CommentList>{vm.comments.items.map(renderComment)}</S.CommentList>
                    )
                  )}

                  {vm.editorOpen ? (
                    <S.EditorRow>
                      <S.EditorAvatar><Icon name="chat3" size={16} /></S.EditorAvatar>
                      <S.EditorBody>
                        <MarkdownEditor
                          value={vm.newContent}
                          onChange={vm.setNewContent}
                          placeholder={vm.t('comments.placeholder')}
                        />
                        <S.RowEnd>
                          <Button variant="secondary" onClick={vm.closeEditor}>
                            {vm.t('core.ui/action.cancel')}
                          </Button>
                          <Button onClick={vm.submitComment} disabled={vm.submitting || !vm.newContent.trim()}>
                            {vm.t('comments.submit')}
                          </Button>
                        </S.RowEnd>
                      </S.EditorBody>
                    </S.EditorRow>
                  ) : (
                    <S.EditorRow>
                      <S.EditorAvatar><Icon name="chat3" size={16} /></S.EditorAvatar>
                      <S.EditorTrigger onClick={vm.openEditor}>{vm.t('comments.trigger')}</S.EditorTrigger>
                    </S.EditorRow>
                  )}
                </>
              )}
            </S.CommentsCard>
          </>
        ) : (
          <DocumentsPanel
            controller={vm.docs}
            canDelete={vm.canDeleteDocuments}
            canManageTypes={vm.canManageDocumentTypes}
          />
        )}
      </S.Root>

      <EntityListModals vm={vm.list} />
    </>
  );
}
