import {
  Dropdown, EntityListModals, EntityListView, Icon, InfoBanner, UserAvatar, cardActionIcon,
} from '@microteia/ui';
import { useNewsListViewModel } from './NewsList.viewmodel';
import { S } from './NewsList.styles';

/**
 * The noticeboard, in four files: this one renders, `NewsList.viewmodel.tsx` holds the state and the
 * writes, `NewsList.styles.tsx` holds the styles and `NewsList.rules.ts` holds what a test can call.
 *
 * Nothing here asks who is reading. Whether an item is read, saved or liked by THIS person is decided
 * in the view model, over a rule that a test exercises without a screen — which matters because the
 * answer differs per reader and looks right from whichever account happens to be open.
 */
export default function NewsListView() {
  const vm = useNewsListViewModel();

  if (vm.screenMissing) {
    return (
      <S.Missing>
        <InfoBanner message={vm.t('view.screen-missing')} variant="warning" />
      </S.Missing>
    );
  }

  const renderCard = (record) => {
    const card = vm.cardOf(record);

    return (
      <S.Card key={record.id} $isRead={card.isRead} onClick={(event) => vm.cardClick(event, record)}>
        <S.CardBody>
          <S.AvatarColumn>
            <UserAvatar src={card.photo} name={card.author} size={40} />
            <S.AuthorName>{card.author}</S.AuthorName>
          </S.AvatarColumn>

          <S.ContentColumn>
            <S.TitleLine>
              <S.Title>{record.title}</S.Title>
              <S.DateText>{card.when}</S.DateText>
            </S.TitleLine>

            <S.MetaRow>
              <S.CategoryBadge>{card.category}</S.CategoryBadge>
              <S.MetaSpacer />
              {card.isRead ? null : <S.UnreadBadge>{vm.t('list.badge.unread')}</S.UnreadBadge>}
            </S.MetaRow>

            {record.updatedByName ? (
              <S.EditedText>
                {vm.t('list.edited-by', { name: record.updatedByName, when: card.editedWhen })}
              </S.EditedText>
            ) : null}

            {card.tags.length > 0 ? (
              <S.TagsRow>
                {card.tags.map((tag) => <S.TagPill key={tag.id} $color={tag.color}>{tag.name}</S.TagPill>)}
              </S.TagsRow>
            ) : null}

            <S.Summary>{record.summary}</S.Summary>

            <S.FooterRow>
              <S.Stats>
                <S.StatItem
                  $active={card.hasLiked}
                  onClick={() => vm.toggleLike(record)}
                  title={vm.t('list.action.like')}
                >
                  <Icon name="heart" size={14} />
                  {card.likes}
                </S.StatItem>
                <S.StatDisplay title={vm.t('list.action.views')}>
                  <Icon name="eye" size={14} />
                  {card.views}
                </S.StatDisplay>
                <S.StatItem onClick={() => vm.openRead(record)} title={vm.t('list.action.comments')}>
                  <Icon name="chat3" size={14} />
                  {card.comments}
                </S.StatItem>
              </S.Stats>

              <S.Actions>
                <S.IconBtn
                  $active={card.isSaved}
                  onClick={() => vm.toggleSaved(record)}
                  title={card.isSaved ? vm.t('list.action.unsave') : vm.t('list.action.save')}
                >
                  <Icon name="bookmark" size={15} />
                </S.IconBtn>
                {card.isRead ? (
                  <S.IconBtn onClick={() => vm.markAsUnread(record)} title={vm.t('list.action.mark-unread')}>
                    <Icon name="mailOpen" size={15} />
                  </S.IconBtn>
                ) : null}
                {card.canEdit ? (
                  <S.IconBtn onClick={() => vm.openEdit(record)} title={vm.t('core.ui/action.edit')}>
                    <Icon name="edit" size={15} />
                  </S.IconBtn>
                ) : null}
                {card.actions.length > 0 ? (
                  <Dropdown
                    align="right"
                    trigger={<S.IconBtn title={vm.t('list.action.more')}><Icon name="more" size={15} /></S.IconBtn>}
                    items={card.actions.map((action) => ({
                      id: action.key,
                      label: action.title,
                      icon: cardActionIcon(action),
                      variant: action.danger ? 'danger' : 'default',
                      onClick: action.onClick,
                    }))}
                  />
                ) : null}
              </S.Actions>
            </S.FooterRow>
          </S.ContentColumn>
        </S.CardBody>
      </S.Card>
    );
  };

  return (
    <EntityListView
      title={vm.title}
      titleIcon={<Icon name="newspaper" size={22} />}
      layout="list"
      onNew={vm.openNew}
      newTitle={vm.t('list.new')}
      titleExtra={vm.unreadCount > 0 ? <S.HeaderCount>{vm.unreadCount}</S.HeaderCount> : null}
      filterDefs={vm.filter.defs}
      filterTokens={vm.filter.tokens}
      onFilterChange={vm.filter.onChange}
      filterPlaceholder={vm.t('list.filter.placeholder')}
      savedFiltersScreenKey={vm.filter.screenKey}
      isLoading={vm.isLoading}
      isEmpty={vm.records.length === 0}
      emptyIcon={<Icon name="newspaper" size={32} />}
      emptyTitle={vm.t('list.empty')}
      emptyActionLabel={vm.t('list.new')}
      modals={<EntityListModals vm={vm.list} />}
    >
      {vm.records.map(renderCard)}
    </EntityListView>
  );
}
