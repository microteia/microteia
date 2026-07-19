import React from 'react';
import { RiApps2Line, RiLinkM, RiFileCopyLine, RiPriceTag3Line, RiDeleteBinLine } from 'react-icons/ri';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { TagManager } from '../../ui/TagManager';
import { CustomFieldMetaRows } from '../../ui/CustomFieldMetaRows';
import { EntityListCard } from '../../ui/EntityListCard';
import { EntityListView } from '../EntityListView';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { RecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';
import type { ScreenDefinition, ScreenListAction } from '../../../../domain/entities';

const ACTION_ICONS: Record<ScreenListAction, React.ReactNode> = {
  copyLink: <RiLinkM size={14} />,
  clone: <RiFileCopyLine size={14} />,
  manageTags: <RiPriceTag3Line size={14} />,
  delete: <RiDeleteBinLine size={14} />,
};

interface RecordListSurfaceProps {
  vm: RecordListViewModel;
  definition: ScreenDefinition;
  variant?: 'page' | 'embedded';
}

/**
 * Listagem de registros de uma tela customizada. A mesma superfície serve à janela própria da tela
 * e à aba de registros filhos dentro do pai — só muda a variante do `EntityListView`.
 */
export const RecordListSurface: React.FC<RecordListSurfaceProps> = ({ vm, definition, variant = 'page' }) => {
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
      variant={variant}
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
