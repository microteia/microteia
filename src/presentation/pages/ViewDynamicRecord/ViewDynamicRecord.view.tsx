import React, { useRef } from 'react';
import {
  RiAddLine,
  RiArrowDownSLine,
  RiCloseLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiSaveLine,
  RiUploadLine,
} from 'react-icons/ri';
import { S } from './ViewDynamicRecord.styles';
import { useViewDynamicRecordViewModel } from './ViewDynamicRecord.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { getScreenIcon } from '../../shared/screenIcons';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ViewDynamicRecordView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewDynamicRecordViewModel(tabKey);
  const definition = vm.definition;
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Registro</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoadingDefinition ? (
            <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
          ) : (
            <InfoBanner
              variant="info"
              message="Esta tela personalizada não está mais disponível. Ela pode ter sido desativada ou excluída pelo administrador."
            />
          )}
        </S.BannerWrapper>
      </S.Page>
    );
  }

  if (vm.recordNotFound) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{definition.titleSingular}</S.Title>
        </S.Header>
        <S.BannerWrapper>
          <InfoBanner variant="info" message="Registro não encontrado. Ele pode ter sido excluído." />
        </S.BannerWrapper>
      </S.Page>
    );
  }

  const showTabs = !vm.isNew && (definition.hasNotes || definition.hasDocuments);

  return (
    <S.Page>
      <S.Header>
        <S.TitleRow>
          {getScreenIcon(definition.icon, 22)}
          <S.Title>{vm.isNew ? `Novo ${definition.titleSingular}` : definition.titleSingular}</S.Title>
        </S.TitleRow>
        <S.HeaderActions>
          {!vm.isNew && (
            <Button variant="secondary" onClick={vm.handleClone}>
              <RiFileCopyLine size={16} />
              Clonar
            </Button>
          )}
          {!vm.isNew && vm.isAdmin && (
            <Button variant="danger" onClick={vm.requestDelete}>
              <RiDeleteBinLine size={16} />
              Excluir
            </Button>
          )}
          {(vm.activeTab === 'data' || vm.isNew) && (
            <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving} $isLoading={vm.isSaving}>
              <RiSaveLine size={16} />
              Salvar
            </Button>
          )}
        </S.HeaderActions>
      </S.Header>

      {showTabs && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'data'} onClick={() => vm.setActiveTab('data')}>Dados</S.TabBtn>
          {definition.hasNotes && (
            <S.TabBtn $active={vm.activeTab === 'notes'} onClick={() => vm.setActiveTab('notes')}>Anotações</S.TabBtn>
          )}
          {definition.hasDocuments && (
            <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
          )}
        </S.TabBar>
      )}

      <S.Content>
        {(vm.activeTab === 'data' || vm.isNew) && (
          <S.FormWrapper>
            <CustomFieldsSection
              screenKey={vm.screenKey}
              fields={vm.sortedFields}
              values={vm.formValues}
              onChange={vm.setFieldValue}
            />
          </S.FormWrapper>
        )}

        {vm.activeTab === 'notes' && !vm.isNew && definition.hasNotes && (
          <>
            <S.TabSectionHeader>
              {!vm.isNoteEditorOpen && (
                <Button variant="secondary" size="sm" onClick={vm.openNoteEditor}>
                  <RiAddLine size={14} />
                  Nova Anotação
                </Button>
              )}
            </S.TabSectionHeader>

            {vm.isNoteEditorOpen && (
              <S.NoteEditorCard>
                <S.NoteEditorTitleRow>
                  <Input
                    value={vm.newNoteTitle}
                    onChange={(e) => vm.setNewNoteTitle(e.target.value)}
                    placeholder="Título da anotação *"
                  />
                </S.NoteEditorTitleRow>
                <MarkdownEditor
                  value={vm.newNoteText}
                  onChange={vm.setNewNoteText}
                  placeholder="Conteúdo em Markdown..."
                />
                <S.NoteEditorActions>
                  <Button variant="ghost" size="sm" onClick={vm.closeNoteEditor}>
                    <RiCloseLine size={14} />
                    Cancelar
                  </Button>
                  <Button size="sm" onClick={() => void vm.handleAddNote()} disabled={vm.isAddingNote || !vm.newNoteTitle.trim() || !vm.newNoteText.trim()}>
                    <RiAddLine size={14} />
                    {vm.isAddingNote ? 'Adicionando...' : 'Adicionar'}
                  </Button>
                </S.NoteEditorActions>
              </S.NoteEditorCard>
            )}

            {vm.notesLoading ? (
              <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
            ) : vm.notes.length === 0 ? (
              <S.EmptyState>
                <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
                <div>Nenhuma anotação ainda.</div>
              </S.EmptyState>
            ) : (
              <S.NoteList>
                {vm.notes.map((note) => {
                  const isExpanded = vm.expandedNoteIds.has(note.id);
                  return (
                    <S.NoteCard key={note.id}>
                      <S.NoteCardTop>
                        <S.NoteCardClickArea onClick={() => vm.toggleNoteExpanded(note.id)}>
                          <S.NoteAvatar>
                            {note.createdByPhotoUrl
                              ? <S.NoteAvatarImg src={note.createdByPhotoUrl} alt={note.createdByName} />
                              : (note.createdByName || 'U').charAt(0).toUpperCase()}
                          </S.NoteAvatar>
                          <S.NoteBody>
                            <S.NoteTitle>{note.title || '(sem título)'}</S.NoteTitle>
                            <S.NoteDate>
                              {note.createdByName} · {format(note.createdAt, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                            </S.NoteDate>
                          </S.NoteBody>
                          <S.NoteExpandIcon $expanded={isExpanded}>
                            <RiArrowDownSLine size={18} />
                          </S.NoteExpandIcon>
                        </S.NoteCardClickArea>
                        {vm.isAdmin && (
                          <Button variant="ghost" size="sm" onClick={() => vm.requestDeleteNote(note)} title="Excluir anotação">
                            <RiDeleteBinLine size={13} />
                          </Button>
                        )}
                      </S.NoteCardTop>
                      {isExpanded && (
                        <>
                          <S.NoteDivider />
                          <S.NoteContent>
                            <MarkdownContent>{note.text}</MarkdownContent>
                          </S.NoteContent>
                        </>
                      )}
                    </S.NoteCard>
                  );
                })}
              </S.NoteList>
            )}
          </>
        )}

        {vm.activeTab === 'documents' && !vm.isNew && definition.hasDocuments && (
          <>
            <input
              ref={fileInputRef}
              type="file"
              style={{ display: 'none' }}
              onChange={vm.handleSelectFile}
            />

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
                      onDelete={vm.isAdmin ? vm.handleDeleteDocumentType : undefined}
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
              <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
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
                      {vm.isAdmin && (
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
      </S.Content>

      <ConfirmModal
        isOpen={vm.recordToDelete !== null}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir "${vm.recordToDelete?.title ?? ''}"? As anotações e documentos vinculados também serão excluídos. Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={vm.isDeleting}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />

      <ConfirmModal
        isOpen={vm.noteToDelete !== null}
        title="Excluir anotação"
        message={`Tem certeza que deseja excluir a anotação "${vm.noteToDelete?.title ?? ''}"?`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void vm.confirmDeleteNote()}
        onCancel={vm.cancelDeleteNote}
      />

      <ConfirmModal
        isOpen={vm.docToDelete !== null}
        title="Excluir documento"
        message={`Tem certeza que deseja excluir o documento "${vm.docToDelete?.name ?? ''}"?`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void vm.confirmDeleteDoc()}
        onCancel={vm.cancelDeleteDoc}
      />
    </S.Page>
  );
};
