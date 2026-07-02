import React from 'react';
import {
  RiMoneyDollarCircleLine,
  RiAddLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCalendarCheckLine,
  RiTeamLine,
  RiFolderLine,
  RiFileTextLine,
  RiWalletLine,
  RiEyeLine,
  RiEyeOffLine,
} from 'react-icons/ri';
import { S } from './Financials.styles';
import { useFinancialsViewModel } from './Financials.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { Spinner } from '../../components/ui/Spinner';

export const FinancialsView: React.FC = () => {
  const vm = useFinancialsViewModel();

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
        <Button onClick={vm.openCreateTab}>
          <RiAddLine size={16} />
          Novo Lançamento
        </Button>
      </S.Header>

      {vm.isSummaryVisible && (
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
              const overdue = vm.isOverdue(f);
              const status = overdue ? 'Vencido' : f.status;
              return (
                <S.FinancialCard key={f.id} onClick={() => vm.openFinancial(f)}>
                  <S.CardHeader>
                    <S.CardTitle>{f.category}</S.CardTitle>
                  </S.CardHeader>

                  <S.Badges>
                    <Badge color={vm.getStatusColor(status)}>{status}</Badge>
                  </S.Badges>

                  <S.CardMeta>
                    <S.MetaRow>
                      <RiCalendarCheckLine size={12} />
                      <S.MetaText>Venc: {f.dueDate.toLocaleDateString('pt-BR')}</S.MetaText>
                      {f.paymentDate && <S.MetaText>· Pago: {f.paymentDate.toLocaleDateString('pt-BR')}</S.MetaText>}
                    </S.MetaRow>
                    {f.personName && (
                      <S.MetaRow>
                        <RiTeamLine size={12} />
                        <S.MetaLink
                          title={`Abrir pessoa ${f.personName}`}
                          onClick={(e) => { e.stopPropagation(); vm.openPerson(f.personId); }}
                        >
                          {f.personName}
                        </S.MetaLink>
                      </S.MetaRow>
                    )}
                    {f.caseNumber && (
                      <S.MetaRow>
                        <RiFolderLine size={12} />
                        <S.MetaLink
                          title={`Abrir processo ${f.caseNumber}`}
                          onClick={(e) => { e.stopPropagation(); vm.openCase(f.caseId); }}
                        >
                          {f.caseNumber}
                        </S.MetaLink>
                      </S.MetaRow>
                    )}
                    {f.contractNumber && (
                      <S.MetaRow>
                        <RiFileTextLine size={12} />
                        <S.MetaLink
                          title={`Abrir contrato ${f.contractNumber}`}
                          onClick={(e) => { e.stopPropagation(); vm.openContract(f.contractId); }}
                        >
                          {f.contractNumber}
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

                  <S.BottomRow>
                    <S.Amount $type={f.type === 'Receita' ? 'income' : 'expense'}>
                      {f.type === 'Receita' ? '+' : '-'} {vm.formatAmount(f.amount)}
                    </S.Amount>
                  </S.BottomRow>

                  {f.status === 'Pendente' && (
                    <S.CompleteBtn
                      className="financial-complete-btn"
                      title="Registrar pagamento"
                      onClick={(e) => { e.stopPropagation(); void vm.handleMarkPaid(f); }}
                    >
                      <RiCheckLine size={13} />
                    </S.CompleteBtn>
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
