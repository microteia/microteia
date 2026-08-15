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
import { useT } from '../../shared/i18n/useT';

export const ActionsView: React.FC = () => {
  const t = useT('core.automation');
  const vm = useActionsViewModel();

  if (!vm.isAdmin) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{t('page.actions')}</S.Title>
        </S.Header>
        <S.Content>
          <InfoBanner
            variant="info"
            message={t('action.admin-only')}
          />
        </S.Content>
      </S.Page>
    );
  }

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.actions')}</S.Title>
        <Button onClick={vm.openNewAction} title={t('actions.new')}>
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('actions.filter.placeholder')}
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <S.EmptyState><Spinner /></S.EmptyState>
        ) : vm.filteredActions.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiCursorLine /></S.EmptyIcon>
            <S.EmptyTitle>{t('actions.empty')}</S.EmptyTitle>
            <Button onClick={vm.openNewAction} variant="secondary">
              <RiAddLine size={14} />
              {t('actions.create-first')}
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
                    {!action.enabled && ` ${t('actions.disabled-suffix')}`}
                  </S.RowName>
                  <S.RowDescription>{action.key}</S.RowDescription>
                </S.RowInfo>
                <S.DeleteBtn
                  title={t('action.delete')}
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
        title={t('actions.delete.title')}
        message={t('action.delete.message', { title: vm.actionToDelete?.title ?? '' })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
