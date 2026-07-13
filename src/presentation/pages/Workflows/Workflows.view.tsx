import React from 'react';
import { RiFlowChart, RiAddLine, RiDeleteBinLine, RiFileCopyLine, RiGlobalLine } from 'react-icons/ri';
import { S } from './Workflows.styles';
import { useWorkflowsViewModel } from './Workflows.viewmodel';
import { getWorkflowEventIcon } from '../../shared/workflowEventIcons';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';

export const WorkflowsView: React.FC = () => {
  const vm = useWorkflowsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Workflow</S.Title>
        <Button onClick={vm.openNewWorkflow} title="Nova Automação">
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar workflows..."
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
            {vm.filteredWorkflows.map((w) => {
              const EventIcon = getWorkflowEventIcon(w.eventName);
              const isOwn = vm.isOwnWorkflow(w);
              const isPublicWorkflow = 'originalTenantId' in w;
              const rowKey = isPublicWorkflow ? `${w.originalTenantId}-${w.id}` : `${w.tenantId}-${w.id}`;
              const isCopied = vm.isCopiedWorkflow(w);
              const isOutdated = vm.isOutdatedCopy(w);

              return (
                <S.Row key={rowKey} onClick={() => vm.openWorkflow(w)} $clickable={isOwn}>
                  <S.RowIcon><EventIcon size={18} /></S.RowIcon>
                  <S.RowInfo>
                    <S.RowName>{w.name}</S.RowName>
                    <S.RowEvent>{w.eventName}</S.RowEvent>
                    {isPublicWorkflow && !isOwn && (
                      <S.OwnerInfo>
                        {w.ownerPhotoURL && <S.OwnerPhoto src={w.ownerPhotoURL} alt={w.ownerName} />}
                        <S.OwnerName>por {w.ownerName}</S.OwnerName>
                      </S.OwnerInfo>
                    )}
                  </S.RowInfo>
                  {w.isPublic && (
                    <S.PublicBadge title="Workflow Público">
                      <RiGlobalLine size={12} />
                      Público
                    </S.PublicBadge>
                  )}
                  {isOwn && isCopied && (
                    <S.CopyStatusBadge $outdated={isOutdated} title={isOutdated ? 'Workflow desatualizado' : 'Cópia de workflow público'}>
                      {isOutdated ? 'Desatualizado' : 'Cópia'}
                    </S.CopyStatusBadge>
                  )}
                  {isOwn && (
                    <S.EnabledBadge
                      $enabled={w.enabled}
                      onClick={(e) => { e.stopPropagation(); vm.toggleEnabled(w); }}
                    >
                      {w.enabled ? 'Habilitado' : 'Desabilitado'}
                    </S.EnabledBadge>
                  )}
                  {isOwn ? (
                    <S.DeleteBtn
                      title="Excluir automação"
                      onClick={(e) => { e.stopPropagation(); vm.handleDelete(w); }}
                    >
                      <RiDeleteBinLine size={14} />
                    </S.DeleteBtn>
                  ) : (
                    <S.CopyBtn
                      title="Copiar workflow para meu escritório"
                      onClick={(e) => { e.stopPropagation(); void vm.copyPublicWorkflow(w); }}
                    >
                      <RiFileCopyLine size={14} />
                    </S.CopyBtn>
                  )}
                </S.Row>
              );
            })}
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
