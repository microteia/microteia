import React from 'react';
import { RiApps2Line, RiLinkM, RiFileCopyLine, RiPriceTag3Line, RiDeleteBinLine } from 'react-icons/ri';
import { S } from './DynamicRecordList.styles';
import { useDynamicRecordListViewModel } from './DynamicRecordList.viewmodel';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { EntityListCard } from '../../components/ui/EntityListCard';
import { EntityListView } from '../../components/layout/EntityListView';
import { getScreenIcon } from '../../shared/screenIcons';
import type { ScreenListAction } from '../../../domain/entities';

const ACTION_ICONS: Record<ScreenListAction, React.ReactNode> = {
  copyLink: <RiLinkM size={14} />,
  clone: <RiFileCopyLine size={14} />,
  manageTags: <RiPriceTag3Line size={14} />,
  delete: <RiDeleteBinLine size={14} />,
};

export const DynamicRecordListView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useDynamicRecordListViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Tela personalizada</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoading ? (
            <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
          ) : (
            <InfoBanner
              variant="info"
              message="Esta tela personalizada não está mais disponível. Ela pode ter sido desativada ou excluída pelo administrador."
            />
          )}
        </S.BannerWrapper>
      </S.Page>
    );
  }

  const modals = (
    <>
      {vm.tagManagerRecord && (
        <TagManager entityId={vm.tagManagerRecord.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
      )}
      <ConfirmModal
        isOpen={vm.recordToDelete !== null}
        title="Excluir registro"
        message={`Tem certeza que deseja excluir "${vm.recordToDelete?.title ?? ''}"? As anotações e documentos vinculados também serão excluídos. Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={vm.isDeleting}
        onConfirm={() => void vm.confirmDelete()}
        onCancel={vm.cancelDelete}
      />
    </>
  );

  return (
    <EntityListView
      title={definition.titlePlural}
      titleIcon={getScreenIcon(definition.icon, 22)}
      onNew={vm.openNewRecord}
      newTitle={`Novo ${definition.titleSingular}`}
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder={`Filtrar ${definition.titlePlural.toLowerCase()}...`}
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading && vm.records.length === 0}
      isEmpty={vm.filteredRecords.length === 0}
      emptyIcon={<RiApps2Line />}
      emptyTitle="Nenhum registro encontrado"
      emptyActionLabel={`Cadastrar ${definition.titleSingular.toLowerCase()}`}
      modals={modals}
    >
      {vm.filteredRecords.map((record) => {
        const recordTags = vm.tags.filter((t) => record.tagIds?.includes(t.id));
        const items = vm.getCardItems(record);
        return (
          <EntityListCard
            key={record.id}
            onClick={() => vm.openRecord(record)}
            avatar={getScreenIcon(definition.icon, 22)}
            title={record.title}
            metaRows={[]}
            tags={recordTags}
            actions={vm.getCardActions(record).map((action) => ({
              key: action.key,
              icon: ACTION_ICONS[action.key],
              title: action.title,
              danger: action.danger,
              onClick: action.onClick,
            }))}
            extra={items.length > 0 ? <CustomFieldMetaRows items={items} /> : undefined}
          />
        );
      })}
    </EntityListView>
  );
};
