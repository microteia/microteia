import type {
  LookupModuleTemplate,
  MarketplacePlugin,
  ScreenModuleTemplate,
  TemplateField,
} from '../../domain/entities/MarketplacePlugin';
import type { CustomFieldOption } from '../../domain/entities';
import { nav, page } from '../contributionBuilders';

/**
 * **Notícias** — o mural do escritório declarado por extensão: o comunicado que alguém publica, quem
 * já leu, o que cada um guardou para depois e a conversa que se forma embaixo.
 *
 * É a sétima entidade a sair do kernel e a primeira em que o dado importante não é do REGISTRO, e sim
 * da relação entre o registro e QUEM está olhando. Daí as duas capacidades que nasceram com ela: o
 * `user` no escopo das expressões — que é o que faz o selo do menu contar o que EU não li — e o
 * `authorCanDelete`, que devolve por declaração o "cada um apaga o que escreveu" que só existia como
 * regra nomeada de `newsComments` no `firestore.rules`.
 *
 * **O lido/não-lido não tem coleção.** `readBy` e `savedBy` são vetores de id no próprio documento,
 * do mesmo feitio do `likedBy` que a notícia sempre teve. Sem doc por usuário, sem contador a manter:
 * o selo é uma expressão sobre o que a listagem já enxerga, e a leitura de um se resolve numa
 * gravação. O limite é o tamanho do escritório — é um vetor por notícia, não uma coleção.
 */
const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';

const READ_TAB_PREFIX = 'news-read:';

const CONTEUDO = 'Conteúdo';

/**
 * Os campos do FORMULÁRIO — os cinco que alguém preenche ao publicar. Ficam de fora, de propósito,
 * `likedBy`, `readBy`, `savedBy` e `viewCount`: são estado de leitura, escritos por um gesto (curtir,
 * abrir, guardar) e nunca digitados. Declará-los os poria no formulário e nos filtros, onde só
 * atrapalhariam — a mesma razão pela qual o corpo do e-mail não é campo na extensão de Pushes.
 */
const FIELDS: TemplateField[] = [
  { key: 'title', label: 'Título', type: 'text', required: true, order: 0, section: CONTEUDO, placeholder: 'Título da notícia...' },
  { key: 'category', label: 'Categoria', type: 'select', required: false, order: 1, section: CONTEUDO, lookupCollection: 'newsCategories', optionsAllowUserAdd: true, filterable: true },
  { key: 'sourceURL', label: 'Link da fonte', type: 'text', required: false, order: 2, section: CONTEUDO, placeholder: 'https://...' },
  { key: 'summary', label: 'Resumo', type: 'textarea', required: true, order: 3, section: CONTEUDO, placeholder: 'Resumo curto exibido na listagem...' },
  { key: 'content', label: 'Conteúdo completo', type: 'markdown', required: false, order: 4, section: CONTEUDO },
];

/**
 * O comentário é uma TELA FILHA, não uma anotação. A anotação nativa não tem edição nem curtida, e as
 * duas são metade do que um comentário é. Como tela, ele ganha de graça o que qualquer registro tem —
 * autoria carimbada, auditoria, exclusão pelo autor — e a extensão só desenha a conversa.
 */
const COMMENT_FIELDS: TemplateField[] = [
  { key: 'newsId', label: 'Notícia', type: 'reference', required: true, order: 0, refEntity: 'news' },
  { key: 'content', label: 'Comentário', type: 'markdown', required: true, order: 1 },
];

const options = (entries: [string, string][]): CustomFieldOption[] =>
  entries.map(([key, label]) => ({ key, label }));

/**
 * As categorias que o kernel trazia em `lookupDefaults`. A CHAVE segue em inglês porque é o que está
 * gravado nas notícias desde a primeira — a lista descreve o banco como ele é.
 */
const LOOKUPS: LookupModuleTemplate[] = [
  {
    collection: 'newsCategories',
    label: 'Notícia: Categoria',
    options: options([
      ['GENERAL', 'Geral'],
      ['ANNOUNCEMENT', 'Comunicado'],
      ['CIRCULAR', 'Circular'],
      ['UPDATE', 'Atualização'],
    ]),
  },
];

const TAG_LISTS: LookupModuleTemplate[] = [
  { collection: 'newsTags', label: 'Notícia: Etiquetas' },
];

