import React from 'react';
import {
  RiMoneyDollarCircleLine,
  RiAddLine,
  RiEditLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiArrowUpLine,
  RiArrowDownLine,
} from 'react-icons/ri';
import { S } from './Financials.styles';
import { useFinancialsViewModel } from './Financials.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { Modal } from '../../components/ui/Modal';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Input, Label, Textarea } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { SearchSelect } from '../../components/ui/SearchSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import type { FinancialType, FinancialStatus, FinancialCategory, PaymentMethod } from '../../../domain/entities';

const STATUSES: FinancialStatus[] = ['Pendente', 'Pago', 'Vencido', 'Cancelado'];
const CATEGORIES: FinancialCategory[] = ['Honorários', 'Êxito', 'Mensalidade', 'Custas Judiciais', 'Perícia', 'Deslocamento', 'Escritório', 'Impostos', 'Outros'];
const PAYMENT_METHODS: PaymentMethod[] = ['PIX', 'Transferência', 'Dinheiro', 'Cartão', 'Cheque', 'Outro'];

const CATEGORY_OPTIONS: SearchSelectOption[] = CATEGORIES.map((c) => ({ value: c, label: c }));
const PAYMENT_METHOD_OPTIONS: SearchSelectOption[] = PAYMENT_METHODS.map((m) => ({ value: m, label: m }));

