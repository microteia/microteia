import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiFileChartLine, RiPencilLine } from 'react-icons/ri';
import { S } from './Reports.styles';
import { useReportsViewModel } from './Reports.viewmodel';
import { Button } from '../../components/ui/Button';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { ExtensionBadge } from '../../components/ui/ExtensionBadge';
import { getScreenIcon } from '../../shared/screenIcons';

/** A lista de relatórios. Só aparece aqui o que esta pessoa poderia executar de fato. */
export const ReportsView: React.FC = () => {
  const vm = useReportsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>{vm.title}</S.Title>
        {vm.canManage && (
          <Button onClick={vm.create} title={vm.labels.create}>
            <RiAddLine size={16} />
          </Button>
        )}
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder={vm.labels.filterPlaceholder}
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <S.EmptyState><Spinner /></S.EmptyState>
        ) : vm.isEmpty ? (
          <S.EmptyState>
            <S.EmptyIcon><RiFileChartLine /></S.EmptyIcon>
            <S.EmptyTitle>{vm.labels.empty}</S.EmptyTitle>
            {vm.canManage && (
              <Button onClick={vm.create} variant="secondary">
                <RiAddLine size={14} />
                {vm.labels.createFirst}
              </Button>
            )}
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.reports.map((report) => (
              <S.Row key={report.id} onClick={() => vm.open(report.id)}>
                <S.RowIcon>{getScreenIcon(report.icon, 18)}</S.RowIcon>
                <S.RowInfo>
                  <S.RowName>{report.title}</S.RowName>
                  <S.RowDescription>{report.description ?? report.covers}</S.RowDescription>
                </S.RowInfo>
                <ExtensionBadge owner={report.extension} />
                {vm.canManage && !report.managed && (
                  <S.RowActions>
                    <S.IconBtn
                      title={vm.labels.edit}
                      onClick={(event) => { event.stopPropagation(); vm.edit(report.id); }}
                    >
                      <RiPencilLine size={14} />
                    </S.IconBtn>
                    <S.DeleteBtn
                      title={vm.labels.remove}
                      onClick={(event) => { event.stopPropagation(); vm.askDelete(report); }}
                    >
                      <RiDeleteBinLine size={14} />
                    </S.DeleteBtn>
                  </S.RowActions>
                )}
              </S.Row>
            ))}
          </S.List>
        )}
      </S.Content>

      <ConfirmModal
        isOpen={vm.toDelete !== null}
        title={vm.labels.deleteTitle}
        message={vm.labels.deleteMessage}
        confirmLabel={vm.labels.deleteConfirm}
        variant="danger"
        loading={vm.isDeleting}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />
    </S.Page>
  );
};