const NEWS_SCREEN: ScreenModuleTemplate = {
  key: 'news',
  sourceId: SOURCE_ID,
  titleSingular: 'Notícia',
  titlePlural: 'Notícias',
  icon: 'newspaper',
  dataCollection: 'news',
  fields: FIELDS,
  titleFieldKey: 'title',
  subtitleFieldKey: 'summary',
  hasNotes: false,
  hasDocuments: true,
  hasTags: true,
  tagCollection: 'newsTags',
  eventPrefix: 'news',
  // Quem abre a notícia de FORA — a auditoria, uma menção, o ⌘K — cai na LEITURA, não no formulário.
  recordTabPrefix: READ_TAB_PREFIX,
  listActions: ['copyLink', 'manageTags', 'delete'],
  // Editar o CONTEÚDO segue a permissão padrão do escritório. O que é "por usuário" — marcar como
  // lida, curtir, guardar para depois — é gravação no documento que outra pessoa criou, e por isso
  // sai por outra porta: qualquer membro grava estes quatro campos e nada mais. Sem isso, quem tem o
  // papel `user` (somente leitura) não conseguia sequer marcar uma notícia como lida, e o selo do
  // menu ficava preso para sempre.
  writeRoles: null,
  memberWritableFields: ['readBy', 'savedBy', 'likedBy', 'viewCount'],
  // Quem publicou apaga o que publicou, sem depender de um admin.
  authorCanDelete: true,
  // O item de menu é declarado à parte, para levar o selo.
  hideFromSidebar: true,
  sidebarOrder: 90,
};

const COMMENTS_SCREEN: ScreenModuleTemplate = {
  key: 'newsComments',
  sourceId: COMMENT_SOURCE_ID,
  titleSingular: 'Comentário',
  titlePlural: 'Comentários',
  icon: 'chat3',
  fields: COMMENT_FIELDS,
  titleFieldKey: 'content',
  hasNotes: false,
  hasDocuments: false,
  hasTags: false,
  parentEntity: 'news',
  parentFieldKey: 'newsId',
  parentRelation: 'owned',
  // A conversa se lê EMBAIXO da notícia, na tela de leitura. Como aba do formulário de edição seria
  // a mesma coisa duas vezes — e no lugar em que ninguém a procura.
  hideFromParentTabs: true,
  listActions: ['delete'],
  // Num mural, comentar é de TODO MUNDO — inclusive de quem só lê o resto do escritório. É o que a
  // regra nomeada de `newsComments` dizia (qualquer autenticado cria o próprio comentário), e aqui a
  // lista declarada ALARGA a permissão padrão em vez de estreitá-la.
  writeRoles: ['admin', 'lawyer', 'secretary', 'user'],
  authorCanDelete: true,
  hideFromSidebar: true,
};

/**
 * A LISTAGEM. Não usa a superfície padrão de cartões: o cartão de uma notícia é uma peça de leitura —
 * autor à esquerda, título, resumo e a linha de convívio embaixo (curtidas, visualizações,
 * comentários) —, e não um resumo de cadastro. O que vem do padrão é a moldura (`EntityListView` em
 * `layout="list"`, porque o cartão quer a largura inteira), os filtros derivados dos campos, os
 * modais e as AÇÕES: o que aparece no cartão continua governado pelo Form Design.
 *
 * O filtro "Status de leitura" é o único que a extensão acrescenta à mão, e tem de ser: ele não olha
 * um campo, olha a relação entre a notícia e quem está lendo a tela.
 */
