import React, { useRef } from 'react';
import {
  RiMoneyDollarCircleLine,
  RiDeleteBinLine,
  RiLinkM,
  RiCheckLine,
  RiFileCopyLine,
  RiFileTextLine,
  RiUploadLine,
  RiExternalLinkLine,
  RiCloseLine,
  RiPriceTag3Line,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './ViewFinancial.styles';
import { useViewFinancialViewModel } from './ViewFinancial.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { DateInput } from '../../components/ui/DateInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { FinancialType } from '../../../domain/entities';

export const ViewFinancialView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewFinancialViewModel(tabKey);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const appliedTags = vm.financial ? vm.tagAdapter.getAppliedTags(vm.financial.id) : [];

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar $type={vm.formData.type}>
            <RiMoneyDollarCircleLine size={22} />
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Novo Lançamento' : (vm.financial?.category ?? 'Lançamento')}</S.Title>
            {!vm.isNew && vm.financial && (
              <S.SubTitle $type={vm.financial.type}>
                {vm.financial.type === 'Receita' ? '+' : '-'}{' '}
                {vm.financial.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </S.SubTitle>
            )}
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
            <Button
              size="sm"
              onClick={() => void vm.handleSave()}
              disabled={vm.isSaving}
              $isLoading={vm.isSaving}
              title={vm.isSaving ? 'Salvando...' : vm.isNew ? 'Criar Lançamento' : 'Salvar Alterações'}
            >
              <RiSaveLine size={14} />
            </Button>
          )}
          {!vm.isNew && vm.isAdmin && (
            <Button variant="danger" size="sm" onClick={vm.handleDeleteFinancial} title="Excluir Lançamento">
              <RiDeleteBinLine size={14} />
            </Button>
          )}
        </S.HeaderActions>
      </S.Header>

      {!vm.isNew && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'data'} onClick={() => vm.setActiveTab('data')}>Dados</S.TabBtn>
          <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
        </S.TabBar>
      )}

      <S.Content>
        {(vm.activeTab === 'data' || vm.isNew) && (
        <S.FormGrid>
          <S.FormGroup $fullWidth>
            <Label>Tipo</Label>
            <S.TypeToggle>
              <S.TypeOption
                type="button"
                $active={vm.formData.type === 'Receita'}
                $income
                onClick={() => vm.setFormData({ type: 'Receita' as FinancialType })}
              >
                Receita
              </S.TypeOption>
              <S.TypeOption
                type="button"
                $active={vm.formData.type === 'Despesa'}
                onClick={() => vm.setFormData({ type: 'Despesa' as FinancialType })}
              >
                Despesa
              </S.TypeOption>
            </S.TypeToggle>
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
            <Label>Valor (R$) *</Label>
            <CurrencyInput
              value={vm.formData.amount}
              onChange={(val) => vm.setFormData({ amount: val })}
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Data de Vencimento *</Label>
            <DateInput
              value={vm.formData.dueDate}
              onChange={(val) => vm.setFormData({ dueDate: val })}
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
            <Label>Data de Pagamento</Label>
            <DateInput
              value={vm.formData.paymentDate}
              onChange={(val) => vm.setFormData({ paymentDate: val })}
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Data de Cancelamento</Label>
            <DateInput
              value={vm.formData.cancelDate}
              onChange={(val) => vm.setFormData({ cancelDate: val })}
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Forma de Pagamento</Label>
            <SearchSelect
              options={vm.paymentMethodOptions}
              value={vm.formData.paymentMethod}
              onChange={(val) => vm.setFormData({ paymentMethod: val as typeof vm.formData.paymentMethod })}
              placeholder="Selecione..."
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Centro de Custo</Label>
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

          <S.FormGroup>
            <Label>Nº Nota/Recibo</Label>
            <Input
              value={vm.formData.invoiceNumber}
              onChange={(e) => vm.setFormData({ invoiceNumber: e.target.value })}
              placeholder="NF-e, recibo..."
            />
          </S.FormGroup>

          <S.SectionTitle>Vínculos (opcional)</S.SectionTitle>
          <S.FormGroup>
            <Label>Processo</Label>
            <SearchSelect
              options={vm.caseOptions}
              value={vm.formData.caseId}
              onChange={(val) => vm.setFormData({ caseId: val })}
              placeholder="Nenhum processo"
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Pessoa</Label>
            <SearchSelect
              options={vm.personOptions}
              value={vm.formData.personId}
              onChange={(val) => vm.setFormData({ personId: val })}
              placeholder="Nenhuma pessoa"
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Contrato</Label>
            <SearchSelect
              options={vm.contractOptions}
              value={vm.formData.contractId}
              onChange={(val) => vm.setFormData({ contractId: val })}
              placeholder="Nenhum contrato"
            />
          </S.FormGroup>

          <S.FormGroup $fullWidth>
            <Label>Observações</Label>
            <Textarea
              value={vm.formData.notes}
              onChange={(e) => vm.setFormData({ notes: e.target.value })}
              placeholder="Informações adicionais"
            />
          </S.FormGroup>

          {vm.customFields.length > 0 && (
            <>
              <S.SectionTitle>Campos adicionais</S.SectionTitle>
              <S.FormGroup $fullWidth>
                <CustomFieldsSection
                  screenKey="financials"
                  fields={vm.customFields}
                  values={vm.customValues}
                  onChange={vm.setCustomValue}
                />
              </S.FormGroup>
            </>
          )}
        </S.FormGrid>
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

      {vm.isTagManagerOpen && vm.financial && (
        <TagManager
          entityId={vm.financial.id}
          onClose={vm.closeTagManager}
          adapter={vm.tagAdapter}
        />
      )}

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
        isOpen={!!vm.financialToDelete}
        onConfirm={() => void vm.confirmDeleteFinancial()}
        onCancel={vm.cancelDeleteFinancial}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja excluir o lançamento "${vm.financialToDelete?.category}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
