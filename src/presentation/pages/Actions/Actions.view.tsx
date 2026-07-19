import React from 'react';
import { RiAddLine, RiCursorLine, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './Actions.styles';
import { useActionsViewModel } from './Actions.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { Spinner } from '../../components/ui/Spinner';
import { getScreenIcon } from '../../shared/screenIcons';

export const ActionsView: React.FC = () => {
  const vm = useActionsViewModel();

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Ações</S.Title>
        </S.Header>
        <S.Content>
          <InfoBanner
            variant="info"
            message="Somente administradores do escritório podem configurar ações."
          />
        </S.Content>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>Ações</S.Title>
        <Button onClick={vm.openNewAction} title="Nova Ação">
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar ações..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <S.EmptyState><Spinner /></S.EmptyState>
        ) : vm.filteredActions.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiCursorLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhuma ação encontrada</S.EmptyTitle>
            <Button onClick={vm.openNewAction} variant="secondary">
              <RiAddLine size={14} />
              Criar primeira ação
            </Button>
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.filteredActions.map((action) => (
              <S.Row key={action.id} onClick={() => vm.openAction(action)}>
                <S.RowIcon>{getScreenIcon(action.icon, 18)}</S.RowIcon>
                <S.RowInfo>
                  <S.RowName>
                    {action.title}
                    {!action.enabled && ' (desativada)'}
                  </S.RowName>
                  <S.RowDescription>{action.key}</S.RowDescription>
                </S.RowInfo>
                <S.DeleteBtn
                  title="Excluir ação"
                  onClick={(e) => { e.stopPropagation(); vm.handleDelete(action); }}
                >
                  <RiDeleteBinLine size={14} />
                </S.DeleteBtn>
              </S.Row>
            ))}
          </S.List>
        )}
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.actionToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title="Excluir Ação"
        message={`Tem certeza que deseja excluir a ação "${vm.actionToDelete?.title ?? ''}"? As telas que a exibem deixarão de mostrá-la. Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </S.Page>
  );
};