const NEWS_LIST_SOURCE = `
import { useMemo } from 'react';
import { styled } from 'styled-components';
import { Dropdown, EntityListModals, EntityListView, Icon, InfoBanner, UserAvatar, cardActionIcon } from '@microteia/ui';
import { useCurrentUser, useEntity, useEntityList, useLookup, useNotify, useUpdateRecord, useWorkspace } from '@microteia/data';

const SOURCE_ID = 'microteia:news';
const COMMENT_SOURCE_ID = 'microteia:news-comment';
const READ_TAB_PREFIX = 'news-read:';

const Card = styled.article\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-left-width: 3px;
  border-left-color: \${({ $isRead, theme }) => ($isRead ? theme.colors.border : theme.colors.primary)};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  padding: \${({ theme }) => theme.spacing.md};
  opacity: \${({ $isRead }) => ($isRead ? 0.75 : 1)};
  transition: opacity \${({ theme }) => theme.transitions.fast},
              box-shadow \${({ theme }) => theme.transitions.fast},
              border-left-color \${({ theme }) => theme.transitions.fast};
  cursor: pointer;

  &:hover {
    box-shadow: 0 2px 8px \${({ theme }) => theme.colors.shadow};
    opacity: 1;
  }
\`;

const CardBody = styled.div\`
  display: flex;
  align-items: flex-start;
  gap: \${({ theme }) => theme.spacing.md};
\`;

const AvatarColumn = styled.div\`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  width: 44px;
  flex-shrink: 0;
\`;

const AuthorName = styled.span\`
  font-size: 10px;
  font-weight: 500;
  color: \${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  line-height: 1.3;
  width: 44px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
\`;

const ContentColumn = styled.div\`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const TitleLine = styled.div\`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Title = styled.h3\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
  margin: 0;
  line-height: 1.4;
  flex: 1;
  min-width: 0;
  word-break: break-word;
\`;

const DateText = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  white-space: nowrap;
  flex-shrink: 0;
\`;

const MetaRow = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
\`;

const MetaSpacer = styled.span\`
  flex: 1;
\`;

const CategoryBadge = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: \${({ theme }) => theme.colors.primaryLight};
  color: \${({ theme }) => theme.colors.primary};
  border-radius: \${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  letter-spacing: 0.03em;
\`;

const UnreadBadge = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: \${({ theme }) => theme.colors.primaryLight};
  color: \${({ theme }) => theme.colors.primary};
  border-radius: \${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  border: 1px solid \${({ theme }) => theme.colors.primary};
\`;

const EditedText = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-style: italic;
  line-height: 1.3;
\`;

const Summary = styled.p\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.textSecondary};
  margin: 0;
  line-height: 1.6;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
\`;

const TagsRow = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: \${({ theme }) => theme.spacing.xs};
\`;

const TagPill = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  background: \${({ $color }) => $color}33;
  color: \${({ $color }) => $color};
  border-radius: \${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  font-weight: 500;
\`;

const FooterRow = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: \${({ theme }) => theme.spacing.xs};
  padding-top: \${({ theme }) => theme.spacing.xs};
  border-top: 1px solid \${({ theme }) => theme.colors.border};
\`;

const Stats = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.md};
\`;

const StatItem = styled.button\`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  transition: color \${({ theme }) => theme.transitions.fast};

  &:hover { color: \${({ theme }) => theme.colors.primary}; }
\`;

const StatDisplay = styled.span\`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  padding: 2px 4px;
\`;

const Actions = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.xs};
\`;

const IconBtn = styled.button\`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  border: none;
  background: none;
  cursor: pointer;
  color: \${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  transition: color \${({ theme }) => theme.transitions.fast},
              background \${({ theme }) => theme.transitions.fast};

  &:hover {
    background: \${({ theme }) => theme.colors.surfaceHover};
    color: \${({ theme }) => theme.colors.primary};
  }
\`;

const HeaderCount = styled.span\`
  background: \${({ theme }) => theme.colors.danger};
  color: \${({ theme }) => theme.colors.white};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 700;
  border-radius: \${({ theme }) => theme.borderRadius.full};
  padding: 2px 7px;
  min-width: 20px;
  text-align: center;
\`;

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
`;

/**
 * A LEITURA. É a tela que a declaração não alcança: uma notícia não se lê num formulário — se lê como
 * artigo, com o autor ao lado, o conteúdo em Markdown e a conversa embaixo. Editar continua sendo o
 * formulário NATIVO (`list.openRecord`), que o schema descreve inteiro; aqui só mora o que é leitura.
 *
 * Os comentários são registros da tela filha, montados à mão porque a conversa tem forma própria —
 * curtida, edição com marca de "(editado)", recolher e "mais...". Quem grava, exclui e carimba a
 * autoria é o mesmo caminho de qualquer registro; a extensão não conhece repositório nenhum.
 */
