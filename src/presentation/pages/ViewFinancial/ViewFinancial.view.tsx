import React from 'react';
import {
  RiMoneyDollarCircleLine,
  RiDeleteBinLine,
  RiLinkM,
  RiCheckLine,
} from 'react-icons/ri';
import { S } from './ViewFinancial.styles';
import { useViewFinancialViewModel } from './ViewFinancial.viewmodel';
import { Button } from '../../components/ui/Button';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { DynamicSelect } from '../../components/ui/DynamicSelect';
import { CurrencyInput } from '../../components/ui/CurrencyInput';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import type { FinancialType } from '../../../domain/entities';

export const ViewFinancialView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewFinancialViewModel(tabKey);

  const isIncome = vm.formData.type === 'Receita';

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Avatar $type={isIncome ? 'income' : 'expense'}>
            <RiMoneyDollarCircleLine size={22} />
          </S.Avatar>
          <S.HeaderInfo>
            <S.Title>{vm.isNew ? 'Novo Lançamento' : (vm.financial?.category ?? 'Lançamento')}</S.Title>
            {!vm.isNew && vm.financial && (
              <S.SubTitle $type={vm.financial.type === 'Receita' ? 'income' : 'expense'}>
                {vm.financial.type === 'Receita' ? '+' : '-'}{' '}
                {vm.financial.amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </S.SubTitle>
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
              {vm.isAdmin && (
                <Button variant="danger" size="sm" onClick={vm.handleDeleteFinancial}>
                  <RiDeleteBinLine size={14} />
                  Excluir
                </Button>
              )}
            </>
          )}
        </S.HeaderActions>
      </S.Header>

      <S.Content>
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
              onDelete={vm.handleDeleteCategory}
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
            <Input
              type="date"
              value={vm.formData.dueDate}
              onChange={(e) => vm.setFormData({ dueDate: e.target.value })}
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
              onDelete={vm.handleDeleteStatus}
              deleteConfirmTitle="Excluir status"
            />
          </S.FormGroup>

          <S.FormGroup>
            <Label>Data de Pagamento</Label>
            <Input
              type="date"
              value={vm.formData.paymentDate}
              onChange={(e) => vm.setFormData({ paymentDate: e.target.value })}
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
              onDelete={vm.handleDeleteCostCenter}
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

          <S.FormActions>
            <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
              {vm.isSaving ? 'Salvando...' : vm.isNew ? 'Criar Lançamento' : 'Salvar Alterações'}
            </Button>
          </S.FormActions>
        </S.FormGrid>
      </S.Content>

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
