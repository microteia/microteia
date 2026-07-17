import React from 'react';
import {
  RiUserAddLine,
  RiUserLine,
  RiLinkM,
  RiFileCopyLine,
  RiPriceTag3Line,
  RiDeleteBinLine,
} from 'react-icons/ri';
import { S } from './Persons.styles';
import { usePersonsViewModel } from './Persons.viewmodel';
import type { PersonCardActionKey } from './personListSchema';
import { CompositeFilter } from '../../components/ui/CompositeFilter';
import { Button } from '../../components/ui/Button';
import { EntityListCard } from '../../components/ui/EntityListCard';
import { CustomFieldMetaRows } from '../../components/ui/CustomFieldMetaRows';
import { TagManager } from '../../components/ui/TagManager';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { Spinner } from '../../components/ui/Spinner';
import { getScreenIcon } from '../../shared/screenIcons';

const ACTION_ICONS: Record<PersonCardActionKey, React.ReactNode> = {
  copyLink: <RiLinkM size={14} />,
  clone: <RiFileCopyLine size={14} />,
  manageTags: <RiPriceTag3Line size={14} />,
  delete: <RiDeleteBinLine size={14} />,
};

export const PersonsView: React.FC = () => {
  const vm = usePersonsViewModel();

  return (
    <S.Page>
      <S.Header>
        <S.Title>Pessoas</S.Title>
        <Button onClick={vm.openNewPerson} title="Nova Pessoa">
          <RiUserAddLine size={16} />
        </Button>
      </S.Header>

      <S.Toolbar>
        <CompositeFilter
          defs={vm.filterDefs}
          tokens={vm.filterTokens}
          onChange={vm.setFilterTokens}
          placeholder="Filtrar pessoas..."
          screenKey={vm.savedFiltersScreenKey}
        />
      </S.Toolbar>

      <S.Content>
        {vm.isLoading ? (
          <div style={{ display: 'flex', justifyContent: 'center', paddingTop: '48px' }}>
            <Spinner />
          </div>
        ) : vm.filteredPersons.length === 0 ? (
          <S.EmptyState>
            <S.EmptyIcon><RiUserLine /></S.EmptyIcon>
            <S.EmptyTitle>Nenhuma pessoa encontrada</S.EmptyTitle>
            <Button onClick={vm.openNewPerson} variant="secondary">
              <RiUserAddLine size={14} />
              Cadastrar primeira pessoa
            </Button>
          </S.EmptyState>
        ) : (
          <S.Grid>
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
          </S.Grid>
        )}
      </S.Content>

      {vm.tagManagerPerson && (
        <TagManager
          entityId={vm.tagManagerPerson.id}
          adapter={vm.tagAdapter}
          onClose={vm.closeTagManager}
        />
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
    </S.Page>
  );
};
