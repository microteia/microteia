import React, { useRef } from 'react';
import {
  RiUserLine,
  RiBuildingLine,
  RiDeleteBinLine,
  RiToggleLine,
  RiLinkM,
  RiCheckLine,
  RiFileCopyLine,
  RiPriceTag3Line,
  RiAddLine,
  RiFileTextLine,
  RiUploadLine,
  RiExternalLinkLine,
  RiCloseLine,
  RiArrowDownSLine,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './ViewPerson.styles';
import { useViewPersonViewModel } from './ViewPerson.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Input } from '../../components/ui/Input';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ViewPersonView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewPersonViewModel(tabKey);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appliedTags = vm.person ? vm.tagAdapter.getAppliedTags(vm.person.id) : [];

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar>
            {(vm.formData.name || 'N').charAt(0).toUpperCase()}
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Nova Pessoa' : (vm.person?.name ?? 'Pessoa')}</S.Title>
            <S.SubTitle>
              {vm.formData.type === 'Pessoa Física'
                ? <><RiUserLine size={13} /> Pessoa Física</>
                : <><RiBuildingLine size={13} /> Pessoa Jurídica</>}
            </S.SubTitle>
            {!vm.isNew && appliedTags.length > 0 && (
              <S.Tags>
                {appliedTags.map((t) => (
                  <S.TagPill key={t.id} $color={t.color}>
                    <S.TagDot $color={t.color} />
                    {t.name}
                  </S.TagPill>
                ))}
              </S.Tags>
            )}
          </S.HeaderInfo>
        </S.HeaderLeft>

        <S.HeaderActions>
          {!vm.isNew && (
            <>
              <Button variant="ghost" size="sm" onClick={vm.handleCopyDeepLink} title="Copiar link">
                {vm.copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
              </Button>
              <Button variant="ghost" size="sm" onClick={vm.handleClone} title="Clonar">
                <RiFileCopyLine size={14} />
              </Button>
              <Button variant="ghost" size="sm" title={vm.person?.status === 'Ativo' ? 'Inativar' : 'Ativar'} onClick={() => void vm.handleToggleStatus()}>
                <S.ToggleIcon $enabled={vm.person?.status === 'Ativo'}>
                  <RiToggleLine size={14} />
                </S.ToggleIcon>
              </Button>
              <Button variant="ghost" size="sm" title="Gerenciar etiquetas" onClick={vm.openTagManager}>
                <RiPriceTag3Line size={14} />
              </Button>
            </>
          )}
          {(vm.activeTab === 'data' || vm.isNew) && (
            <S.SaveBtn onClick={() => void vm.handleSave()} disabled={vm.isSaving} title={vm.isSaving ? 'Salvando...' : 'Salvar'}>
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {!vm.isNew && vm.isAdmin && (
            <S.DeleteBtn onClick={vm.handleDeletePerson} title="Excluir Pessoa">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {!vm.isNew && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'data'} onClick={() => vm.setActiveTab('data')}>Dados</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'notes'} onClick={() => vm.setActiveTab('notes')}>Anotações</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
        </S.TabBar>
      )}

      <S.Content>
        {(vm.activeTab === 'data' || vm.isNew) && (
          <S.FormGrid>
            <S.FormGroup $fullWidth>
              <CustomFieldsSection
                screenKey="persons-native"
                fields={vm.nativeFields}
                values={vm.nativeValues}
                onChange={vm.setNativeFieldValue}
                lookupOptions={vm.personLookupOptions}
                onAddLookupOption={vm.handleAddPersonLookup}
                onDeleteLookupOption={vm.handleDeletePersonLookup}
                canDeleteLookupOption={vm.isAdmin}
              />
            </S.FormGroup>

            {vm.customFields.length > 0 && (
              <>
                <S.SectionTitle>Campos adicionais</S.SectionTitle>
                <S.FormGroup $fullWidth>
                  <CustomFieldsSection
                    screenKey="persons"
                    fields={vm.customFields}
                    values={vm.customValues}
                    onChange={vm.setCustomValue}
                  />
                </S.FormGroup>
              </>
            )}
          </S.FormGrid>
        )}

        {vm.activeTab === 'notes' && !vm.isNew && (
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
              <div style={{ display: 'flex', justifyContent: 'center', padding: '32px' }}>
                <Spinner />
              </div>
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

        {vm.activeTab === 'documents' && !vm.isNew && (
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

      {vm.isTagManagerOpen && vm.person && (
        <TagManager
          entityId={vm.person.id}
          onClose={vm.closeTagManager}
          adapter={vm.tagAdapter}
        />
      )}

      <ConfirmModal
        isOpen={!!vm.noteToDelete}
        onConfirm={() => void vm.confirmDeleteNote()}
        onCancel={vm.cancelDeleteNote}
        title="Excluir Anotação"
        message="Tem certeza que deseja excluir esta anotação? Esta ação não pode ser desfeita."
        confirmLabel="Excluir"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!vm.docToDelete}
        onConfirm={() => void vm.confirmDeleteDoc()}
        onCancel={vm.cancelDeleteDoc}
        title="Excluir Documento"
        message={`Tem certeza que deseja excluir "${vm.docToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />

      <ConfirmModal
        isOpen={!!vm.personToDelete}
        onConfirm={() => void vm.confirmDeletePerson()}
        onCancel={vm.cancelDeletePerson}
        title="Excluir Pessoa"
        message={`Tem certeza que deseja excluir "${vm.personToDelete?.name}"? Todos os dados da pessoa serão perdidos.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
