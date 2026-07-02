import React, { useRef } from 'react';
import {
  RiUserLine,
  RiBuildingLine,
  RiDeleteBinLine,
  RiToggleLine,
  RiLinkM,
  RiCheckLine,
  RiPriceTag3Line,
  RiAddLine,
  RiFileTextLine,
  RiUploadLine,
  RiExternalLinkLine,
  RiCloseLine,
  RiArrowDownSLine,
} from 'react-icons/ri';
import { S } from './ViewPerson.styles';
import { useViewPersonViewModel } from './ViewPerson.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Input, Label, Textarea, ErrorMessage } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { DateInput } from '../../components/ui/DateInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

const STATES = ['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];

const STATE_OPTIONS: SearchSelectOption[] = STATES.map((uf) => ({ value: uf, label: uf }));

const GENDER_OPTIONS: SearchSelectOption[] = [
  { value: 'M', label: 'Masculino' },
  { value: 'F', label: 'Feminino' },
  { value: 'N', label: 'Não Informado' },
];

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
              <Button variant="ghost" size="sm" title={vm.person?.status === 'Ativo' ? 'Inativar' : 'Ativar'} onClick={() => void vm.handleToggleStatus()}>
                <RiToggleLine size={14} />
              </Button>
              <Button variant="ghost" size="sm" title="Gerenciar etiquetas" onClick={vm.openTagManager}>
                <RiPriceTag3Line size={14} />
              </Button>
              {vm.isAdmin && (
                <Button variant="danger" size="sm" onClick={vm.handleDeletePerson} title="Excluir Pessoa">
                  <RiDeleteBinLine size={14} />
                </Button>
              )}
            </>
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
              <Label>Tipo *</Label>
              <DynamicSelect
                staticOptions={vm.typeOptions}
                dynamicOptions={vm.typeDynamicOptions}
                value={vm.formData.type}
                onChange={(val) => vm.setFormData({ type: val as 'Pessoa Física' | 'Pessoa Jurídica' })}
                placeholder="Selecione o tipo..."
                onAdd={vm.handleAddType}
                onDelete={vm.handleDeleteType}
                deleteConfirmTitle="Excluir tipo de pessoa"
              />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Nome *</Label>
              <Input
                value={vm.formData.name}
                onChange={(e) => vm.setFormData({ name: e.target.value })}
                placeholder="Nome completo ou razão social"
              />
            </S.FormGroup>

            {vm.formData.type === 'Pessoa Física' ? (
              <S.FormGroup>
                <Label>CPF</Label>
                <Input
                  value={vm.formData.cpf}
                  onChange={(e) => vm.handleCPFChange(e.target.value)}
                  placeholder="000.000.000-00"
                  $hasError={!!vm.formErrors.cpf}
                />
                {vm.formErrors.cpf && <ErrorMessage>{vm.formErrors.cpf}</ErrorMessage>}
              </S.FormGroup>
            ) : (
              <S.FormGroup>
                <Label>CNPJ</Label>
                <Input
                  value={vm.formData.cnpj}
                  onChange={(e) => vm.handleCNPJChange(e.target.value)}
                  placeholder="00.000.000/0000-00"
                  $hasError={!!vm.formErrors.cnpj}
                />
                {vm.formErrors.cnpj && <ErrorMessage>{vm.formErrors.cnpj}</ErrorMessage>}
              </S.FormGroup>
            )}

            <S.FormGroup>
              <Label>E-mail</Label>
              <Input type="email" value={vm.formData.email} onChange={(e) => vm.setFormData({ email: e.target.value })} placeholder="email@exemplo.com" />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Telefone</Label>
              <Input
                value={vm.formData.phone}
                onChange={(e) => vm.handlePhoneChange(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Telefone Secundário</Label>
              <Input
                value={vm.formData.secondaryPhone}
                onChange={(e) => vm.handleSecondaryPhoneChange(e.target.value)}
                placeholder="(00) 00000-0000"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Relacionamento</Label>
              <DynamicSelect
                staticOptions={vm.relationshipOptions}
                dynamicOptions={vm.relationshipDynamicOptions}
                value={vm.formData.relationship}
                onChange={(val) => vm.setFormData({ relationship: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddRelationship}
                onDelete={vm.handleDeleteRelationship}
                deleteConfirmTitle="Excluir tipo de relacionamento"
              />
            </S.FormGroup>

            {vm.formData.type === 'Pessoa Física' && (
              <>
                <S.FormGroup>
                  <Label>Profissão</Label>
                  <DynamicSelect
                    dynamicOptions={vm.occupationOptions}
                    value={vm.formData.occupation}
                    onChange={(val) => vm.setFormData({ occupation: val })}
                    placeholder="Selecione ou adicione..."
                    onAdd={vm.handleAddOccupation}
                    onDelete={vm.handleDeleteOccupation}
                    deleteConfirmTitle="Excluir profissão"
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>Nacionalidade</Label>
                  <DynamicSelect
                    staticOptions={vm.nationalityOptions}
                    dynamicOptions={vm.nationalityDynamicOptions}
                    value={vm.formData.nationality}
                    onChange={(val) => vm.setFormData({ nationality: val })}
                    placeholder="Selecione ou adicione..."
                    onAdd={vm.handleAddNationality}
                    onDelete={vm.handleDeleteNationality}
                    deleteConfirmTitle="Excluir nacionalidade"
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>Estado Civil</Label>
                  <DynamicSelect
                    staticOptions={vm.maritalStatusOptions}
                    dynamicOptions={vm.maritalStatusDynamicOptions}
                    value={vm.formData.maritalStatus}
                    onChange={(val) => vm.setFormData({ maritalStatus: val })}
                    placeholder="Selecione ou adicione..."
                    onAdd={vm.handleAddMaritalStatus}
                    onDelete={vm.handleDeleteMaritalStatus}
                    deleteConfirmTitle="Excluir estado civil"
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>Data de Nascimento</Label>
                  <DateInput
                    value={vm.formData.birthDate}
                    onChange={(val) => vm.setFormData({ birthDate: val })}
                  />
                </S.FormGroup>
                <S.FormGroup>
                  <Label>Sexo</Label>
                  <SearchSelect
                    options={GENDER_OPTIONS}
                    value={vm.formData.gender}
                    onChange={(val) => vm.setFormData({ gender: val })}
                    placeholder="Selecione..."
                  />
                </S.FormGroup>
              </>
            )}

            <S.SectionTitle>Endereço</S.SectionTitle>
            <S.FormGroup>
              <Label>CEP</Label>
              <Input
                value={vm.formData.addressZipCode}
                onChange={(e) => vm.handleCEPChange(e.target.value)}
                placeholder="00000-000"
                disabled={vm.isFetchingAddress}
              />
              {vm.isFetchingAddress && <ErrorMessage style={{ color: 'inherit' }}>Buscando endereço...</ErrorMessage>}
              {vm.addressFetchError && <ErrorMessage>{vm.addressFetchError}</ErrorMessage>}
            </S.FormGroup>
            <S.FormGroup $fullWidth>
              <Label>Rua / Avenida</Label>
              <Input value={vm.formData.addressStreet} onChange={(e) => vm.setFormData({ addressStreet: e.target.value })} placeholder="Rua / Avenida" />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Número</Label>
              <Input value={vm.formData.addressNumber} onChange={(e) => vm.setFormData({ addressNumber: e.target.value })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Complemento</Label>
              <Input value={vm.formData.addressComplement} onChange={(e) => vm.setFormData({ addressComplement: e.target.value })} placeholder="Apto, Sala..." />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Bairro</Label>
              <Input value={vm.formData.addressNeighborhood} onChange={(e) => vm.setFormData({ addressNeighborhood: e.target.value })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Cidade</Label>
              <DynamicSelect
                dynamicOptions={vm.cityOptions}
                value={vm.formData.addressCity}
                onChange={(val) => vm.setFormData({ addressCity: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddCity}
                onDelete={vm.handleDeleteCity}
                deleteConfirmTitle="Excluir cidade"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Estado</Label>
              <SearchSelect options={STATE_OPTIONS} value={vm.formData.addressState} onChange={(val) => vm.setFormData({ addressState: val })} placeholder="UF" />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Observações</Label>
              <Textarea value={vm.formData.notes} onChange={(e) => vm.setFormData({ notes: e.target.value })} placeholder="Informações adicionais sobre a pessoa" />
            </S.FormGroup>

            <S.FormActions>
              <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
                {vm.isSaving ? 'Salvando...' : 'Salvar'}
              </Button>
            </S.FormActions>
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
