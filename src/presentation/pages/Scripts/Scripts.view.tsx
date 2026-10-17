import React from 'react';
import { RiCodeBoxLine, RiAddLine, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './Scripts.styles';
import { useScriptsViewModel } from './Scripts.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { ExtensionBadge } from '../../components/ui/ExtensionBadge';

import { useT } from '../../shared/i18n/useT';
export const ScriptsView: React.FC = () => {
  const t = useT('core.automation');
  const vm = useScriptsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>{t('page.scripts')}</S.Title>
        <Button onClick={vm.openNewScript} title={t('scripts.new')}>
          <RiAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={t('scripts.filter.placeholder')}
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <S.EmptyState><Spinner /></S.EmptyState>
        ) : vm.filteredScripts.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiCodeBoxLine /></S.EmptyIcon>
            <S.EmptyTitle>{t('scripts.empty')}</S.EmptyTitle>
            <Button onClick={vm.openNewScript} variant="secondary">
              <RiAddLine size={14} />
              {t('scripts.create-first')}
            </Button>
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.filteredScripts.map((s) => (
              <S.Row key={s.id} onClick={() => vm.openScript(s)}>
                <S.RowIcon><RiCodeBoxLine size={18} /></S.RowIcon>
                <S.RowInfo>
                  <S.RowName>{vm.nameOf(s)}</S.RowName>
                  {s.description && <S.RowDescription>{vm.descriptionOf(s)}</S.RowDescription>}
                </S.RowInfo>
                <ExtensionBadge owner={vm.extensionOf(s.ownerPluginId)} />
                <S.DeleteBtn
                  title={t('script.delete')}
                  onClick={(e) => { e.stopPropagation(); vm.handleDelete(s); }}
                >
                  <RiDeleteBinLine size={14} />
                </S.DeleteBtn>
              </S.Row>
            ))}
          </S.List>
        )}
      </S.Content>

      <ConfirmModal
        isOpen={!!vm.scriptToDelete}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
        title={t('script.delete.title')}
        message={t('scripts.delete.message', { name: vm.nameOf(vm.scriptToDelete) })}
        confirmLabel={t('core.ui/action.delete')}
        variant="danger"
      />
    </S.Page>
  );
};
