import React from 'react';
import { RiDeleteBinLine, RiDownload2Line, RiFileDownloadLine } from 'react-icons/ri';
import { S } from './Downloads.styles';
import { useDownloadsViewModel } from './Downloads.viewmodel';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';

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

      <S.Content>
        {vm.isLoading ? (
          <S.EmptyState><Spinner /></S.EmptyState>
        ) : vm.isEmpty ? (
          <S.EmptyState>
            <S.EmptyIcon><RiFileDownloadLine /></S.EmptyIcon>
            <S.EmptyTitle>{vm.labels.empty}</S.EmptyTitle>
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
                <S.RowExpiry>{item.expiry}</S.RowExpiry>
                <S.RowActions>
                  <S.IconLink href={item.url} target="_blank" rel="noopener noreferrer" title={vm.labels.download}>
                    <RiDownload2Line size={14} />
                  </S.IconLink>
                  <S.DeleteBtn title={vm.labels.remove} onClick={() => vm.askDelete(item)}>
                    <RiDeleteBinLine size={14} />
                  </S.DeleteBtn>
                </S.RowActions>
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
