import React from 'react';
import {
  RiTimeLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiAlertLine,
} from 'react-icons/ri';
import { S } from './Deadlines.styles';
import { useDeadlinesViewModel } from './Deadlines.viewmodel';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { EntityListCard, type EntityCardAction } from '../../components/ui/EntityListCard';
import { EntityListView } from '../../components/layout/EntityListView';
import { getScreenIcon } from '../../shared/screenIcons';
import { useListRowResolver } from '../../shared/listRows';
import { DEADLINE_LIST_ROWS } from './deadlineListSchema';
import type { Deadline } from '../../../domain/entities';

export const DeadlinesView: React.FC = () => {
  const vm = useDeadlinesViewModel();
  const resolveRow = useListRowResolver();

  const renderDaysChip = (d: Deadline) => {
    if (d.status === 'Concluído') return <S.DaysChip $completed>Concluído</S.DaysChip>;
    if (d.status === 'Cancelado') return <S.DaysChip>Cancelado</S.DaysChip>;

    const days = vm.getDaysUntilDue(d);
    if (vm.isOverdue(d)) {
      return (
        <S.DaysChip $overdue>
          <RiAlertLine size={10} style={{ marginRight: 2 }} />
          {Math.abs(days)}d vencido
        </S.DaysChip>
      );
    }
    if (vm.isToday(d)) return <S.DaysChip $today>Hoje</S.DaysChip>;
    if (days === 1) return <S.DaysChip $today>Amanhã</S.DaysChip>;
    return <S.DaysChip>{days}d</S.DaysChip>;
  };

  const modals = (
    <>
      <ConfirmModal
        isOpen={!!vm.deadlineToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Prazo"
        message={`Tem certeza que deseja excluir o prazo "${vm.deadlineToDelete?.type}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
      <ConfirmModal
        isOpen={!!vm.deadlineToComplete}
        onConfirm={() => void vm.confirmComplete()}
        onCancel={vm.cancelComplete}
        title="Marcar como Concluído"
        message={`Marcar o prazo "${vm.deadlineToComplete?.type}" como concluído? A data de hoje será registrada como data de conclusão.`}
        confirmLabel="Concluir"
      />
    </>
  );

  return (
    <EntityListView
      title="Prazos"
      titleIcon={<RiTimeLine size={22} />}
      onNew={vm.openNewDeadline}
      newTitle="Novo Prazo"
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder="Filtrar prazos..."
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading}
      isEmpty={vm.filteredDeadlines.length === 0}
      emptyIcon={<RiTimeLine />}
      emptyTitle="Nenhum prazo encontrado"
      emptyActionLabel="Cadastrar primeiro prazo"
      modals={modals}
    >
      {vm.filteredDeadlines.map((d) => {
        const caseInfo = vm.getCaseInfo(d);
        const customItems = vm.getCustomFieldItems(d);
        const record = d as unknown as Record<string, unknown>;
        const isClosed = d.status === 'Concluído' || d.status === 'Cancelado';

        const actions: EntityCardAction[] = [
          ...(isClosed ? [] : [{
            key: 'complete',
            icon: <RiCheckLine size={13} />,
            title: 'Marcar como concluído',
            onClick: () => vm.handleComplete(d),
          }]),
          {
            key: 'delete',
            icon: <RiDeleteBinLine size={13} />,
            title: 'Excluir prazo',
            danger: true,
            onClick: () => vm.handleDelete(d),
          },
        ];

        // Exclusivo do Prazo: badges de situação e prioridade.
        const belowHeader = (
          <S.MetaRow>
            <S.MetaBadge $color={vm.getStatusColor(d.status)}>{d.status}</S.MetaBadge>
            <S.MetaBadge $color={vm.getPriorityColor(d.priority)}>{d.priority}</S.MetaBadge>
          </S.MetaRow>
        );

        const metaRows = DEADLINE_LIST_ROWS
          .map((row) => ({
            key: row.key,
            icon: getScreenIcon(row.icon, 12),
            value: resolveRow(record, row),
          }))
          .filter((row) => row.value !== '');

        return (
          <EntityListCard
            key={d.id}
            onClick={() => vm.openDeadline(d)}
            accentColor={vm.getPriorityColor(d.priority)}
            avatar={<RiTimeLine size={20} />}
            title={d.type}
            subtitle={
              <S.CardCaseRow>
                {caseInfo?.number && (
                  <S.CardCaseNumber
                    title={`Abrir processo ${caseInfo.number}`}
                    onClick={(e) => { e.stopPropagation(); vm.openCase(d.caseId); }}
                  >
                    {caseInfo.number}
                  </S.CardCaseNumber>
                )}
                {renderDaysChip(d)}
              </S.CardCaseRow>
            }
            actions={actions}
            belowHeader={belowHeader}
            metaRows={metaRows}
            extra={customItems.length > 0 ? <CustomFieldMetaRows items={customItems} /> : undefined}
          />
        );
      })}
    </EntityListView>
  );
};