const NEWS_READ_SOURCE = `
import { useEffect, useMemo, useState } from 'react';
import { styled } from 'styled-components';
import {
  Button, DocumentsPanel, Dropdown, EntityListModals, Icon, InfoBanner,
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

const Root = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.lg};
  padding: \${({ theme }) => theme.spacing.lg};
  max-width: 860px;
  margin: 0 auto;
\`;

const NotFound = styled.div\`
  padding: \${({ theme }) => theme.spacing.xl};
  color: \${({ theme }) => theme.colors.textMuted};
  text-align: center;
\`;

const TabBar = styled.div\`
  display: flex;
  border-bottom: 1px solid \${({ theme }) => theme.colors.border};
  flex-shrink: 0;
\`;

const TabBtn = styled.button\`
  padding: \${({ theme }) => theme.spacing.md} \${({ theme }) => theme.spacing.lg};
  font-size: \${({ theme }) => theme.fontSizes.sm};
  font-weight: 500;
  background: none;
  border: none;
  cursor: pointer;
  color: \${({ $active, theme }) => ($active ? theme.colors.primary : theme.colors.textSecondary)};
  border-bottom: 2px solid \${({ $active, theme }) => ($active ? theme.colors.primary : 'transparent')};
  transition: \${({ theme }) => theme.transitions.fast};
  white-space: nowrap;

  &:hover { color: \${({ theme }) => theme.colors.text}; }
\`;

const Article = styled.article\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
  padding: \${({ theme }) => theme.spacing.lg};
\`;

const CardBody = styled.div\`
  display: flex;
  align-items: flex-start;
  gap: \${({ theme }) => theme.spacing.lg};
\`;

const AvatarColumn = styled.div\`
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  width: 56px;
  flex-shrink: 0;
\`;

const AuthorName = styled.span\`
  font-size: 11px;
  font-weight: 500;
  color: \${({ theme }) => theme.colors.textSecondary};
  text-align: center;
  width: 56px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  display: block;
\`;

const ContentColumn = styled.div\`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.md};
\`;

const TitleRow = styled.div\`
  display: flex;
  align-items: flex-start;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const Title = styled.h1\`
  font-size: \${({ theme }) => theme.fontSizes['2xl']};
  font-weight: 700;
  color: \${({ theme }) => theme.colors.text};
  margin: 0;
  line-height: 1.3;
  flex: 1;
  min-width: 0;
\`;

const ActionBtn = styled.button\`
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  flex-shrink: 0;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  border: none;
  background: none;
  cursor: pointer;
  color: \${({ theme }) => theme.colors.textMuted};
  transition: color \${({ theme }) => theme.transitions.fast},
              background \${({ theme }) => theme.transitions.fast};

  &:hover {
    background: \${({ theme }) => theme.colors.surfaceHover};
    color: \${({ theme }) => theme.colors.primary};
  }
\`;

const MetaChips = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
\`;

const CategoryBadge = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 600;
  background: \${({ theme }) => theme.colors.primaryLight};
  color: \${({ theme }) => theme.colors.primary};
  border-radius: \${({ theme }) => theme.borderRadius.full};
  padding: 3px 10px;
  letter-spacing: 0.04em;
\`;

const DateText = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const EditedMeta = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  font-style: italic;
\`;

const TagsRow = styled.div\`
  display: flex;
  flex-wrap: wrap;
  gap: \${({ theme }) => theme.spacing.xs};
  margin-top: \${({ theme }) => theme.spacing.xs};
\`;

const TagPill = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  background: \${({ $color }) => $color}33;
  color: \${({ $color }) => $color};
  border-radius: \${({ theme }) => theme.borderRadius.full};
  padding: 2px 8px;
  font-weight: 500;
\`;

const Divider = styled.hr\`
  border: none;
  border-top: 1px solid \${({ theme }) => theme.colors.border};
  margin: 0;
  width: 100%;
\`;

const Summary = styled.p\`
  font-size: \${({ theme }) => theme.fontSizes.md};
  color: \${({ theme }) => theme.colors.textSecondary};
  line-height: 1.7;
  margin: 0;
  font-style: italic;
\`;

const ContentWrapper = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.text};
  line-height: 1.8;
\`;

const SourceLink = styled.a\`
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.primary};
  text-decoration: none;
  &:hover { text-decoration: underline; }
\`;

const StatsRow = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.lg};
  padding-top: \${({ theme }) => theme.spacing.sm};
  border-top: 1px solid \${({ theme }) => theme.colors.border};
  flex-wrap: wrap;
\`;

const StatItem = styled.button\`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme, $active }) => ($active ? theme.colors.primary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  transition: color \${({ theme }) => theme.transitions.fast};

  &:hover { color: \${({ theme }) => theme.colors.primary}; }
  &:disabled { cursor: default; }
\`;

const SaveBtn = styled.button\`
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme, $active }) => ($active ? theme.colors.secondary : theme.colors.textMuted)};
  background: none;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  margin-left: auto;
  transition: color \${({ theme }) => theme.transitions.fast};

  &:hover { color: \${({ theme }) => theme.colors.secondary}; }
\`;

const CommentsCard = styled.div\`
  background: \${({ theme }) => theme.colors.surface};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.lg};
  padding: \${({ theme }) => theme.spacing.lg};
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.md};
\`;

const CommentsHeader = styled.div\`
  display: flex;
  align-items: center;
  justify-content: space-between;
\`;

const CommentsTitle = styled.h3\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  font-size: \${({ theme }) => theme.fontSizes.md};
  font-weight: 600;
  color: \${({ theme }) => theme.colors.text};
  margin: 0;
\`;

const TitleIcon = styled.span\`
  color: \${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
\`;

const Count = styled.span\`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 20px;
  padding: 0 6px;
  background: \${({ theme }) => theme.colors.primaryLight};
  color: \${({ theme }) => theme.colors.primary};
  border-radius: \${({ theme }) => theme.borderRadius.full};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  font-weight: 700;
\`;

const CollapseBtn = styled.button\`
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 4px 10px;
  background: transparent;
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  color: \${({ theme }) => theme.colors.textSecondary};
  font-size: \${({ theme }) => theme.fontSizes.xs};
  cursor: pointer;
  transition: background \${({ theme }) => theme.transitions.fast};

  &:hover { background: \${({ theme }) => theme.colors.surfaceHover}; }
\`;

const Empty = styled.div\`
  text-align: center;
  padding: \${({ theme }) => theme.spacing.lg};
  color: \${({ theme }) => theme.colors.textMuted};
  font-size: \${({ theme }) => theme.fontSizes.sm};
\`;

const CommentList = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const ConfirmBox = styled.div\`
  background: \${({ theme }) => theme.colors.background};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  padding: \${({ theme }) => theme.spacing.md};
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const ConfirmText = styled.p\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.text};
  margin: 0;
\`;

const RowEnd = styled.div\`
  display: flex;
  gap: \${({ theme }) => theme.spacing.sm};
  justify-content: flex-end;
\`;

const CommentRow = styled.div\`
  display: flex;
  gap: \${({ theme }) => theme.spacing.md};
  padding: \${({ theme }) => theme.spacing.sm};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  transition: background \${({ theme }) => theme.transitions.fast};

  &:hover { background: \${({ theme }) => theme.colors.background}; }
\`;

const CommentBody = styled.div\`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
\`;

const CommentHead = styled.div\`
  display: flex;
  align-items: center;
  gap: \${({ theme }) => theme.spacing.sm};
  flex-wrap: wrap;
\`;

const CommentAuthor = styled.span\`
  font-weight: 600;
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.text};
\`;

const Timestamp = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
\`;

const EditedBadge = styled.span\`
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.textMuted};
  cursor: help;
\`;

const EditBlock = styled.div\`
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const ContentArea = styled.div\`
  font-size: \${({ theme }) => theme.fontSizes.sm};
  color: \${({ theme }) => theme.colors.text};
  line-height: 1.6;
  overflow: hidden;
  display: \${({ $clamped }) => ($clamped ? '-webkit-box' : 'block')};
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
\`;

const ReadMoreBtn = styled.button\`
  background: none;
  border: none;
  padding: 0;
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ theme }) => theme.colors.primary};
  cursor: pointer;
  margin-top: 4px;
  align-self: flex-start;

  &:hover { text-decoration: underline; }
\`;

const CommentActions = styled.div\`
  display: flex;
  align-items: center;
  gap: 4px;
  flex-shrink: 0;
\`;

const CommentIconBtn = styled.button\`
  background: none;
  border: none;
  padding: 4px;
  color: \${({ theme }) => theme.colors.textMuted};
  cursor: pointer;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  display: flex;
  align-items: center;
  transition: color \${({ theme }) => theme.transitions.fast}, background \${({ theme }) => theme.transitions.fast};

  &:hover {
    color: \${({ theme, $danger }) => ($danger ? theme.colors.danger : theme.colors.text)};
    background: \${({ theme, $danger }) => ($danger ? theme.colors.dangerLight : theme.colors.surfaceHover)};
  }
\`;

const LikeBtn = styled.button\`
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  padding: 4px 6px;
  font-size: \${({ theme }) => theme.fontSizes.xs};
  color: \${({ $liked, theme }) => ($liked ? theme.colors.primary : theme.colors.textMuted)};
  cursor: pointer;
  border-radius: \${({ theme }) => theme.borderRadius.sm};
  transition: color \${({ theme }) => theme.transitions.fast}, background \${({ theme }) => theme.transitions.fast};

  &:hover {
    color: \${({ theme }) => theme.colors.primary};
    background: \${({ theme }) => theme.colors.primaryLight};
  }
\`;

const EditorRow = styled.div\`
  display: flex;
  gap: \${({ theme }) => theme.spacing.md};
  padding-top: \${({ theme }) => theme.spacing.sm};
  border-top: 1px solid \${({ theme }) => theme.colors.border};
\`;

const EditorAvatar = styled.div\`
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: \${({ theme }) => theme.colors.primaryLight};
  color: \${({ theme }) => theme.colors.primary};
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
\`;

const EditorBody = styled.div\`
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: \${({ theme }) => theme.spacing.sm};
\`;

const EditorTrigger = styled.button\`
  flex: 1;
  padding: 10px 14px;
  background: \${({ theme }) => theme.colors.background};
  border: 1px solid \${({ theme }) => theme.colors.border};
  border-radius: \${({ theme }) => theme.borderRadius.md};
  color: \${({ theme }) => theme.colors.textMuted};
  font-size: \${({ theme }) => theme.fontSizes.sm};
  text-align: left;
  cursor: pointer;
  transition: border-color \${({ theme }) => theme.transitions.fast}, background \${({ theme }) => theme.transitions.fast};

  &:hover {
    border-color: \${({ theme }) => theme.colors.primary};
    background: \${({ theme }) => theme.colors.surfaceHover};
  }
\`;

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
`;

