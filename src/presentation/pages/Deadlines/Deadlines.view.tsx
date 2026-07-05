import React from 'react';
import {
  RiTimeLine,
  RiAddLine,
  RiDeleteBinLine,
  RiCheckLine,
  RiCalendarCheckLine,
  RiScalesLine,
  RiAlertLine,
  RiExternalLinkLine,
} from 'react-icons/ri';
import { S } from './Deadlines.styles';
import { useDeadlinesViewModel } from './Deadlines.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import type { Deadline } from '../../../domain/entities';

export const DeadlinesView: React.FC = () => {
  const vm = useDeadlinesViewModel();

  const renderDaysChip = (d: Deadline) => {
    if (d.status === 'Concluído') {
      return <S.DaysChip $completed>Concluído</S.DaysChip>;
    }
    if (d.status === 'Cancelado') {
      return <S.DaysChip>Cancelado</S.DaysChip>;
    }
    const days = vm.getDaysUntilDue(d);
    const overdue = vm.isOverdue(d);
    const today = vm.isToday(d);

    if (overdue) {
      return (
        <S.DaysChip $overdue>
          <RiAlertLine size={10} style={{ marginRight: 2 }} />
          {Math.abs(days)}d vencido
        </S.DaysChip>
      );
    }
    if (today) return <S.DaysChip $today>Hoje</S.DaysChip>;
    if (days === 1) return <S.DaysChip $today>Amanhã</S.DaysChip>;
    return <S.DaysChip>{days}d</S.DaysChip>;
  };

  return (
    <S.Page>
      <S.Header>
        <S.Title>Prazos</S.Title>
        <Button onClick={vm.openNewDeadline} title="Novo Prazo">
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar prazos..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredDeadlines.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiTimeLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhum prazo encontrado</S.EmptyTitle>
            <Button onClick={vm.openNewDeadline} variant="secondary">
              <RiAddLine size={14} />
              Cadastrar primeiro prazo
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
            {vm.filteredDeadlines.map((d) => {
              const priorityColor = vm.getPriorityColor(d.priority);
              const overdue = vm.isOverdue(d);
              const today = vm.isToday(d);

              return (
                <S.DeadlineCard key={d.id} onClick={() => vm.openDeadline(d)}>
                  <S.PriorityBar $color={priorityColor} />

                  <S.CardBody>
                    <S.CardTop>
                      <S.CardAvatar $color={priorityColor}>
                        <RiTimeLine size={20} />
                      </S.CardAvatar>

                      <S.CardInfo>
                        <S.CardType>{d.type}</S.CardType>
                        <S.CardCaseRow>
                          {d.caseNumber && (
                            <S.CardCaseNumber
                              title={`Abrir processo ${d.caseNumber}`}
                              onClick={(e) => { e.stopPropagation(); vm.openCase(d.caseId); }}
                            >
                              {d.caseNumber}
                            </S.CardCaseNumber>
                          )}
                          {renderDaysChip(d)}
                        </S.CardCaseRow>
                      </S.CardInfo>
                    </S.CardTop>
                  </S.CardBody>

                  <S.CardDivider />

                  <S.CardMeta>
                    <S.MetaRow>
                      <RiScalesLine size={12} />
                      <S.MetaBadge $color={vm.getStatusColor(d.status)}>{d.status}</S.MetaBadge>
                      <S.MetaBadge $color={priorityColor}>{d.priority}</S.MetaBadge>
                    </S.MetaRow>

                    {d.caseTitle && (
                      <S.MetaRow>
                        <RiExternalLinkLine size={12} />
                        <S.MetaText>{d.caseTitle}</S.MetaText>
                      </S.MetaRow>
                    )}

                    <S.MetaRow>
                      <RiCalendarCheckLine size={12} />
                      <S.MetaText style={{ color: overdue ? undefined : (today ? undefined : undefined) }}>
                        {d.dueDate.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                        {d.completedAt && ` · Concluído em ${d.completedAt.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })}`}
                      </S.MetaText>
                    </S.MetaRow>

                    {d.responsibleLawyerName && (
                      <S.MetaRow>
                        <RiScalesLine size={12} />
                        <S.MetaText>{d.responsibleLawyerName}</S.MetaText>
                      </S.MetaRow>
                    )}

                    {d.description && (
                      <S.MetaRow>
                        <S.MetaText style={{ fontStyle: 'italic' }}>{d.description}</S.MetaText>
                      </S.MetaRow>
                    )}
                  </S.CardMeta>

                  <CustomFieldMetaRows items={vm.getCustomFieldItems(d)} />

                  {d.status !== 'Concluído' && d.status !== 'Cancelado' && (
                    <S.CompleteBtn
                      className="deadline-complete-btn"
                      title="Marcar como concluído"
                      onClick={(e) => { e.stopPropagation(); vm.handleComplete(d); }}
                    >
                      <RiCheckLine size={13} />
                    </S.CompleteBtn>
                  )}

                  <S.DeleteBtn
                    className="deadline-delete-btn"
                    title="Excluir prazo"
                    onClick={(e) => { e.stopPropagation(); vm.handleDelete(d); }}
                  >
                    <RiDeleteBinLine size={13} />
                  </S.DeleteBtn>
                </S.DeadlineCard>
              );
            })}
          </S.Grid>
        )}
      </S.Content>

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
    </S.Page>
  );
};