export const FinancialsView: React.FC = () => {
  const vm = useFinancialsViewModel();

  const STATUS_OPTIONS: SearchSelectOption[] = STATUSES.map((s) => ({
    value: s,
    label: s,
    color: vm.getStatusColor(s),
  }));

  const caseOptions: SearchSelectOption[] = vm.caseOptions.map((o) => ({ value: o.value, label: o.label }));
  const personOptions: SearchSelectOption[] = vm.personOptions.map((o) => ({ value: o.value, label: o.label }));

  return (
    <S.Page>
      <S.Header>
        <S.Title>Financeiro</S.Title>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="secondary" onClick={() => vm.openCreateModal('Despesa')}>
            <RiArrowDownLine size={16} />
            Despesa
          </Button>
          <Button onClick={() => vm.openCreateModal('Receita')}>
            <RiArrowUpLine size={16} />
            Receita
          </Button>
        </div>
      </S.Header>

      <S.SummaryBar>
        <S.SummaryCard $color="#22c55e">
          <S.SummaryLabel>Receitas Pagas</S.SummaryLabel>
          <S.SummaryValue $color="#22c55e">{vm.formatAmount(vm.summary.totalIncome)}</S.SummaryValue>
        </S.SummaryCard>
        <S.SummaryCard $color="#ef4444">
          <S.SummaryLabel>Despesas Pagas</S.SummaryLabel>
          <S.SummaryValue $color="#ef4444">{vm.formatAmount(vm.summary.totalExpense)}</S.SummaryValue>
        </S.SummaryCard>
        <S.SummaryCard $color={vm.summary.balance >= 0 ? '#22c55e' : '#ef4444'}>
          <S.SummaryLabel>Saldo</S.SummaryLabel>
          <S.SummaryValue $color={vm.summary.balance >= 0 ? '#22c55e' : '#ef4444'}>
            {vm.formatAmount(vm.summary.balance)}
          </S.SummaryValue>
        </S.SummaryCard>
      </S.SummaryBar>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar lançamentos..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredFinancials.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiMoneyDollarCircleLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhum lançamento encontrado</S.EmptyTitle>
            <div style={{ display: 'flex', gap: '8px' }}>
              <Button variant="secondary" onClick={() => vm.openCreateModal('Despesa')}>
                <RiAddLine size={14} /> Despesa
              </Button>
              <Button onClick={() => vm.openCreateModal('Receita')}>
                <RiAddLine size={14} /> Receita
              </Button>
            </div>
          </S.EmptyState>
        ) : (
          <S.Table>
            {vm.filteredFinancials.map((f) => {
              const overdue = vm.isOverdue(f);
              return (
                <S.FinancialRow key={f.id}>
                  <S.FinancialMain>
                    <S.FinancialDescription>{f.description}</S.FinancialDescription>
                    <S.FinancialMeta>
                      <Badge color={vm.getTypeColor(f.type)}>
                        {f.type}
                      </Badge>
                      <Badge color={vm.getStatusColor(overdue ? 'Vencido' : f.status)}>
                        {overdue ? 'Vencido' : f.status}
                      </Badge>
                      <span>{f.category}</span>
                      <span>Venc: {f.dueDate.toLocaleDateString('pt-BR')}</span>
                      {f.paymentDate && <span>Pago: {f.paymentDate.toLocaleDateString('pt-BR')}</span>}
                      {f.personName && <span>{f.personName}</span>}
                      {f.caseNumber && <span>{f.caseNumber}</span>}
                    </S.FinancialMeta>
                  </S.FinancialMain>

                  <S.Amount $type={f.type === 'Receita' ? 'income' : 'expense'}>
                    {f.type === 'Receita' ? '+' : '-'} {vm.formatAmount(f.amount)}
                  </S.Amount>

                  <S.Actions>
                    {f.status === 'Pendente' && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => void vm.handleMarkPaid(f)}
                        title="Registrar pagamento"
                      >
                        <RiCheckLine size={14} />
                      </Button>
                    )}
                    <Button variant="ghost" size="sm" onClick={() => vm.openEditModal(f)}>
                      <RiEditLine size={14} />
                    </Button>
                    <Button variant="danger" size="sm" onClick={() => vm.handleDelete(f)}>
                      <RiDeleteBinLine size={14} />
                    </Button>
                  </S.Actions>
                </S.FinancialRow>
              );
            })}
          </S.Table>
        )}
      </S.Content>

      {vm.isModalOpen && (
        <Modal
          onClose={vm.closeModal}
          title={vm.editingFinancial ? 'Editar Lançamento' : `Novo Lançamento — ${vm.formData.type}`}
        >
          <S.FormGrid>
            <S.FormGroup $fullWidth>
              <Label>Tipo</Label>
              <S.TypeToggle>
                <S.TypeButton
                  $active={vm.formData.type === 'Receita'}
                  $income
                  onClick={() => vm.setFormData({ type: 'Receita' as FinancialType })}
                >
                  Receita
                </S.TypeButton>
                <S.TypeButton
                  $active={vm.formData.type === 'Despesa'}
                  onClick={() => vm.setFormData({ type: 'Despesa' as FinancialType })}
                >
                  Despesa
                </S.TypeButton>
              </S.TypeToggle>
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Descrição *</Label>
              <Input
                value={vm.formData.description}
                onChange={(e) => vm.setFormData({ description: e.target.value })}
                placeholder="Ex: Honorários — João Silva"
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Categoria</Label>
              <SearchSelect
                options={CATEGORY_OPTIONS}
                value={vm.formData.category}
                onChange={(val) => vm.setFormData({ category: val as FinancialCategory })}
                placeholder="Selecione a categoria..."
              />
            </S.FormGroup>

            <S.FormGroup>
              <Label>Valor (R$) *</Label>
              <Input
                type="number"
                value={vm.formData.amount}
                onChange={(e) => vm.setFormData({ amount: e.target.value })}
                placeholder="0,00"
                min="0"
                step="0.01"
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
              <Label>Status</Label>
              <SearchSelect
                options={STATUS_OPTIONS}
                value={vm.formData.status}
                onChange={(val) => vm.setFormData({ status: val as FinancialStatus })}
                placeholder="Selecione o status..."
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
                options={PAYMENT_METHOD_OPTIONS}
                value={vm.formData.paymentMethod}
                onChange={(val) => vm.setFormData({ paymentMethod: val as PaymentMethod })}
                placeholder="Selecione..."
              />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Processo (opcional)</Label>
              <SearchSelect
                options={caseOptions}
                value={vm.formData.caseId}
                onChange={(val) => vm.setFormData({ caseId: val })}
                placeholder="Nenhum processo"
              />
            </S.FormGroup>

            <S.FormGroup $fullWidth>
              <Label>Pessoa (opcional)</Label>
              <SearchSelect
                options={personOptions}
                value={vm.formData.personId}
                onChange={(val) => vm.setFormData({ personId: val })}
                placeholder="Nenhuma pessoa"
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

            <S.FormGroup $fullWidth>
              <Label>Observações</Label>
              <Textarea
                value={vm.formData.notes}
                onChange={(e) => vm.setFormData({ notes: e.target.value })}
                placeholder="Informações adicionais"
              />
            </S.FormGroup>
          </S.FormGrid>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '24px' }}>
            <Button variant="secondary" onClick={vm.closeModal}>Cancelar</Button>
            <Button onClick={() => void vm.handleSave()} disabled={vm.isSaving}>
              {vm.isSaving ? 'Salvando...' : vm.editingFinancial ? 'Salvar Alterações' : 'Criar Lançamento'}
            </Button>
          </div>
        </Modal>
      )}

      <ConfirmModal
        isOpen={!!vm.financialToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja excluir "${vm.financialToDelete?.description}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