/**
 * O STARTUP: a busca do ⌘K e a menção `@notícia` das anotações. As duas apontam para a LEITURA — que é
 * onde uma notícia é aberta —, e não para o formulário.
 */
const STARTUP_SOURCE = `
import { Icon } from '@microteia/ui';

const SOURCE_ID = 'microteia:news';
const READ_TAB_PREFIX = 'news-read:';
const LIST_KEY = 'news';
const GROUP = 'Notícias';

const screenOf = (ctx) => ctx.screenDefinitions.find((s) => (s.sourceId || s.id) === SOURCE_ID);
const textOf = (record, key) => (key && typeof record[key] === 'string' ? record[key] : '');

const recordsOf = (ctx, screen) => {
  const collection = screen.dataCollection || screen.id;
  return ctx.records.filter((r) => r.collection === collection);
};

const matches = (record, q) => {
  if (!q) return true;
  const title = textOf(record, 'title').toLowerCase();
  const summary = textOf(record, 'summary').toLowerCase();
  return title.indexOf(q) !== -1 || summary.indexOf(q) !== -1;
};

export default function startup(host) {
  host.commands.register({
    group: GROUP,
    getItems(query, ctx) {
      const q = String(query || '').toLowerCase().trim();
      if (!q) return [];
      const screen = screenOf(ctx);
      if (!screen) return [];
      const icon = <Icon name="newspaper" size={16} />;
      const items = [];
      if ('nova notícia'.indexOf(q) !== -1) {
        items.push({ id: 'noticia:new', title: 'Nova notícia', group: GROUP, icon, onSelect: () => { ctx.openTab('new-dyn:' + screen.id); ctx.close(); } });
      }
      if ('abrir notícias'.indexOf(q) !== -1) {
        items.push({ id: 'noticia:list', title: 'Abrir Notícias', group: GROUP, icon, onSelect: () => { ctx.openTab(LIST_KEY); ctx.close(); } });
      }
      for (const r of recordsOf(ctx, screen)) {
        if (!matches(r, q)) continue;
        items.push({
          id: 'noticia:' + r.id,
          title: textOf(r, 'title'),
          subtitle: textOf(r, 'summary') || 'Notícia',
          group: GROUP,
          icon,
          onSelect: () => { ctx.openTab(READ_TAB_PREFIX + r.id); ctx.close(); },
        });
      }
      return items.slice(0, 9);
    },
  });

  host.mentions.register({
    key: 'noticia',
    label: 'Notícia',
    description: 'Inserir link para uma notícia',
    icon: 'newspaper',
    search(query, ctx) {
      const screen = screenOf(ctx);
      if (!screen) return [];
      const q = String(query || '').toLowerCase().trim();
      return recordsOf(ctx, screen)
        .filter((r) => textOf(r, 'title') && matches(r, q))
        .slice(0, 20)
        .map((r) => ({
          id: r.id,
          title: textOf(r, 'title'),
          subtitle: textOf(r, 'summary') || 'Notícia',
          tabKey: READ_TAB_PREFIX + r.id,
        }));
    },
  });
}
`;

