import React from 'react';
import { RiFolderLine } from 'react-icons/ri';
import { S } from './ViewCase.styles';
import { useViewCaseViewModel } from './ViewCase.viewmodel';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { EntityDetailView } from '../../components/layout/EntityDetailView';

export const ViewCaseView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewCaseViewModel(tabKey);

  if (!vm.isNew && !vm.case_) {
    return <S.NotFound>Processo não encontrado.</S.NotFound>;
  }

  const appliedTags = vm.case_ ? vm.tagAdapter.getAppliedTags(vm.case_.id) : [];

  const dataContent = (
    <S.FormGrid>
      <S.FormGroup $fullWidth>
        <CustomFieldsSection
          screenKey="cases-native"
          resolveOptionsScreenKey={vm.resolveOptionsScreenKey}
          fields={vm.fields}
          values={vm.values}
          onChange={vm.setFieldValue}
          onMergeValues={vm.mergeValues}
          errors={vm.fieldErrors}
          lookupOptions={vm.lookupOptions}
          onAddLookupOption={vm.handleAddLookupOption}
          onDeleteLookupOption={vm.handleDeleteLookupOption}
          canDeleteLookupOption={vm.isAdmin}
        />
      </S.FormGroup>

    </S.FormGrid>
  );

  const modals = (
    <>
      {vm.isTagManagerOpen && vm.case_ && (
        <TagManager entityId={vm.case_.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
      )}
      <ConfirmModal
        isOpen={vm.caseToDelete !== null}
        title="Excluir processo"
        message={`Tem certeza que deseja excluir o processo "${vm.caseToDelete?.title ?? ''}"? As anotações e documentos vinculados também serão excluídos. Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void vm.confirmDeleteCase()}
        onCancel={vm.cancelDeleteCase}
      />
    </>
  );

  return (
    <EntityDetailView
      isNew={vm.isNew}
      screenActions={vm.screenActions}
      isAdmin={vm.isAdmin}
      avatar={<RiFolderLine size={22} />}
      title={vm.isNew ? 'Novo Processo' : (vm.case_?.title ?? 'Processo')}
      subtitle={!vm.isNew && vm.case_?.caseNumber ? vm.case_.caseNumber : undefined}
      tags={appliedTags}
      showTags={!vm.isNew}
      copyLinkDone={vm.copyLinkDone}
      onCopyLink={vm.handleCopyDeepLink}
      onClone={vm.handleClone}
      showTagsAction={!vm.isNew}
      onManageTags={vm.openTagManager}
      onSave={() => void vm.handleSave()}
      isSaving={vm.isSaving}
      showDelete={!vm.isNew && vm.isAdmin}
      onDelete={vm.handleDeleteCase}
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
