import { useMemo } from 'react';
import { styled } from 'styled-components';
import { Dropdown, EntityListModals, EntityListView, Icon, InfoBanner, UserAvatar, cardActionIcon } from '@microteia/ui';
import { useCurrentUser, useEntity, useEntityList, useLookup, useNotify, useUpdateRecord, useWorkspace } from '@microteia/data';

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

// Um contador é REDONDO com um dígito e vira pílula com dois. Altura e largura mínima iguais, com o
// texto centrado pelo próprio flex: num span de texto corrido o espaçamento vertical não empurra a
// caixa, e a bolinha sai achatada.
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

const stamp = (value) => {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(String(value));
  if (isNaN(date.getTime())) return '';
  return date.toLocaleString('pt-BR', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
};

const listOf = (value) => (Array.isArray(value) ? value : []);
const has = (value, id) => !!id && listOf(value).indexOf(id) !== -1;
const without = (value, id) => listOf(value).filter((item) => item !== id);
const withValue = (value, id) => (has(value, id) ? listOf(value) : listOf(value).concat([id]));

// A visão útil de quem abre o mural é o que ainda não leu.
const NAO_LIDAS = [{ key: 'readStatus', values: ['UNREAD'] }];

const READ_FILTER = {
  key: 'readStatus',
  label: 'Status de leitura',
  type: 'select',
  options: [
    { value: 'UNREAD', label: 'Não lidas' },
    { value: 'READ', label: 'Lidas' },
    { value: 'SAVED', label: 'Salvos para depois' },
  ],
};

export default function NewsListView() {
  const me = useCurrentUser();
  const list = useEntityList(SOURCE_ID, { defaultFilterTokens: NAO_LIDAS });
  const comments = useEntity(COMMENT_SOURCE_ID);
  const categories = useLookup('newsCategories');
  const updateRecord = useUpdateRecord();
  const notify = useNotify();
  const { openTab } = useWorkspace();

  // A coleção é a que a TELA resolve, e não um nome fixo: a instalação pode desambiguar a chave, e
  // uma gravação endereçada à coleção errada falha calada.
  const collection = list.collection;

  const patch = (record, data) => {
    void updateRecord(collection, record.id, data).catch(() => {
      notify('Não foi possível gravar. Verifique se você tem permissão neste escritório.', 'error');
    });
  };

  const filterDefs = useMemo(() => list.filterDefs.concat([READ_FILTER]), [list.filterDefs]);

  const readStatus = useMemo(() => {
    const token = list.filterTokens.find((item) => item.key === 'readStatus');
    return token ? token.values : [];
  }, [list.filterTokens]);

  // O status de leitura não é campo, é a relação entre a notícia e quem está olhando — por isso ele
  // se resolve aqui, e não no filtro derivado do schema.
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
        <InfoBanner message='Tela "Notícias" não encontrada. Instale a extensão para ativá-la.' variant="warning" />
      </div>
    );
  }

  const categoryLabel = (record) => {
    const option = categories.find((item) => item.key === record.category);
    return option ? option.label : record.category || 'Geral';
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
            <UserAvatar src={record.createdByPhotoURL || null} name={record.createdByName || 'Autor'} size={40} />
            <AuthorName>{record.createdByName || 'Autor'}</AuthorName>
          </AvatarColumn>

          <ContentColumn>
            <TitleLine>
              <Title>{record.title}</Title>
              <DateText>{stamp(record.updatedByName ? record.updatedAt : record.createdAt)}</DateText>
            </TitleLine>

            <MetaRow>
              <CategoryBadge>{categoryLabel(record)}</CategoryBadge>
              <MetaSpacer />
              {isRead ? null : <UnreadBadge>Não lida</UnreadBadge>}
            </MetaRow>

            {record.updatedByName ? (
              <EditedText>editado por {record.updatedByName} · {stamp(record.updatedAt)}</EditedText>
            ) : null}

            {tags.length > 0 ? (
              <TagsRow>
                {tags.map((tag) => <TagPill key={tag.id} $color={tag.color}>{tag.name}</TagPill>)}
              </TagsRow>
            ) : null}

            <Summary>{record.summary}</Summary>

            <FooterRow>
              <Stats>
                <StatItem $active={hasLiked} onClick={() => toggleLike(record)} title="Curtir">
                  <Icon name="heart" size={14} />
                  {listOf(record.likedBy).length}
                </StatItem>
                <StatDisplay title="Visualizações">
                  <Icon name="eye" size={14} />
                  {record.viewCount || 0}
                </StatDisplay>
                <StatItem onClick={() => openRead(record)} title="Comentários">
                  <Icon name="chat3" size={14} />
                  {commentCounts[record.id] || 0}
                </StatItem>
              </Stats>

              <Actions>
                <IconBtn
                  $active={isSaved}
                  onClick={() => toggleSaved(record)}
                  title={isSaved ? 'Remover dos salvos' : 'Salvar para depois'}
                >
                  <Icon name="bookmark" size={15} />
                </IconBtn>
                {isRead ? (
                  <IconBtn onClick={() => markAsUnread(record)} title="Marcar como não lida">
                    <Icon name="mailOpen" size={15} />
                  </IconBtn>
                ) : null}
                {canEdit ? (
                  <IconBtn onClick={() => list.openRecord(record)} title="Editar">
                    <Icon name="edit" size={15} />
                  </IconBtn>
                ) : null}
                {actions.length > 0 ? (
                  <Dropdown
                    align="right"
                    trigger={<IconBtn title="Ações"><Icon name="more" size={15} /></IconBtn>}
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
      newTitle="Nova Notícia"
      titleExtra={unreadCount > 0 ? <HeaderCount>{unreadCount}</HeaderCount> : null}
      filterDefs={filterDefs}
      filterTokens={list.filterTokens}
      onFilterChange={list.setFilterTokens}
      filterPlaceholder="Filtrar notícias..."
      savedFiltersScreenKey={list.savedFiltersScreenKey}
      isLoading={list.isLoading && list.records.length === 0}
      isEmpty={records.length === 0}
      emptyIcon={<Icon name="newspaper" size={32} />}
      emptyTitle="Nenhuma notícia encontrada."
      emptyActionLabel="Nova Notícia"
      modals={<EntityListModals vm={list} />}
    >
      {records.map(renderCard)}
    </EntityListView>
  );
}
