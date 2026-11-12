import React from 'react';
import { RiAddLine, RiDeleteBinLine, RiFileChartLine, RiLockLine, RiPencilLine, RiShareForwardLine } from 'react-icons/ri';
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
        {vm.canCreate && (
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
            {vm.canCreate && (
              <Button onClick={vm.create} variant="secondary">
                <RiAddLine size={14} />
                {vm.labels.createFirst}
              </Button>
            )}
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.reports.map((report) => (
              <S.Row key={report.documentId} onClick={() => vm.open(report.id)}>
                <S.RowIcon>{getScreenIcon(report.icon, 18)}</S.RowIcon>
                <S.RowInfo>
                  <S.RowName>{report.title}</S.RowName>
                  <S.RowDescription>{report.description ?? report.covers}</S.RowDescription>
                </S.RowInfo>
                {report.personal && (
                  <S.PersonalTag title={vm.labels.personal}>
                    <RiLockLine size={12} /> {vm.labels.personal}
                  </S.PersonalTag>
                )}
                <ExtensionBadge owner={report.extension} />
                {report.canEdit && (
                  <S.RowActions>
                    {report.canShare && (
                      <S.IconBtn
                        title={vm.labels.share}
                        onClick={(event) => { event.stopPropagation(); vm.askShare(report); }}
                      >
                        <RiShareForwardLine size={14} />
                      </S.IconBtn>
                    )}
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

      <ConfirmModal
        isOpen={vm.toShare !== null}
        title={vm.labels.shareTitle}
        message={vm.labels.shareMessage}
        confirmLabel={vm.labels.shareConfirm}
        loading={vm.isSharing}
        onConfirm={() => void vm.confirmShare()}
        onCancel={vm.cancelShare}
      />
    </S.Page>
  );
};
