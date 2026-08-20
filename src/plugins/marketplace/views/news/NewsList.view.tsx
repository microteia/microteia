import { useMemo } from 'react';
import { styled } from 'styled-components';
import { Dropdown, EntityListModals, EntityListView, Icon, InfoBanner, UserAvatar, cardActionIcon } from '@microteia/ui';
import { useCurrentUser, useEntity, useEntityList, useLookup, useNotify, useUpdateRecord, useWorkspace } from '@microteia/data';
import { useLocaleFormat, useT } from '@microteia/i18n';

const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';
const READ_TAB_PREFIX = 'news-read:';

const Card = styled.article`
  background: ${({ theme }) => theme.colors.surface};
  border: 1px solid ${({ theme }) => theme.colors.border};
  border-left-width: 3px;
  border-left-color: ${({ $isRead, theme }) => ($isRead ? theme.colors.border : theme.colors.primary)};
  border-radius: ${({ theme }) => theme.borderRadius.md};
  padding: ${({ theme }) => theme.spacing.md};
  opacity: ${({ $isRead }) => ($isRead ? 0.75 : 1)};
  transition: opacity ${({ theme }) => theme.transitions.fast},
              box-shadow ${({ theme }) => theme.transitions.fast},
              border-left-color ${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    box-shadow: 0 2px 8px ${({ theme }) => theme.colors.shadow};
    opacity: 1;
  }
`;

const CardBody = styled.div`
  display: flex;
  align-items: flex-start;
  gap: ${({ theme }) => theme.spacing.md};
`;

const AvatarColumn = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 44px;
  flex-shrink: 0;
