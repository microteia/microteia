import React from 'react';
import { RiTimeLine } from 'react-icons/ri';
import { S } from './ViewDeadline.styles';
import { useViewDeadlineViewModel } from './ViewDeadline.viewmodel';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { EntityDetailView } from '../../components/layout/EntityDetailView';

export const ViewDeadlineView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewDeadlineViewModel(tabKey);

  const dataContent = (
    <S.FormGrid>
      <S.FormGroup $fullWidth>
        <CustomFieldsSection
          fields={vm.fields}
          values={vm.values}
          onChange={vm.setFieldValue}
          onMergeValues={vm.mergeValues}
          errors={vm.fieldErrors}
        />
      </S.FormGroup>

    </S.FormGrid>
  );

  return (
    <EntityDetailView
      isNew={vm.isNew}
      screenActions={vm.screenActions}
      isAdmin={vm.isAdmin}
      avatar={<RiTimeLine size={22} />}
      title={vm.isNew ? 'Novo Prazo' : (vm.deadline?.type || 'Prazo')}
      subtitle={!vm.isNew && vm.caseDisplay ? vm.caseDisplay : undefined}
      showCopyLink={false}
      showClone={false}
      copyLinkDone={false}
      onCopyLink={() => undefined}
      onClone={() => undefined}
      headerActionsExtra={
        <S.StatusChip $color={vm.getDeadlineStatusColor(vm.derivedStatus)}>
          {vm.derivedStatus}
        </S.StatusChip>
      }
      showTagsAction={false}
      onManageTags={() => undefined}
      onSave={() => void vm.handleSave()}
      isSaving={vm.isSaving}
      showDelete={false}
      onDelete={() => undefined}
      activeTab={vm.activeTab}
      setActiveTab={vm.setActiveTab}
      showNotesTab={false}
      showDocsTab={false}
      extraTabs={vm.childTabs}
      notesController={vm.notesController}
      docsController={vm.docsController}
      dataContent={dataContent}
    />
  );
};
