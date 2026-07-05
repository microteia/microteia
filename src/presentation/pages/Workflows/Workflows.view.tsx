import React from 'react';
import { RiFlowChart, RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './Workflows.styles';
import { useWorkflowsViewModel } from './Workflows.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';

export const WorkflowsView: React.FC = () => {
  const vm = useWorkflowsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Automações</S.Title>
        <Button onClick={vm.openNewWorkflow} title="Nova Automação">
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar automações..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredWorkflows.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiFlowChart /></S.EmptyIcon>
            <S.EmptyTitle>Nenhuma automação encontrada</S.EmptyTitle>
            <Button onClick={vm.openNewWorkflow} variant="secondary">
              <RiAddLine size={14} />
              Criar primeira automação
            </Button>
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.filteredWorkflows.map((w) => (
              <S.Row key={w.id} onClick={() => vm.openWorkflow(w)}>
                <S.RowInfo>
                  <S.RowName>{w.name}</S.RowName>
                  <S.RowEvent>{w.eventName}</S.RowEvent>
                </S.RowInfo>
                <S.EnabledBadge
                  $enabled={w.enabled}
                  onClick={(e) => { e.stopPropagation(); vm.toggleEnabled(w); }}
                >
                  {w.enabled ? 'Habilitado' : 'Desabilitado'}
                </S.EnabledBadge>
                <S.DeleteBtn
                  title="Excluir automação"
                  onClick={(e) => { e.stopPropagation(); vm.handleDelete(w); }}
                >
                  <RiDeleteBinLine size={14} />
                </S.DeleteBtn>
              </S.Row>
            ))}
          </S.List>
        )}
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.workflowToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Automação"
        message={`Tem certeza que deseja excluir a automação "${vm.workflowToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
