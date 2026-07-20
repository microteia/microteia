import React from 'react';
import { RiUserLine, RiBuildingLine, RiToggleLine } from 'react-icons/ri';
import { S } from './ViewPerson.styles';
import { useViewPersonViewModel } from './ViewPerson.viewmodel';
import { Button } from '../../components/ui/Button';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { EntityDetailView } from '../../components/layout/EntityDetailView';

export const ViewPersonView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewPersonViewModel(tabKey);
  const appliedTags = vm.person ? vm.tagAdapter.getAppliedTags(vm.person.id) : [];

  const dataContent = (
    <S.FormGrid>
      <S.FormGroup $fullWidth>
        <CustomFieldsSection
          screenKey="persons-native"
          fields={vm.nativeFields}
          values={vm.values}
          onChange={vm.setFieldValue}
          onMergeValues={vm.mergeValues}
          errors={vm.fieldErrors}
          lookupOptions={vm.personLookupOptions}
          onAddLookupOption={vm.handleAddPersonLookup}
          onDeleteLookupOption={vm.handleDeletePersonLookup}
          canDeleteLookupOption={vm.isAdmin}
        />
      </S.FormGroup>

      {vm.customFields.length > 0 && (
        <>
          <S.SectionTitle>Campos adicionais</S.SectionTitle>
          <S.FormGroup $fullWidth>
            <CustomFieldsSection
              screenKey="persons"
              fields={vm.customFields}
              values={vm.values}
              onChange={vm.setFieldValue}
          onMergeValues={vm.mergeValues}
              errors={vm.fieldErrors}
            />
          </S.FormGroup>
        </>
      )}
    </S.FormGrid>
  );

  const modals = (
    <>
      {vm.isTagManagerOpen && vm.person && (
        <TagManager entityId={vm.person.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
      )}
      <ConfirmModal
        isOpen={!!vm.personToDelete}
        onConfirm={() => void vm.confirmDeletePerson()}
        onCancel={vm.cancelDeletePerson}
        title="Excluir Pessoa"
        message={`Tem certeza que deseja excluir "${vm.personToDelete?.name}"? Todos os dados da pessoa serão perdidos.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </>
  );

  return (
    <EntityDetailView
      isNew={vm.isNew}
      screenActions={vm.screenActions}
      isAdmin={vm.isAdmin}
      avatar={(vm.personName || 'N').charAt(0).toUpperCase()}
      title={vm.isNew ? 'Nova Pessoa' : (vm.person?.name ?? 'Pessoa')}
      subtitle={vm.personType === 'Pessoa Física'
        ? <><RiUserLine size={13} /> Pessoa Física</>
        : <><RiBuildingLine size={13} /> Pessoa Jurídica</>}
      tags={appliedTags}
      showTags={!vm.isNew}
      copyLinkDone={vm.copyLinkDone}
      onCopyLink={vm.handleCopyDeepLink}
      onClone={vm.handleClone}
      headerActionsExtra={
        <Button
          variant="ghost"
          size="sm"
          title={vm.person?.status === 'Ativo' ? 'Inativar' : 'Ativar'}
          onClick={() => void vm.handleToggleStatus()}
        >
          <S.ToggleIcon $enabled={vm.person?.status === 'Ativo'}>
            <RiToggleLine size={14} />
          </S.ToggleIcon>
        </Button>
      }
      showTagsAction={!vm.isNew}
      onManageTags={vm.openTagManager}
      onSave={() => void vm.handleSave()}
      isSaving={vm.isSaving}
      showDelete={!vm.isNew && vm.isAdmin}
      onDelete={vm.handleDeletePerson}
      activeTab={vm.activeTab}
      setActiveTab={vm.setActiveTab}
      showNotesTab
      showDocsTab
      extraTabs={vm.childTabs}
      notesController={vm.notesController}
      docsController={vm.docsController}
      dataContent={dataContent}
      modals={modals}
    />
  );
};