`;

const AuthorName = styled.span`
  font-size: 10px;
  font-weight: 500;
  color: ${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  line-height: 1.3;
  width: 44px;
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
  gap: ${({ theme }) => theme.spacing.sm};
`;

const TitleLine = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: ${({ theme }) => theme.spacing.sm};
`;

const Title = styled.h3`
  font-size: ${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: ${({ theme }) => theme.colors.text};
  margin: 0;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  word-break: break-word;
`;

const DateText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  flex-shrink: 0;
`;

const MetaRow = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
`;

const MetaSpacer = styled.span`
  flex: 1;
`;

const CategoryBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  letter-spacing: 0.03em;
`;

const UnreadBadge = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: ${({ theme }) => theme.colors.primaryLight};
  color: ${({ theme }) => theme.colors.primary};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  border: 1px solid ${({ theme }) => theme.colors.primary};
`;

const EditedText = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  line-height: 1.3;
`;

const Summary = styled.p`
  font-size: ${({ theme }) => theme.fontSizes.sm};
  color: ${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
`;

const TagsRow = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const TagPill = styled.span`
  font-size: ${({ theme }) => theme.fontSizes.xs};
  background: ${({ $color }) => $color}33;
  color: ${({ $color }) => $color};
  border-radius: ${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  font-weight: 500;
`;

const FooterRow = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: ${({ theme }) => theme.spacing.xs};
  padding-top: ${({ theme }) => theme.spacing.xs};
  border-top: 1px solid ${({ theme }) => theme.colors.border};
`;

const Stats = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.md};
`;

const StatItem = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  transition: color ${({ theme }) => theme.transitions.fast};

  &:hover { color: ${({ theme }) => theme.colors.primary}; }
`;

const StatDisplay = styled.span`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: ${({ theme }) => theme.fontSizes.xs};
  color: ${({ theme }) => theme.colors.textMuted};
  padding: 2px 4px;
`;

const Actions = styled.div`
  display: flex;
  align-items: center;
  gap: ${({ theme }) => theme.spacing.xs};
`;

const IconBtn = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: ${({ theme }) => theme.borderRadius.sm};
  border: none;
  background: none;
  cursor: pointer;
  color: ${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  transition: color ${({ theme }) => theme.transitions.fast},
              background ${({ theme }) => theme.transitions.fast};

  &:hover {
    background: ${({ theme }) => theme.colors.surfaceHover};
    color: ${({ theme }) => theme.colors.primary};
  }
`;

// A counter is ROUND with one digit and becomes a pill with two. Equal height and min-width, with the
// text centred by flex itself: in a span of running text the vertical spacing does not push the box
// out, and the dot comes out squashed.
const HeaderCount = styled.span`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  border-radius: ${({ theme }) => theme.borderRadius.full};
  background: ${({ theme }) => theme.colors.danger};
  color: ${({ theme }) => theme.colors.white};
  font-size: ${({ theme }) => theme.fontSizes.xs};
  font-weight: 700;
  line-height: 1;
`;

/**
 * The value as a Date, for the locale formatter to render. Formatting used to happen here, with
 * `toLocaleString('pt-BR', ...)` written into the view — a whole language nailed into a date.
 */
const asDate = (value) => {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(String(value));
  return isNaN(date.getTime()) ? null : date;
};

const listOf = (value) => (Array.isArray(value) ? value : []);
const has = (value, id) => !!id && listOf(value).indexOf(id) !== -1;
const without = (value, id) => listOf(value).filter((item) => item !== id);
const withValue = (value, id) => (has(value, id) ? listOf(value) : listOf(value).concat([id]));

// The useful view for whoever opens the noticeboard is what they have not read yet.
const UNREAD_TOKENS = [{ key: 'readStatus', values: ['UNREAD'] }];

export default function NewsListView() {
  const t = useT('com.microteia.news');
  const { formatDateTime } = useLocaleFormat();
  const me = useCurrentUser();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: UNREAD_TOKENS });
  const comments = useEntity(COMMENT_SOURCE_ID);
  const categories = useLookup('newsCategories');
  const updateRecord = useUpdateRecord();
  const notify = useNotify();
  const { openTab } = useWorkspace();

  // The collection is the one the SCREEN resolves, not a fixed name: the install may disambiguate the
  // key, and a write addressed to the wrong collection fails silently.
  const collection = list.collection;

  const patch = (record, data) => {
    void updateRecord(collection, record.id, data).catch(() => {
      notify(t('view.write-denied'), 'error');
    });
  };

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

  // Reading status is not a field, it is the relation between the item and whoever is looking — which
  // is why it resolves here and not in the filter derived from the schema.
  const records = useMemo(() => {
    if (readStatus.length === 0) return list.filteredRecords;
    return list.filteredRecords.filter((record) => readStatus.some((status) => {
      if (status === 'UNREAD') return !has(record.readBy, me.id);
      if (status === 'READ') return has(record.readBy, me.id);
      if (status === 'SAVED') return has(record.savedBy, me.id);
      return false;
    }));
  }, [list.filteredRecords, readStatus, me.id]);

  const commentCounts = useMemo(() => {
    const counts = {};
    for (const comment of comments.records) {
      const key = comment.newsId;
      if (key) counts[key] = (counts[key] || 0) + 1;
    }
    return counts;
  }, [comments.records]);

  const unreadCount = useMemo(
    () => list.records.filter((record) => !has(record.readBy, me.id) && record.createdBy !== me.id).length,
    [list.records, me.id],
  );

  const tagsById = useMemo(() => {
    const index = {};
    for (const tag of list.tags) index[tag.id] = tag;
    return index;
  }, [list.tags]);

  if (!list.definition) {
    return (
      <div style={{ padding: '24px' }}>
        <InfoBanner message={t('view.screen-missing')} variant="warning" />
      </div>
    );
  }

  const categoryLabel = (record) => {
    const option = categories.find((item) => item.key === record.category);
    return option ? option.label : record.category || t('category.general');
  };

  const toggleLike = (record) => patch(record, {
    likedBy: has(record.likedBy, me.id) ? without(record.likedBy, me.id) : withValue(record.likedBy, me.id),
  });

  const toggleSaved = (record) => patch(record, {
    savedBy: has(record.savedBy, me.id) ? without(record.savedBy, me.id) : withValue(record.savedBy, me.id),
  });

  const markAsUnread = (record) => patch(record, {
    readBy: without(record.readBy, me.id),
  });

  const openRead = (record) => openTab(READ_TAB_PREFIX + record.id);

  const renderCard = (record) => {
    const isRead = has(record.readBy, me.id);
    const isSaved = has(record.savedBy, me.id);
    const hasLiked = has(record.likedBy, me.id);
    const tags = listOf(record.tagIds).map((id) => tagsById[id]).filter(Boolean);
    const actions = list.getCardActions(record);
    const canEdit = record.createdBy === me.id || me.tenantRole === 'admin';

    const handleCardClick = (event) => {
      if (event.target.closest('button')) return;
      openRead(record);
    };

    return (
      <Card key={record.id} $isRead={isRead} onClick={handleCardClick}>
        <CardBody>
          <AvatarColumn>
            <UserAvatar src={record.createdByPhotoURL || null} name={record.createdByName || t('view.author')} size={40} />
            <AuthorName>{record.createdByName || t('view.author')}</AuthorName>
          </AvatarColumn>

          <ContentColumn>
            <TitleLine>
              <Title>{record.title}</Title>
              <DateText>{formatDateTime(asDate(record.updatedByName ? record.updatedAt : record.createdAt))}</DateText>
            </TitleLine>

            <MetaRow>
              <CategoryBadge>{categoryLabel(record)}</CategoryBadge>
              <MetaSpacer />
              {isRead ? null : <UnreadBadge>{t('list.badge.unread')}</UnreadBadge>}
            </MetaRow>

            {record.updatedByName ? (
              <EditedText>
                {t('list.edited-by', { name: record.updatedByName, when: formatDateTime(asDate(record.updatedAt)) })}
              </EditedText>
            ) : null}

            {tags.length > 0 ? (
              <TagsRow>
                {tags.map((tag) => <TagPill key={tag.id} $color={tag.color}>{tag.name}</TagPill>)}
              </TagsRow>
            ) : null}

            <Summary>{record.summary}</Summary>

            <FooterRow>
              <Stats>
                <StatItem $active={hasLiked} onClick={() => toggleLike(record)} title={t('list.action.like')}>
                  <Icon name="heart" size={14} />
                  {listOf(record.likedBy).length}
                </StatItem>
                <StatDisplay title={t('list.action.views')}>
                  <Icon name="eye" size={14} />
                  {record.viewCount || 0}
                </StatDisplay>
                <StatItem onClick={() => openRead(record)} title={t('list.action.comments')}>
                  <Icon name="chat3" size={14} />
                  {commentCounts[record.id] || 0}
                </StatItem>
              </Stats>

              <Actions>
                <IconBtn
                  $active={isSaved}
                  onClick={() => toggleSaved(record)}
                  title={isSaved ? t('list.action.unsave') : t('list.action.save')}
                >
                  <Icon name="bookmark" size={15} />
                </IconBtn>
                {isRead ? (
                  <IconBtn onClick={() => markAsUnread(record)} title={t('list.action.mark-unread')}>
                    <Icon name="mailOpen" size={15} />
                  </IconBtn>
                ) : null}
                {canEdit ? (
                  <IconBtn onClick={() => list.openRecord(record)} title={t('core.ui/action.edit')}>
                    <Icon name="edit" size={15} />
                  </IconBtn>
                ) : null}
                {actions.length > 0 ? (
                  <Dropdown
                    align="right"
                    trigger={<IconBtn title={t('list.action.more')}><Icon name="more" size={15} /></IconBtn>}
                    items={actions.map((action) => ({
                      id: action.key,
                      label: action.title,
                      icon: cardActionIcon(action),
                      variant: action.danger ? 'danger' : 'default',
                      onClick: action.onClick,
                    }))}
                  />
                ) : null}
              </Actions>
            </FooterRow>
          </ContentColumn>
        </CardBody>
      </Card>
    );
  };

  return (
    <EntityListView
      title={list.definition.titlePlural}
      titleIcon={<Icon name="newspaper" size={22} />}
      layout="list"
      onNew={list.openNewRecord}
      newTitle={t('list.new')}
      titleExtra={unreadCount > 0 ? <HeaderCount>{unreadCount}</HeaderCount> : null}
      filterDefs={filterDefs}
      filterTokens={list.filterTokens}
      onFilterChange={list.setFilterTokens}
      filterPlaceholder={t('list.filter.placeholder')}
      savedFiltersScreenKey={list.savedFiltersScreenKey}
      isLoading={list.isLoading && list.records.length === 0}
      isEmpty={records.length === 0}
      emptyIcon={<Icon name="newspaper" size={32} />}
      emptyTitle={t('list.empty')}
      emptyActionLabel={t('list.new')}
      modals={<EntityListModals vm={list} />}
    >
      {records.map(renderCard)}
    </EntityListView>
  );
}
