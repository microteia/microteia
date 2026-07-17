import React from 'react';
import {
  RiUserAddLine,
  RiUserLine,
  RiLinkM,
  RiFileCopyLine,
  RiPriceTag3Line,
  RiDeleteBinLine,
} from 'react-icons/ri';
import { usePersonsViewModel } from './Persons.viewmodel';
import type { PersonCardActionKey } from './personSchema';
import { EntityListView } from '../../components/layout/EntityListView';
import { EntityListCard } from '../../components/ui/EntityListCard';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { TagManager } from '../../components/ui/TagManager';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { getScreenIcon } from '../../shared/screenIcons';

const ACTION_ICONS: Record<PersonCardActionKey, React.ReactNode> = {
  copyLink: <RiLinkM size={14} />,
  clone: <RiFileCopyLine size={14} />,
  manageTags: <RiPriceTag3Line size={14} />,
  delete: <RiDeleteBinLine size={14} />,
};

export const PersonsView: React.FC = () => {
  const vm = usePersonsViewModel();

  const modals = (
    <>
      {vm.tagManagerPerson && (
        <TagManager entityId={vm.tagManagerPerson.id} adapter={vm.tagAdapter} onClose={vm.closeTagManager} />
      )}
      <ConfirmModal
        isOpen={vm.personToDelete !== null}
        title="Excluir pessoa"
        message={`Tem certeza que deseja excluir "${vm.personToDelete?.name ?? ''}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        loading={vm.isDeleting}
        onConfirm={() => void vm.confirmDeletePerson()}
        onCancel={vm.cancelDeletePerson}
      />
    </>
  );

  return (
    <EntityListView
      title="Pessoas"
      onNew={vm.openNewPerson}
      newTitle="Nova Pessoa"
      newIcon={<RiUserAddLine size={16} />}
      filterDefs={vm.filterDefs}
      filterTokens={vm.filterTokens}
      onFilterChange={vm.setFilterTokens}
      filterPlaceholder="Filtrar pessoas..."
      savedFiltersScreenKey={vm.savedFiltersScreenKey}
      isLoading={vm.isLoading}
      isEmpty={vm.filteredPersons.length === 0}
      emptyIcon={<RiUserLine />}
      emptyTitle="Nenhuma pessoa encontrada"
      emptyActionLabel="Cadastrar primeira pessoa"
      modals={modals}
    >
      {vm.filteredPersons.map((person) => {
        const model = vm.getCardModel(person);
        const customItems = vm.getCustomFieldItems(person);
        return (
          <EntityListCard
            key={person.id}
            onClick={() => vm.openPerson(person)}
            avatar={model.avatar}
            title={model.title}
            subtitle={<>{getScreenIcon(model.subtitle.iconKey, 12)}{model.subtitle.text}</>}
            actions={model.actions.map((action) => ({
              key: action.key,
              icon: ACTION_ICONS[action.key],
              title: action.title,
              danger: action.danger,
              onClick: action.onClick,
            }))}
            metaRows={model.metaRows.map((row) => ({
              key: row.key,
              icon: getScreenIcon(row.iconKey, 12),
              value: row.value,
            }))}
            tags={model.tags}
            extra={customItems.length > 0 ? <CustomFieldMetaRows items={customItems} /> : undefined}
          />
        );
      })}
    </EntityListView>
  );
};
