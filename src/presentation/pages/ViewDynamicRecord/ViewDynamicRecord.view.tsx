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

import { useT } from '../../shared/i18n/useT';
export const ViewDynamicRecordView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const t = useT('core.records');
  const vm = useViewDynamicRecordViewModel(tabKey);
  const definition = vm.definition;

  if (!vm.isAvailable || !definition) {
    return (
      <S.Page>
        <S.Header>
          <S.Title>{t('record.title')}</S.Title>
        </S.Header>
        <S.BannerWrapper>
          {vm.isLoadingDefinition ? (
            <S.SpinnerWrapper><Spinner /></S.SpinnerWrapper>
          ) : (
            <InfoBanner
              variant="info"
              message={t('screen.unavailable')}
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
          <InfoBanner variant="info" message={t('record.not-found')} />
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
        title={t('record.delete.title')}
        message={t('record.delete.message', { title: vm.recordToDelete?.title ?? '' })}
        variant="danger"
        confirmLabel={t('core.ui/action.delete')}
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
      showDelete={!vm.isNew && vm.canDelete}
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
