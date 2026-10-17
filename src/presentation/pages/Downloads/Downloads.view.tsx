import React from 'react';
import {
  RiAttachment2,
  RiDeleteBinLine,
  RiDownload2Line,
  RiFileDownloadLine,
  RiGlobalLine,
  RiLockLine,
} from 'react-icons/ri';
import { S } from './Downloads.styles';
import { useDownloadsViewModel } from './Downloads.viewmodel';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { AttachDownloadDialog } from './components/AttachDownloadDialog';

/** Os arquivos gerados para baixar, que não foram anexados a registro nenhum e vencem sozinhos. */
export const DownloadsView: React.FC = () => {
  const vm = useDownloadsViewModel();

  return (
    <S.Page>
      <S.Header>
        <div>
          <S.Title>{vm.title}</S.Title>
          <S.Subtitle>{vm.subtitle}</S.Subtitle>
        </div>
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
        ) : vm.isEmpty || vm.isFilteredEmpty ? (
          <S.EmptyState>
            <S.EmptyIcon><RiFileDownloadLine /></S.EmptyIcon>
            <S.EmptyTitle>{vm.isEmpty ? vm.labels.empty : vm.labels.filteredEmpty}</S.EmptyTitle>
          </S.EmptyState>
        ) : (
          <S.List>
            {vm.items.map((item) => (
              <S.Row key={item.id}>
                <S.RowIcon><RiFileDownloadLine size={18} /></S.RowIcon>
                <S.RowInfo>
                  <S.RowName>{item.name}</S.RowName>
                  <S.RowDescription>{item.details}</S.RowDescription>
                </S.RowInfo>
                <S.VisibilityBadge $public={item.isPublic}>{item.visibilityLabel}</S.VisibilityBadge>
                <S.RowExpiry>{item.expiry}</S.RowExpiry>
                <S.RowActions>
                  <S.IconLink href={item.url} target="_blank" rel="noopener noreferrer" title={vm.labels.download}>
                    <RiDownload2Line size={14} />
                  </S.IconLink>
                  <S.IconBtn title={vm.labels.attach} onClick={() => vm.askAttach(item)}>
                    <RiAttachment2 size={14} />
                  </S.IconBtn>
                  {vm.canManage && (
                    <S.IconBtn
                      title={item.isPublic ? vm.labels.makePrivate : vm.labels.makePublic}
                      onClick={() => void vm.toggleVisibility(item)}
                    >
                      {item.isPublic ? <RiLockLine size={14} /> : <RiGlobalLine size={14} />}
                    </S.IconBtn>
                  )}
                  {item.canDelete && (
                    <S.DeleteBtn title={vm.labels.remove} onClick={() => vm.askDelete(item)}>
                      <RiDeleteBinLine size={14} />
                    </S.DeleteBtn>
                  )}
                </S.RowActions>
              </S.Row>
            ))}
          </S.List>
        )}
      </S.Content>

      {vm.toAttach && <AttachDownloadDialog download={vm.toAttach} onClose={vm.closeAttach} />}

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
