import React, { useRef } from 'react';
import {
  RiFileTextLine,
  RiDeleteBinLine,
  RiLinkM,
  RiCheckLine,
  RiFileCopyLine,
  RiPriceTag3Line,
  RiAddLine,
  RiUploadLine,
  RiExternalLinkLine,
  RiCloseLine,
  RiArrowDownSLine,
  RiFolderLine,
  RiLinkUnlinkM,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './ViewContract.styles';
import { useViewContractViewModel } from './ViewContract.viewmodel';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { Input, Label } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { MultiSearchSelect } from '../../components/ui/MultiSearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { DateInput } from '../../components/ui/DateInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { MarkdownEditor } from '../../components/ui/MarkdownEditor';
import { MarkdownContent } from '../../components/ui/MarkdownContent';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export const ViewContractView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewContractViewModel(tabKey);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appliedTags = vm.contract ? vm.tagAdapter.getAppliedTags(vm.contract.id) : [];

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar>
            <RiFileTextLine size={22} />
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Novo Contrato' : (vm.contract?.title ?? 'Contrato')}</S.Title>
            {!vm.isNew && vm.contract && <S.SubTitle>{vm.contract.number}</S.SubTitle>}
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
              <Button variant="ghost" size="sm" onClick={vm.openTagManager} title="Gerenciar etiquetas">
                <RiPriceTag3Line size={14} />
              </Button>
            </>
          )}
          {(vm.activeTab === 'data' || vm.isNew) && (
            <Button size="sm" onClick={() => void vm.handleSave()} disabled={vm.isSaving} $isLoading={vm.isSaving} title={vm.isSaving ? 'Salvando...' : 'Salvar'}>
              <RiSaveLine size={14} />
            </Button>
          )}
          {!vm.isNew && vm.isAdmin && (
            <Button variant="danger" size="sm" onClick={vm.handleDeleteContract} title="Excluir Contrato">
              <RiDeleteBinLine size={14} />
            </Button>
          )}
        </S.HeaderActions>
      </S.Header>

      {!vm.isNew && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'data'} onClick={() => vm.setActiveTab('data')}>Dados</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'notes'} onClick={() => vm.setActiveTab('notes')}>Anotações</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'cases'} onClick={() => vm.setActiveTab('cases')}>Processos</S.TabBtn>
        </S.TabBar>
      )}

      <S.Content>
        {(vm.activeTab === 'data' || vm.isNew) && (
          <S.FormGrid>
            <S.SectionTitle>Identificação</S.SectionTitle>
            <S.FormGroup>
              <Label>Número do contrato *</Label>
              <Input
                value={vm.formData.number}
                onChange={(e) => vm.setFormData({ number: e.target.value })}
                placeholder="AB1234"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Título *</Label>
              <Input
                value={vm.formData.title}
                onChange={(e) => vm.setFormData({ title: e.target.value })}
                placeholder="Descrição simples do contrato"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Tipo de contrato *</Label>
              <DynamicSelect
                staticOptions={vm.typeOptions}
                dynamicOptions={vm.typeDynamicOptions}
                value={vm.formData.type}
                onChange={(val) => vm.setFormData({ type: val })}
                placeholder="Selecione o tipo..."
                onAdd={vm.handleAddType}
                onDelete={vm.isAdmin ? vm.handleDeleteType : undefined}
                deleteConfirmTitle="Excluir tipo de contrato"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Categoria *</Label>
              <DynamicSelect
                staticOptions={vm.categoryOptions}
                dynamicOptions={vm.categoryDynamicOptions}
                value={vm.formData.category}
                onChange={(val) => vm.setFormData({ category: val })}
                placeholder="Selecione a categoria..."
                onAdd={vm.handleAddCategory}
                onDelete={vm.isAdmin ? vm.handleDeleteCategory : undefined}
                deleteConfirmTitle="Excluir categoria"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Status *</Label>
              <DynamicSelect
                staticOptions={vm.statusOptions}
                dynamicOptions={vm.statusDynamicOptions}
                value={vm.formData.status}
                onChange={(val) => vm.setFormData({ status: val })}
                placeholder="Selecione o status..."
                onAdd={vm.handleAddStatus}
                onDelete={vm.isAdmin ? vm.handleDeleteStatus : undefined}
                deleteConfirmTitle="Excluir status"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Objeto do contrato</Label>
              <DynamicSelect
                dynamicOptions={vm.objectOptions}
                value={vm.formData.object}
                onChange={(val) => vm.setFormData({ object: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddObject}
                onDelete={vm.isAdmin ? vm.handleDeleteObject : undefined}
                deleteConfirmTitle="Excluir objeto do contrato"
              />
            </S.FormGroup>

            <S.SectionTitle>Partes envolvidas</S.SectionTitle>
            <S.FormGroup>
              <Label>Contratante</Label>
              <MultiSearchSelect
                options={vm.personOptions}
                values={vm.formData.contractorIds}
                onChange={(vals) => vm.setFormData({ contractorIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Contratado</Label>
              <MultiSearchSelect
                options={vm.personOptions}
                values={vm.formData.contracteeIds}
                onChange={(vals) => vm.setFormData({ contracteeIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Testemunhas</Label>
              <MultiSearchSelect
                options={vm.personOptions}
                values={vm.formData.witnessIds}
                onChange={(vals) => vm.setFormData({ witnessIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Advogado do Contratante</Label>
              <MultiSearchSelect
                options={vm.personOptions}
                values={vm.formData.contractorLawyerIds}
                onChange={(vals) => vm.setFormData({ contractorLawyerIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Advogado do Contratado</Label>
              <MultiSearchSelect
                options={vm.personOptions}
                values={vm.formData.contracteeLawyerIds}
                onChange={(vals) => vm.setFormData({ contracteeLawyerIds: vals })}
                placeholder="Selecione as pessoas..."
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Cliente</Label>
              <SearchSelect
                options={vm.personSearchOptions}
                value={vm.formData.clientId}
                onChange={(val) => vm.setFormData({ clientId: val })}
                placeholder="Selecione a pessoa..."
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Responsável</Label>
              <SearchSelect
                options={vm.personSearchOptions}
                value={vm.formData.responsibleId}
                onChange={(val) => vm.setFormData({ responsibleId: val })}
                placeholder="Selecione a pessoa..."
              />
            </S.FormGroup>

            <S.SectionTitle>Datas e vigência</S.SectionTitle>
            <S.FormGroup>
              <Label>Data da elaboração</Label>
              <DateInput value={vm.formData.draftedAt} onChange={(val) => vm.setFormData({ draftedAt: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Data da assinatura</Label>
              <DateInput value={vm.formData.signedAt} onChange={(val) => vm.setFormData({ signedAt: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Início da vigência</Label>
              <DateInput value={vm.formData.effectiveStart} onChange={(val) => vm.setFormData({ effectiveStart: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Fim da vigência</Label>
              <DateInput value={vm.formData.effectiveEnd} onChange={(val) => vm.setFormData({ effectiveEnd: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Renovação automática?</Label>
              <S.BoolToggle>
                <S.BoolOption type="button" $active={vm.formData.autoRenewal} onClick={() => vm.setFormData({ autoRenewal: true })}>
                  Sim
                </S.BoolOption>
                <S.BoolOption type="button" $active={!vm.formData.autoRenewal} onClick={() => vm.setFormData({ autoRenewal: false })}>
                  Não
                </S.BoolOption>
              </S.BoolToggle>
            </S.FormGroup>
            <S.FormGroup>
              <Label>Data da renovação</Label>
              <DateInput value={vm.formData.renewalDate} onChange={(val) => vm.setFormData({ renewalDate: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Data do encerramento</Label>
              <DateInput value={vm.formData.terminationDate} onChange={(val) => vm.setFormData({ terminationDate: val })} />
            </S.FormGroup>

            <S.SectionTitle>Condições financeiras</S.SectionTitle>
            <S.FormGroup>
              <Label>Valor inicial</Label>
              <CurrencyInput value={vm.formData.initialValue} onChange={(val) => vm.setFormData({ initialValue: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Valor mensal</Label>
              <CurrencyInput value={vm.formData.monthlyValue} onChange={(val) => vm.setFormData({ monthlyValue: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Valor total</Label>
              <CurrencyInput value={vm.formData.totalValue} onChange={(val) => vm.setFormData({ totalValue: val })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Índice de reajuste</Label>
              <DynamicSelect
                staticOptions={vm.adjustmentIndexOptions}
                dynamicOptions={vm.adjustmentIndexDynamicOptions}
                value={vm.formData.adjustmentIndex}
                onChange={(val) => vm.setFormData({ adjustmentIndex: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddAdjustmentIndex}
                onDelete={vm.isAdmin ? vm.handleDeleteAdjustmentIndex : undefined}
                deleteConfirmTitle="Excluir índice de reajuste"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Periodicidade do reajuste</Label>
              <DynamicSelect
                staticOptions={vm.adjustmentPeriodicityOptions}
                dynamicOptions={vm.adjustmentPeriodicityDynamicOptions}
                value={vm.formData.adjustmentPeriodicity}
                onChange={(val) => vm.setFormData({ adjustmentPeriodicity: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddAdjustmentPeriodicity}
                onDelete={vm.isAdmin ? vm.handleDeleteAdjustmentPeriodicity : undefined}
                deleteConfirmTitle="Excluir periodicidade de reajuste"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Moeda</Label>
              <DynamicSelect
                staticOptions={vm.currencyOptions}
                dynamicOptions={vm.currencyDynamicOptions}
                value={vm.formData.currency}
                onChange={(val) => vm.setFormData({ currency: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddCurrency}
                onDelete={vm.isAdmin ? vm.handleDeleteCurrency : undefined}
                deleteConfirmTitle="Excluir moeda"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Forma de pagamento</Label>
              <DynamicSelect
                staticOptions={vm.paymentMethodOptions}
                dynamicOptions={vm.paymentMethodDynamicOptions}
                value={vm.formData.paymentMethod}
                onChange={(val) => vm.setFormData({ paymentMethod: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddPaymentMethod}
                onDelete={vm.isAdmin ? vm.handleDeletePaymentMethod : undefined}
                deleteConfirmTitle="Excluir forma de pagamento"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Dia do vencimento</Label>
              <Input type="number" min={1} max={31} value={vm.formData.dueDay} onChange={(e) => vm.setFormData({ dueDay: e.target.value })} placeholder="1-31" />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Número de parcelas</Label>
              <Input type="number" min={1} value={vm.formData.installments} onChange={(e) => vm.setFormData({ installments: e.target.value })} />
            </S.FormGroup>

            <S.SectionTitle>Dados bancários</S.SectionTitle>
            <S.FormGroup>
              <Label>Banco</Label>
              <DynamicSelect
                dynamicOptions={vm.bankOptions}
                value={vm.formData.bank}
                onChange={(val) => vm.setFormData({ bank: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddBank}
                onDelete={vm.isAdmin ? vm.handleDeleteBank : undefined}
                deleteConfirmTitle="Excluir banco"
              />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Conta bancária (agência / número)</Label>
              <Input value={vm.formData.bankAccount} onChange={(e) => vm.setFormData({ bankAccount: e.target.value })} placeholder="0000 / 00000-0" />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Chave PIX</Label>
              <Input value={vm.formData.pixKey} onChange={(e) => vm.setFormData({ pixKey: e.target.value })} />
            </S.FormGroup>
            <S.FormGroup>
              <Label>Centro de custo</Label>
              <DynamicSelect
                dynamicOptions={vm.costCenterOptions}
                value={vm.formData.costCenter}
                onChange={(val) => vm.setFormData({ costCenter: val })}
                placeholder="Selecione ou adicione..."
                onAdd={vm.handleAddCostCenter}
                onDelete={vm.isAdmin ? vm.handleDeleteCostCenter : undefined}
                deleteConfirmTitle="Excluir centro de custo"
              />
            </S.FormGroup>

            {vm.customFields.length > 0 && (
              <>
                <S.SectionTitle>Campos adicionais</S.SectionTitle>
                <S.FormGroup $fullWidth>
                  <CustomFieldsSection
                    screenKey="contracts"
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

        {vm.activeTab === 'cases' && !vm.isNew && (
          <>
            <S.CaseLinkControl>
              <SearchSelect
                options={vm.unlinkedCaseOptions}
                value={vm.caseToAdd}
                onChange={(val) => void vm.handleLinkCase(val)}
                placeholder="Vincular um processo..."
              />
            </S.CaseLinkControl>

            {vm.linkedCases.length === 0 ? (
              <S.EmptyState>
                <S.EmptyIcon><RiFolderLine /></S.EmptyIcon>
                <div>Nenhum processo vinculado a este contrato.</div>
              </S.EmptyState>
            ) : (
              <S.DocList>
                {vm.linkedCases.map((c) => (
                  <S.DocRow key={c.id}>
                    <S.DocIcon><RiFolderLine /></S.DocIcon>
                    <S.DocContent>
                      <S.CaseLink type="button" onClick={() => vm.handleOpenCase(c)} title={c.title}>
                        {c.caseNumber}
                      </S.CaseLink>
                      <S.DocMeta>{c.title}</S.DocMeta>
                    </S.DocContent>
                    <Badge color={vm.getCaseStatusColor(c.status)}>{c.status}</Badge>
                    <S.DocActions>
                      <Button variant="ghost" size="sm" onClick={() => vm.handleOpenCase(c)} title="Abrir processo">
                        <RiExternalLinkLine size={14} />
                      </Button>
                      {vm.isAdmin && (
                        <Button variant="ghost" size="sm" onClick={() => void vm.handleUnlinkCase(c)} title="Desvincular processo">
                          <RiLinkUnlinkM size={14} />
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

      {vm.isTagManagerOpen && vm.contract && (
        <TagManager
          entityId={vm.contract.id}
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
        isOpen={!!vm.contractToDelete}
        onConfirm={() => void vm.confirmDeleteContract()}
        onCancel={vm.cancelDeleteContract}
        title="Excluir Contrato"
        message={`Tem certeza que deseja excluir "${vm.contractToDelete?.title}"? Todos os dados do contrato serão perdidos.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
