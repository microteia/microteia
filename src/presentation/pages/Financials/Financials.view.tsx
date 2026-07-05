import React from 'react';
import {
  RiMoneyDollarCircleLine,
  RiAddLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiArrowGoBackLine,
  RiCloseCircleLine,
  RiCalendarCheckLine,
  RiTeamLine,
  RiFolderLine,
  RiFileTextLine,
  RiWalletLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLineChartLine,
} from 'react-icons/ri';
import { S } from './Financials.styles';
import { useFinancialsViewModel } from './Financials.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { useFinancialTagStore } from '../../../stores/useFinancialTagStore';

export const FinancialsView: React.FC = () => {
  const vm = useFinancialsViewModel();
  const { tags } = useFinancialTagStore();

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.Title>Financeiro</S.Title>
          <Button variant="ghost" size="sm" onClick={vm.toggleSummaryVisible} title={vm.isSummaryVisible ? 'Ocultar totais' : 'Mostrar totais'}>
            {vm.isSummaryVisible ? <RiEyeOffLine size={14} /> : <RiEyeLine size={14} />}
            {vm.isSummaryVisible ? 'Ocultar totais' : 'Mostrar totais'}
          </Button>
        </S.HeaderLeft>
        <S.HeaderRight>
          <Button variant="secondary" onClick={vm.openFinancialDashboard}>
            <RiLineChartLine size={16} />
            Dashboard
          </Button>
          <Button onClick={vm.openCreateTab} title="Novo Lançamento">
            <RiAddLine size={16} />
          </Button>
        </S.HeaderRight>
      </S.Header>

      {vm.isSummaryVisible && (
        <S.SummaryBar>
          <S.SummaryCard $color={vm.getTypeColor('Receita')}>
            <S.SummaryLabel>Receitas Pagas</S.SummaryLabel>
            <S.SummaryValue $color={vm.getTypeColor('Receita')}>{vm.formatAmount(vm.summary.totalIncome)}</S.SummaryValue>
          </S.SummaryCard>
          <S.SummaryCard $color={vm.getTypeColor('Despesa')}>
            <S.SummaryLabel>Despesas Pagas</S.SummaryLabel>
            <S.SummaryValue $color={vm.getTypeColor('Despesa')}>{vm.formatAmount(vm.summary.totalExpense)}</S.SummaryValue>
          </S.SummaryCard>
          <S.SummaryCard $color={vm.summary.balance >= 0 ? vm.getTypeColor('Receita') : vm.getTypeColor('Despesa')}>
            <S.SummaryLabel>Saldo</S.SummaryLabel>
            <S.SummaryValue $color={vm.summary.balance >= 0 ? vm.getTypeColor('Receita') : vm.getTypeColor('Despesa')}>
              {vm.formatAmount(vm.summary.balance)}
            </S.SummaryValue>
          </S.SummaryCard>
          <S.SummaryCard $color={vm.getTypeColor('Receita')}>
            <S.SummaryLabel>Receitas a Receber</S.SummaryLabel>
            <S.SummaryValue $color={vm.getTypeColor('Receita')}>{vm.formatAmount(vm.summary.pendingIncome)}</S.SummaryValue>
          </S.SummaryCard>
          <S.SummaryCard $color={vm.getTypeColor('Despesa')}>
            <S.SummaryLabel>Despesas a Pagar</S.SummaryLabel>
            <S.SummaryValue $color={vm.getTypeColor('Despesa')}>{vm.formatAmount(vm.summary.pendingExpense)}</S.SummaryValue>
          </S.SummaryCard>
          <S.SummaryCard $color={vm.summary.projectedBalance >= 0 ? vm.getTypeColor('Receita') : vm.getTypeColor('Despesa')}>
            <S.SummaryLabel>Saldo Projetado</S.SummaryLabel>
            <S.SummaryValue $color={vm.summary.projectedBalance >= 0 ? vm.getTypeColor('Receita') : vm.getTypeColor('Despesa')}>
              {vm.formatAmount(vm.summary.projectedBalance)}
            </S.SummaryValue>
          </S.SummaryCard>
        </S.SummaryBar>
      )}

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
            <Button onClick={vm.openCreateTab} variant="secondary">
              <RiAddLine size={14} />
              Cadastrar primeiro lançamento
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
            {vm.filteredFinancials.map((f) => {
              const financialTags = tags.filter((t) => f.tagIds?.includes(t.id));
              const personName = vm.getPersonName(f);
              const caseNumber = vm.getCaseNumber(f);
              const contractNumber = vm.getContractNumber(f);
              return (
                <S.FinancialCard key={f.id} onClick={() => vm.openFinancial(f)}>
                  <S.CardHeader>
                    <S.CardTitle>{f.category}</S.CardTitle>
                  </S.CardHeader>

                  <S.Badges>
                    <Badge color={vm.getCardStatusColor(f)}>{f.status}</Badge>
                  </S.Badges>

                  <S.CardMeta>
                    <S.MetaRow>
                      <RiCalendarCheckLine size={12} />
                      <S.MetaText title="Data de vencimento" $color={vm.getStatusColor('Aberto')}>{f.dueDate.toLocaleDateString('pt-BR')}</S.MetaText>
                      {f.paymentDate && <S.MetaText title="Data de pagamento" $color={vm.getStatusColor('Pago')}>· {f.paymentDate.toLocaleDateString('pt-BR')}</S.MetaText>}
                      {f.cancelDate && <S.MetaText title="Data de cancelamento" $color={vm.getStatusColor('Cancelado')}>· {f.cancelDate.toLocaleDateString('pt-BR')}</S.MetaText>}
                    </S.MetaRow>
                    {personName && (
                      <S.MetaRow>
                        <RiTeamLine size={12} />
                        <S.MetaLink
                          title={`Abrir pessoa ${personName}`}
                          onClick={(e) => { e.stopPropagation(); vm.openPerson(f.personId); }}
                        >
                          {personName}
                        </S.MetaLink>
                      </S.MetaRow>
                    )}
                    {caseNumber && (
                      <S.MetaRow>
                        <RiFolderLine size={12} />
                        <S.MetaLink
                          title={`Abrir processo ${caseNumber}`}
                          onClick={(e) => { e.stopPropagation(); vm.openCase(f.caseId); }}
                        >
                          {caseNumber}
                        </S.MetaLink>
                      </S.MetaRow>
                    )}
                    {contractNumber && (
                      <S.MetaRow>
                        <RiFileTextLine size={12} />
                        <S.MetaLink
                          title={`Abrir contrato ${contractNumber}`}
                          onClick={(e) => { e.stopPropagation(); vm.openContract(f.contractId); }}
                        >
                          {contractNumber}
                        </S.MetaLink>
                      </S.MetaRow>
                    )}
                    {f.costCenter && (
                      <S.MetaRow>
                        <RiWalletLine size={12} />
                        <S.MetaText>{f.costCenter}</S.MetaText>
                      </S.MetaRow>
                    )}
                  </S.CardMeta>

                  <CustomFieldMetaRows items={vm.getCustomFieldItems(f)} />

                  {financialTags.length > 0 && (
                    <S.Tags onClick={(e) => e.stopPropagation()}>
                      {financialTags.map((t) => (
                        <S.TagPill key={t.id} $color={t.color}>
                          <S.TagDot $color={t.color} />
                          {t.name}
                        </S.TagPill>
                      ))}
                    </S.Tags>
                  )}

                  <S.BottomRow>
                    <S.Amount $type={f.type}>
                      {f.type === 'Receita' ? '+' : '-'} {vm.formatAmount(f.amount)}
                    </S.Amount>
                  </S.BottomRow>

                  {f.status === 'Aberto' && (
                    <S.CompleteBtn
                      className="financial-complete-btn"
                      title="Registrar pagamento"
                      onClick={(e) => { e.stopPropagation(); void vm.handleMarkPaid(f); }}
                    >
                      <RiCheckLine size={13} />
                    </S.CompleteBtn>
                  )}

                  {f.status === 'Pago' && (
                    <S.CancelPaymentBtn
                      className="financial-cancel-payment-btn"
                      title="Cancelar pagamento"
                      onClick={(e) => { e.stopPropagation(); void vm.handleCancelPayment(f); }}
                    >
                      <RiArrowGoBackLine size={13} />
                    </S.CancelPaymentBtn>
                  )}

                  {f.status !== 'Cancelado' && (
                    <S.CancelFinancialBtn
                      className="financial-cancel-financial-btn"
                      title="Registrar cancelamento"
                      onClick={(e) => { e.stopPropagation(); void vm.handleRegisterCancellation(f); }}
                    >
                      <RiCloseCircleLine size={13} />
                    </S.CancelFinancialBtn>
                  )}

                  <S.DeleteBtn
                    className="financial-delete-btn"
                    title="Excluir lançamento"
                    onClick={(e) => { e.stopPropagation(); vm.handleDelete(f); }}
                  >
                    <RiDeleteBinLine size={13} />
                  </S.DeleteBtn>
                </S.FinancialCard>
              );
            })}
          </S.Grid>
        )}
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.financialToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Lançamento"
        message={`Tem certeza que deseja excluir o lançamento "${vm.financialToDelete?.category}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
