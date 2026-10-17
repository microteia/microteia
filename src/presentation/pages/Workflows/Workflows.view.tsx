import React from 'react';
import { RiFlowChart, RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './Workflows.styles';
import { useWorkflowsViewModel } from './Workflows.viewmodel';
import { getWorkflowEventIcon } from '../../shared/workflowEventIcons';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { ExtensionBadge } from '../../components/ui/ExtensionBadge';

import { useT } from '../../shared/i18n/useT';

export const WorkflowsView: React.FC = () => {
  const vm = useWorkflowsViewModel();
  const t = useT('core.automation');

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.workflows')}</S.Title>
        <Button onClick={vm.openNewWorkflow} title={t('page.new-workflow')}>
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('workflow.filter.placeholder')}
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
            <S.EmptyTitle>{t('workflow.list.empty')}</S.EmptyTitle>
            <Button onClick={vm.openNewWorkflow} variant="secondary">
              <RiAddLine size={14} />
              {t('workflow.create-first')}
            </Button>
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.filteredWorkflows.map((w) => {
              const EventIcon = getWorkflowEventIcon(w.eventName);

              return (
                <S.Row key={`${w.tenantId}-${w.id}`} onClick={() => vm.openWorkflow(w)} $clickable>
                  <S.RowIcon><EventIcon size={18} /></S.RowIcon>
                  <S.RowInfo>
                    <S.RowName>{vm.nameOf(w)}</S.RowName>
                    <S.RowEvent>{w.eventName}</S.RowEvent>
                  </S.RowInfo>
                  <ExtensionBadge owner={vm.extensionOf(w.ownerPluginId)} />
                  <S.EnabledBadge
                    $enabled={w.enabled}
                    onClick={(e) => { e.stopPropagation(); vm.toggleEnabled(w); }}
                  >
                    {w.enabled ? t('workflow.active') : t('workflow.inactive')}
                  </S.EnabledBadge>
                  <S.DeleteBtn
                    title={t('workflow.delete')}
                    onClick={(e) => { e.stopPropagation(); vm.handleDelete(w); }}
                  >
                    <RiDeleteBinLine size={14} />
                  </S.DeleteBtn>
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
        title={t('workflow.delete')}
        message={t('workflow.delete.message', { name: vm.nameOf(vm.workflowToDelete) })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