export const noticiaPlugin: MarketplacePlugin = {
  manifest: {
    id: 'com.microteia.noticia',
    version: '1.0.0',
    kernel: '^1.0.0',
    name: 'Notícias',
    description: 'O mural do escritório recriado como extensão — com o não-lido por usuário, os comentários e as etiquetas.',
    publisher: { name: 'Microteia' },
    dependencies: { 'core.ui': '^1.0.0' },
    contributes: [
      nav({
        key: 'news',
        label: 'Notícias',
        icon: 'newspaper',
        order: 90,
        // O selo PESSOAL: as notícias que ESTE usuário ainda não leu, tirando as que ele mesmo
        // publicou. É uma expressão sobre os registros que a listagem já enxerga — não há contador
        // por usuário em coleção nenhuma, e o número desce sozinho quando ele abre a notícia.
        badge: { collection: 'news', when: 'not contains(readBy, user.id) and createdBy != user.id' },
      }),
      page({ key: 'news', title: 'Notícias', icon: 'newspaper' }, 'news'),
      page({ key: '', keyPrefix: READ_TAB_PREFIX, title: 'Notícia', icon: 'newspaper' }, 'news-read'),
    ],
  },
  summary:
    'O mural do escritório: o comunicado que alguém publica, um selo no menu com o que VOCÊ ainda não leu, curtidas, guardar para depois, etiquetas, documentos anexados e a conversa em comentários embaixo de cada notícia.',
  overview: {
    type: 'stack',
    gap: 'lg',
    children: [
      {
        type: 'markdown',
        content:
          'A extensão **Notícias** traz o mural do escritório: qualquer pessoa publica um comunicado, com resumo, conteúdo em Markdown, categoria e link para a fonte.\n\nO item no menu mostra **quantas notícias você ainda não leu** — o número é seu, não do escritório, e desce assim que você abre cada uma. A lista abre justamente nelas, e você pode **guardar para depois** o que quiser reler.\n\nCada notícia tem **comentários**, com curtida, edição e "(editado)" à mostra. Quem comenta devolve a notícia à caixa de todos, para que ninguém perca a conversa.\n\nQuem publicou pode **editar e excluir** o que publicou, sem depender de um administrador — e o mesmo vale para cada comentário.',
      },
      {
        type: 'keyValue',
        items: [
          { label: 'Adiciona', value: 'Item "Notícias" no menu, com o seu contador de não lidas' },
          { label: 'Cadastro', value: '5 campos, mais etiquetas e documentos' },
          { label: 'Conversa', value: 'Comentários com curtida e edição' },
          { label: 'Abre em', value: 'Notícias não lidas' },
        ],
      },
      {
        type: 'banner',
        message: 'O lido, o curtido e o guardado ficam gravados na própria notícia, por usuário. Cada pessoa vê o seu.',
        variant: 'info',
      },
      {
        type: 'banner',
        message: 'Remover a extensão remove as telas, nunca as notícias: os registros continuam no escritório e voltam a aparecer se ela for instalada de novo.',
        variant: 'info',
      },
    ],
  },
  workflows: [],
  screens: [NEWS_SCREEN, COMMENTS_SCREEN],
  lookups: LOOKUPS,
  tagLists: TAG_LISTS,
  startup: STARTUP_SOURCE,
  views: [
    { key: 'news', title: 'Notícias', icon: 'newspaper', source: NEWS_LIST_SOURCE },
    { key: 'news-read', title: 'Notícia', icon: 'newspaper', source: NEWS_READ_SOURCE },
  ],
};
