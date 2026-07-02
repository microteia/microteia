import React, { useRef } from 'react';
import {
  RiHeart3Line, RiHeart3Fill, RiEyeLine,
  RiBookmarkLine, RiBookmarkFill, RiExternalLinkLine, RiEditLine,
  RiLinkM, RiCheckLine, RiFileTextLine, RiUploadLine, RiCloseLine,
  RiDeleteBinLine, RiMailUnreadLine,
} from 'react-icons/ri';
import { useViewNewsViewModel } from './ViewNews.viewmodel';
import { S } from './ViewNews.styles';
import { TagManager } from '../../components/ui/TagManager';
import { TagIconButton } from '../../components/ui/TagIconButton';
import { NewsComments } from '../../components/ui/NewsComments';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { UserAvatar } from '../../components/ui/UserAvatar';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

function formatDateTime(d: Date): string {
  return d.toLocaleString('pt-BR', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export const ViewNewsView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewNewsViewModel(tabKey);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'news'} onClick={() => vm.setActiveTab('news')}>Notícia</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
        </S.TabBar>

        {vm.activeTab === 'news' && (
          <>
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
                    {vm.isRead && (
                      <S.StatItem
                        onClick={vm.handleMarkAsUnread}
                        title="Marcar como não lida"
                      >
                        <RiMailUnreadLine size={16} />
                        Marcar como não lida
                      </S.StatItem>
                    )}
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
          </>
        )}

        {vm.activeTab === 'documents' && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={vm.handleSelectFile}
            />

            {vm.canEdit && (
              <S.TabSectionHeader>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={vm.isUploadingDoc || !!vm.pendingFile}
                >
                  <RiUploadLine size={14} />
                  Anexar Documento
                </Button>
              </S.TabSectionHeader>
            )}

            {vm.pendingFile && (
              <S.PendingFileCard>
                <S.PendingFileTopRow>
                  <S.DocIcon><RiFileTextLine /></S.DocIcon>
                  <S.PendingFileContent>
                    <DynamicSelect
                      staticOptions={vm.documentTypeOptions}
                      dynamicOptions={vm.documentTypeDynamicOptions}
                      value={vm.pendingType}
                      onChange={vm.setPendingType}
                      placeholder="Tipo (opcional)"
                      onAdd={vm.handleAddDocumentType}
                      onDelete={vm.handleDeleteDocumentType}
                      deleteConfirmTitle="Excluir tipo de documento"
                      deleteConfirmMessage="Tem certeza que deseja excluir este tipo de documento?"
                      disabled={vm.isUploadingDoc}
                    />
                  </S.PendingFileContent>
                  <S.PendingFileActions>
                    <Button variant="ghost" size="sm" onClick={vm.handleCancelPendingUpload} disabled={vm.isUploadingDoc}>
                      <RiCloseLine size={14} />
                      Cancelar
                    </Button>
                    <Button size="sm" onClick={() => void vm.handleConfirmUpload()} disabled={vm.isUploadingDoc}>
                      {vm.isUploadingDoc ? 'Enviando...' : 'Confirmar Envio'}
                    </Button>
                  </S.PendingFileActions>
                </S.PendingFileTopRow>
                <S.PendingFileName title={vm.pendingFile.name}>{vm.pendingFile.name}</S.PendingFileName>
              </S.PendingFileCard>
            )}

            {vm.docsLoading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Spinner />
              </div>
            ) : vm.documents.length === 0 ? (
              <S.EmptyState>
                <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
                <div>Nenhum documento anexado.</div>
              </S.EmptyState>
            ) : (
              <S.DocList>
                {vm.documents.map((docItem) => (
                  <S.DocRow key={docItem.id}>
                    <S.DocIcon><RiFileTextLine /></S.DocIcon>
                    <S.DocContent>
                      <S.DocName href={docItem.url} target="_blank" rel="noopener noreferrer" title={docItem.name}>
                        {docItem.name}
                      </S.DocName>
                      {docItem.description && (
                        <S.DocMeta>{docItem.description}</S.DocMeta>
                      )}
                      <S.DocUploaderRow>
                        <S.DocUploaderAvatar>
                          {docItem.createdByPhotoUrl
                            ? <S.DocUploaderImg src={docItem.createdByPhotoUrl} alt={docItem.createdByName} />
                            : (docItem.createdByName || 'U').charAt(0).toUpperCase()}
                        </S.DocUploaderAvatar>
                        <S.DocMeta>
                          {docItem.createdByName} · {format(docItem.createdAt, "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                        </S.DocMeta>
                      </S.DocUploaderRow>
                    </S.DocContent>
                    {docItem.type && <S.DocTypeBadge>{docItem.type}</S.DocTypeBadge>}
                    <S.DocActions>
                      <Button variant="ghost" size="sm" onClick={() => window.open(docItem.url, '_blank', 'noopener,noreferrer')} title="Abrir documento">
                        <RiExternalLinkLine size={14} />
                      </Button>
                      {vm.canEdit && (
                        <Button variant="ghost" size="sm" onClick={() => vm.requestDeleteDoc(docItem)} title="Excluir documento">
                          <RiDeleteBinLine size={13} />
                        </Button>
                      )}
                    </S.DocActions>
                  </S.DocRow>
                ))}
              </S.DocList>
            )}
          </>
        )}
      </S.Root>

      <ConfirmModal
        isOpen={!!vm.docToDelete}
        onConfirm={() => void vm.confirmDeleteDoc()}
        onCancel={vm.cancelDeleteDoc}
        title="Excluir Documento"
        message={`Tem certeza que deseja excluir "${vm.docToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </>
  );
};
