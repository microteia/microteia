import React from 'react';
import { S } from './ViewDynamicRecord.styles';
import { useViewDynamicRecordViewModel } from './ViewDynamicRecord.viewmodel';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { TagManager } from '../../components/ui/TagManager';
import { EntityDetailView } from '../../components/layout/EntityDetailView';
import { getScreenIcon } from '../../shared/screenIcons';

export const ViewDynamicRecordView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewDynamicRecordViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>Registro</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoadingDefinition ? (
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

  if (vm.recordNotFound) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{definition.titleSingular}</S.Title>
        </S.Header>
        <S.BannerWrapper>
          <InfoBanner variant="info" message="Registro não encontrado. Ele pode ter sido excluído." />
        </S.BannerWrapper>
      </S.Page>
    );
  }

  const appliedTags = !vm.isNew ? vm.tagAdapter.getAppliedTags(vm.recordId ?? '') : [];

  const dataContent = (
    <S.FormWrapper>
      <CustomFieldsSection
        fields={vm.sortedFields}
        values={vm.formValues}
        onChange={vm.setFieldValue}
          onMergeValues={vm.mergeValues}
        errors={vm.fieldErrors}
      />
    </S.FormWrapper>
  );

  const modals = (
    <>
      {vm.isTagManagerOpen && vm.recordId && (
        <TagManager entityId={vm.recordId} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
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
    <EntityDetailView
      isNew={vm.isNew}
      screenActions={vm.screenActions}
      isAdmin={vm.isAdmin}
      avatar={getScreenIcon(definition.icon, 22)}
      title={vm.isNew ? `Novo ${definition.titleSingular}` : (vm.recordTitle || definition.titleSingular)}
      subtitle={!vm.isNew && vm.recordSubtitle ? vm.recordSubtitle : undefined}
      tags={appliedTags}
      showTags={!vm.isNew && definition.hasTags}
      copyLinkDone={vm.copyLinkDone}
      onCopyLink={vm.handleCopyDeepLink}
      onClone={vm.handleClone}
      showTagsAction={!vm.isNew && definition.hasTags}
      onManageTags={vm.openTagManager}
      onSave={() => void vm.handleSave()}
      isSaving={vm.isSaving}
      showDelete={!vm.isNew && vm.isAdmin}
      onDelete={vm.requestDelete}
      activeTab={vm.activeTab}
      setActiveTab={vm.setActiveTab}
      showNotesTab={definition.hasNotes}
      showDocsTab={definition.hasDocuments}
      extraTabs={vm.childTabs}
      notesController={vm.notesController}
      docsController={vm.docsController}
      dataContent={dataContent}
      modals={modals}
    />
  );
};
