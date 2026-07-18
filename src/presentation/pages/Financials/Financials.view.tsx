import React from 'react';
import {
  RiMoneyDollarCircleLine,
  RiAddLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiArrowGoBackLine,
  RiCalendarCheckLine,
  RiTeamLine,
  RiFolderLine,
  RiFileTextLine,
  RiEyeLine,
  RiEyeOffLine,
  RiLineChartLine,
} from 'react-icons/ri';
import { S } from './Financials.styles';
import { useFinancialsViewModel } from './Financials.viewmodel';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Badge } from '../../components/ui/Badge';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { EntityListCard, type EntityCardAction } from '../../components/ui/EntityListCard';
import { EntityListView } from '../../components/layout/EntityListView';
import { getScreenIcon } from '../../shared/screenIcons';
import { useListRowResolver } from '../../shared/listRows';
import { useFinancialTagStore } from '../../../stores/useFinancialTagStore';
import { FINANCIAL_LIST_ROWS } from './financialListSchema';

interface CardMetaRow {
  key: string;
  icon: React.ReactNode;
  value: React.ReactNode;
}

export const FinancialsView: React.FC = () => {
  const vm = useFinancialsViewModel();
  const { tags } = useFinancialTagStore();
  const resolveRow = useListRowResolver();

  const headerExtra = (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={vm.toggleSummaryVisible}
        title={vm.isSummaryVisible ? 'Ocultar totais' : 'Mostrar totais'}
      >
        {vm.isSummaryVisible ? <RiEyeOffLine size={14} /> : <RiEyeLine size={14} />}
        {vm.isSummaryVisible ? 'Ocultar totais' : 'Mostrar totais'}
      </Button>
      <Button variant="secondary" onClick={vm.openFinancialDashboard}>
        <RiLineChartLine size={16} />
        Dashboard
      </Button>
    </>
  );

  const summaryCards = [
    { label: 'Receitas Pagas', value: vm.summary.totalIncome, positive: true },
    { label: 'Despesas Pagas', value: vm.summary.totalExpense, positive: false },
    { label: 'Saldo', value: vm.summary.balance, positive: vm.summary.balance >= 0 },
    { label: 'Receitas a Receber', value: vm.summary.pendingIncome, positive: true },
    { label: 'Despesas a Pagar', value: vm.summary.pendingExpense, positive: false },
    { label: 'Saldo Projetado', value: vm.summary.projectedBalance, positive: vm.summary.projectedBalance >= 0 },
  ];

  const summaryBar = vm.isSummaryVisible ? (
    <S.SummaryBar>
      {summaryCards.map((card) => {
        const color = vm.getTypeColor(card.positive ? 'Receita' : 'Despesa');
        return (
          <S.SummaryCard key={card.label} $color={color}>
            <S.SummaryLabel>{card.label}</S.SummaryLabel>
            <S.SummaryValue $color={color}>{vm.formatAmount(card.value)}</S.SummaryValue>
          </S.SummaryCard>
        );
      })}
    </S.SummaryBar>
  ) : undefined;

  const modals = (
    <ConfirmModal
      isOpen={!!vm.financialToDelete}
      onConfirm={() => void vm.confirmDelete()}
      onCancel={vm.cancelDelete}
      title="Excluir Lançamento"
      message={`Tem certeza que deseja excluir o lançamento "${vm.financialToDelete?.category}"? Esta ação não pode ser desfeita.`}
      confirmLabel="Excluir"
      variant="danger"
    />
  );

  return (
    <EntityListView
      title="Financeiro"
      titleIcon={<RiMoneyDollarCircleLine size={22} />}
      onNew={vm.openCreateTab}
      newTitle="Novo Lançamento"
      newIcon={<RiAddLine size={16} />}
      headerExtra={headerExtra}
      belowHeader={summaryBar}
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder="Filtrar lançamentos..."
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading}
      isEmpty={vm.filteredFinancials.length === 0}
      emptyIcon={<RiMoneyDollarCircleLine />}
      emptyTitle="Nenhum lançamento encontrado"
      emptyActionLabel="Cadastrar primeiro lançamento"
      modals={modals}
    >
      {vm.filteredFinancials.map((f) => {
        const financialTags = tags.filter((t) => f.tagIds?.includes(t.id));
        const personName = vm.getPersonName(f);
        const caseNumber = vm.getCaseNumber(f);
        const contractNumber = vm.getContractNumber(f);
        const customItems = vm.getCustomFieldItems(f);
        const record = f as unknown as Record<string, unknown>;

        const actions: EntityCardAction[] = [
          ...(f.status === 'Aberto' ? [{
            key: 'markPaid',
            icon: <RiCheckLine size={13} />,
            title: 'Registrar pagamento',
            onClick: () => { void vm.handleMarkPaid(f); },
          }] : []),
          ...(f.status === 'Pago' ? [{
            key: 'cancelPayment',
            icon: <RiArrowGoBackLine size={13} />,
            title: 'Cancelar pagamento',
            onClick: () => { void vm.handleCancelPayment(f); },
          }] : []),
          {
            key: 'delete',
            icon: <RiDeleteBinLine size={13} />,
            title: 'Excluir lançamento',
            danger: true,
            onClick: () => vm.handleDelete(f),
          },
        ];

        // Compõe vencimento/pagamento/cancelamento numa linha só, com cores distintas.
        const datesRow: CardMetaRow = {
          key: 'dates',
          icon: <RiCalendarCheckLine size={12} />,
          value: (
            <>
              <S.MetaText title="Data de vencimento" $color={vm.getStatusColor('Aberto')}>
                {f.dueDate.toLocaleDateString('pt-BR')}
              </S.MetaText>
              {f.paymentDate && (
                <S.MetaText title="Data de pagamento" $color={vm.getStatusColor('Pago')}>
                  · {f.paymentDate.toLocaleDateString('pt-BR')}
                </S.MetaText>
              )}
              {f.cancelDate && (
                <S.MetaText title="Data de cancelamento" $color={vm.getStatusColor('Cancelado')}>
                  · {f.cancelDate.toLocaleDateString('pt-BR')}
                </S.MetaText>
              )}
            </>
          ),
        };

        // Vínculos são links que abrem o registro — por isso não derivam do schema.
        const linkRows: CardMetaRow[] = [];
        if (personName) {
          linkRows.push({
            key: 'personId',
            icon: <RiTeamLine size={12} />,
            value: (
              <S.MetaLink title={`Abrir pessoa ${personName}`} onClick={(e) => { e.stopPropagation(); vm.openPerson(f.personId); }}>
                {personName}
              </S.MetaLink>
            ),
          });
        }
        if (caseNumber) {
          linkRows.push({
            key: 'caseId',
            icon: <RiFolderLine size={12} />,
            value: (
              <S.MetaLink title={`Abrir processo ${caseNumber}`} onClick={(e) => { e.stopPropagation(); vm.openCase(f.caseId); }}>
                {caseNumber}
              </S.MetaLink>
            ),
          });
        }
        if (contractNumber) {
          linkRows.push({
            key: 'contractId',
            icon: <RiFileTextLine size={12} />,
            value: (
              <S.MetaLink title={`Abrir contrato ${contractNumber}`} onClick={(e) => { e.stopPropagation(); vm.openContract(f.contractId); }}>
                {contractNumber}
              </S.MetaLink>
            ),
          });
        }

        const derivedRows: CardMetaRow[] = FINANCIAL_LIST_ROWS
          .map((row) => ({
            key: row.key,
            icon: getScreenIcon(row.icon, 12),
            value: resolveRow(record, row),
          }))
          .filter((row) => row.value !== '');

        return (
          <EntityListCard
            key={f.id}
            onClick={() => vm.openFinancial(f)}
            avatar={<RiMoneyDollarCircleLine size={22} />}
            title={f.category}
            actions={actions}
            belowHeader={<S.Badges><Badge color={vm.getCardStatusColor(f)}>{f.status}</Badge></S.Badges>}
            metaRows={[datesRow, ...linkRows, ...derivedRows]}
            tags={financialTags}
            extra={customItems.length > 0 ? <CustomFieldMetaRows items={customItems} /> : undefined}
            footer={
              <S.BottomRow>
                <S.Amount $type={f.type}>
                  {f.type === 'Receita' ? '+' : '-'} {vm.formatAmount(f.amount)}
                </S.Amount>
              </S.BottomRow>
            }
          />
        );
      })}
    </EntityListView>
  );
};
