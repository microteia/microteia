import React, { useRef } from 'react';
import {
  RiFolderLine,
  RiDeleteBinLine,
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
import { S } from './ViewCase.styles';
import { useViewCaseViewModel } from './ViewCase.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';


export const ViewCaseView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewCaseViewModel(tabKey);
  const {
    areaOptions, areaDynamicOptions,
    phaseOptions, phaseDynamicOptions,
    statusOptions, statusDynamicOptions,
    instanceOptions, instanceDynamicOptions,
    actionTypeOptions, courtOptions, districtOptions, judgeOptions,
    handleAddArea, handleDeleteArea,
    handleAddPhase, handleDeletePhase,
    handleAddStatus, handleDeleteStatus,
    handleAddInstance, handleDeleteInstance,
    handleAddActionType, handleDeleteActionType,
    handleAddCourt, handleDeleteCourt,
    handleAddDistrict, handleDeleteDistrict,
    handleAddJudge, handleDeleteJudge,
  } = vm;
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!vm.isNew && !vm.case_) {
    return <S.NotFound>Processo não encontrado.</S.NotFound>;
  }

  const personOptions: SearchSelectOption[] = vm.personOptions.map((o) => ({ value: o.value, label: o.label }));
  const memberOptions: SearchSelectOption[] = vm.memberOptions.map((o) => ({ value: o.value, label: o.label }));

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar>
            <RiFolderLine size={22} />
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Novo Processo' : (vm.case_?.title ?? 'Processo')}</S.Title>
            <S.SubTitle>
              {!vm.isNew && vm.case_ && (
                <>
                  <span style={{ fontSize: '11px' }}>
                    {vm.case_.caseNumber}
                  </span>
                </>
              )}
            </S.SubTitle>
            {!vm.isNew && vm.appliedTags.length > 0 && (
              <S.Tags>
                {vm.appliedTags.map((t) => (
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
                {vm.copyLinkDone ? 'Copiado!' : 'Copiar link'}
              </Button>
              <Button variant="ghost" size="sm" onClick={vm.openTagManager}>
                <RiPriceTag3Line size={14} />
                Etiquetas
              </Button>
              {vm.isAdmin && (
                <Button variant="danger" size="sm" onClick={vm.handleDeleteCase}>
                  <RiDeleteBinLine size={14} />
                  Excluir
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
            <S.SectionTitle>Partes</S.SectionTitle>

            <S.FormGroup>
              <Label>Polo Ativo</Label>
              <MultiSearchSelect
                options={personOptions}
                values={vm.formData.activePoleIds}
                onChange={(vals) => vm.setFormData({ activePoleIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Polo Passivo</Label>
              <MultiSearchSelect
                options={personOptions}
                values={vm.formData.passivePoleIds}
                onChange={(vals) => vm.setFormData({ passivePoleIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>

            <S.SectionTitle>Identificação</S.SectionTitle>

            <S.FormGroup $fullWidth>
              <Label>Número do Processo*</Label>
              <Input
                value={vm.formData.caseNumber}
                onChange={(e) => vm.setFormData({ caseNumber: e.target.value })}
                placeholder="0000000-00.0000.0.00.0000"
                style={{ fontFamily: 'monospace' }}
              />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Título do Processo *</Label>
              <Input
                value={vm.formData.title}
                onChange={(e) => vm.setFormData({ title: e.target.value })}
                placeholder="Ex: Ação de Indenização — João Silva vs. Empresa XYZ"
              />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Cliente *</Label>
              <SearchSelect
                options={personOptions}
                value={vm.formData.personId}
                onChange={(val) => vm.setFormData({ personId: val })}
                placeholder="Selecione a pessoa..."
              />
            </S.FormGroup>

            <S.SectionTitle>Classificação</S.SectionTitle>

            <S.FormGroup>
              <Label>Área do Direito</Label>
              <DynamicSelect
                staticOptions={areaOptions}
                dynamicOptions={areaDynamicOptions}
                value={vm.formData.area}
                onChange={(val) => vm.setFormData({ area: val })}
                placeholder="Selecione a área..."
                onAdd={handleAddArea}
                onDelete={handleDeleteArea}
                deleteConfirmTitle="Excluir área do direito"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Tipo de Ação</Label>
              <DynamicSelect
                dynamicOptions={actionTypeOptions}
                value={vm.formData.type}
                onChange={(val) => vm.setFormData({ type: val })}
                placeholder="Selecione ou adicione..."
                onAdd={handleAddActionType}
                onDelete={handleDeleteActionType}
                deleteConfirmTitle="Excluir tipo de ação"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Fase Processual</Label>
              <DynamicSelect
                staticOptions={phaseOptions}
                dynamicOptions={phaseDynamicOptions}
                value={vm.formData.phase}
                onChange={(val) => vm.setFormData({ phase: val })}
                placeholder="Selecione a fase..."
                onAdd={handleAddPhase}
                onDelete={handleDeletePhase}
                deleteConfirmTitle="Excluir fase processual"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Status</Label>
              <DynamicSelect
                staticOptions={statusOptions}
                dynamicOptions={statusDynamicOptions}
                value={vm.formData.status}
                onChange={(val) => vm.setFormData({ status: val })}
                placeholder="Selecione o status..."
                onAdd={handleAddStatus}
                onDelete={handleDeleteStatus}
                deleteConfirmTitle="Excluir status"
              />
            </S.FormGroup>

            <S.SectionTitle>Tribunal</S.SectionTitle>

            <S.FormGroup>
              <Label>Instância</Label>
              <DynamicSelect
                staticOptions={instanceOptions}
                dynamicOptions={instanceDynamicOptions}
                value={vm.formData.instance}
                onChange={(val) => vm.setFormData({ instance: val })}
                placeholder="Selecione a instância..."
                onAdd={handleAddInstance}
                onDelete={handleDeleteInstance}
                deleteConfirmTitle="Excluir instância"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Vara / Tribunal</Label>
              <DynamicSelect
                dynamicOptions={courtOptions}
                value={vm.formData.court ?? ''}
                onChange={(val) => vm.setFormData({ court: val })}
                placeholder="Selecione ou adicione..."
                onAdd={handleAddCourt}
                onDelete={handleDeleteCourt}
                deleteConfirmTitle="Excluir vara/tribunal"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Comarca</Label>
              <DynamicSelect
                dynamicOptions={districtOptions}
                value={vm.formData.courtDistrict ?? ''}
                onChange={(val) => vm.setFormData({ courtDistrict: val })}
                placeholder="Selecione ou adicione..."
                onAdd={handleAddDistrict}
                onDelete={handleDeleteDistrict}
                deleteConfirmTitle="Excluir comarca"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Juiz(a)</Label>
              <DynamicSelect
                dynamicOptions={judgeOptions}
                value={vm.formData.judge ?? ''}
                onChange={(val) => vm.setFormData({ judge: val })}
                placeholder="Selecione ou adicione..."
                onAdd={handleAddJudge}
                onDelete={handleDeleteJudge}
                deleteConfirmTitle="Excluir juiz(a)"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Data de Distribuição</Label>
              <Input type="date" value={vm.formData.filedAt} onChange={(e) => vm.setFormData({ filedAt: e.target.value })} />
            </S.FormGroup>

            <S.SectionTitle>Financeiro e Responsável</S.SectionTitle>

            <S.FormGroup>
              <Label>Valor da Causa (R$)</Label>
              <Input type="number" value={vm.formData.causeValue} onChange={(e) => vm.setFormData({ causeValue: e.target.value })} placeholder="0,00" />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Valor do Contrato (R$)</Label>
              <Input type="number" value={vm.formData.contractValue} onChange={(e) => vm.setFormData({ contractValue: e.target.value })} placeholder="0,00" />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Advogado Responsável</Label>
              <SearchSelect
                options={memberOptions}
                value={vm.formData.responsibleLawyerId}
                onChange={(val) => {
                  const member = vm.memberOptions.find((m) => m.value === val);
                  vm.setFormData({ responsibleLawyerId: val, responsibleLawyerName: member?.label ?? '' });
                }}
                placeholder="Selecione o responsável..."
              />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Observações</Label>
              <Textarea value={vm.formData.notes} onChange={(e) => vm.setFormData({ notes: e.target.value })} placeholder="Anotações sobre o processo" />
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
                <S.DocIcon><RiFileTextLine /></S.DocIcon>
                <S.PendingFileContent>
                  <S.PendingFileName title={vm.pendingFile.name}>{vm.pendingFile.name}</S.PendingFileName>
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
                      {docItem.type && (
                        <S.DocMeta><strong>Tipo:</strong> {docItem.type}</S.DocMeta>
                      )}
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
                          {docItem.createdByName} · {format(docItem.createdAt, "d 'de' MMM 'de' yyyy", { locale: ptBR })}
                        </S.DocMeta>
                      </S.DocUploaderRow>
                    </S.DocContent>
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

      {vm.isTagManagerOpen && vm.case_ && (
        <TagManager
          entityId={vm.case_.id}
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
        isOpen={!!vm.caseToDelete}
        onConfirm={() => void vm.confirmDeleteCase()}
        onCancel={vm.cancelDeleteCase}
        title="Excluir Processo"
        message={`Tem certeza que deseja excluir "${vm.caseToDelete?.title}"? Todos os dados do processo serão perdidos.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
