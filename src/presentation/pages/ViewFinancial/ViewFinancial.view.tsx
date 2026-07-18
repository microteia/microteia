import React from 'react';
import { RiMoneyDollarCircleLine } from 'react-icons/ri';
import { S } from './ViewFinancial.styles';
import { useViewFinancialViewModel } from './ViewFinancial.viewmodel';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { EntityDetailView } from '../../components/layout/EntityDetailView';
import { formatCurrencyBRL } from '../../../utils/formatters';

export const ViewFinancialView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewFinancialViewModel(tabKey);
  const appliedTags = vm.financial ? vm.tagAdapter.getAppliedTags(vm.financial.id) : [];

  const dataContent = (
    <S.FormGrid>
      <S.FormGroup $fullWidth>
        <CustomFieldsSection
          screenKey="financials-native"
          fields={vm.fields}
          values={vm.values}
          onChange={vm.setFieldValue}
          errors={vm.fieldErrors}
          lookupOptions={vm.lookupOptions}
          onAddLookupOption={vm.handleAddLookupOption}
          onDeleteLookupOption={vm.handleDeleteLookupOption}
          canDeleteLookupOption={vm.isAdmin}
        />
      </S.FormGroup>

      {vm.customFields.length > 0 && (
        <>
          <S.SectionTitle>Campos adicionais</S.SectionTitle>
          <S.FormGroup $fullWidth>
            <CustomFieldsSection
              screenKey="financials"
              fields={vm.customFields}
              values={vm.values}
              onChange={vm.setFieldValue}
              errors={vm.fieldErrors}
            />
          </S.FormGroup>
        </>
      )}
    </S.FormGrid>
  );

  const modals = (
    <>
      {vm.isTagManagerOpen && vm.financial && (
        <TagManager entityId={vm.financial.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
      )}
      <ConfirmModal
        isOpen={vm.financialToDelete !== null}
        title="Excluir lançamento"
        message={`Tem certeza que deseja excluir o lançamento "${vm.financialToDelete?.category ?? ''}"? Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void vm.confirmDeleteFinancial()}
        onCancel={vm.cancelDeleteFinancial}
      />
    </>
  );

  return (
    <EntityDetailView
      isNew={vm.isNew}
      isAdmin={vm.isAdmin}
      avatar={<RiMoneyDollarCircleLine size={22} />}
      title={vm.isNew ? 'Novo Lançamento' : (vm.financial?.category ?? 'Lançamento')}
      subtitle={!vm.isNew && vm.financial ? (
        <S.SubTitle $type={vm.financial.type}>
          {vm.financial.type === 'Receita' ? '+' : '-'} {formatCurrencyBRL(vm.financial.amount)}
        </S.SubTitle>
      ) : undefined}
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
      onDelete={vm.handleDeleteFinancial}
      activeTab={vm.activeTab}
      setActiveTab={vm.setActiveTab}
      showNotesTab={false}
      showDocsTab
      notesController={vm.notesController}
      docsController={vm.docsController}
      dataContent={dataContent}
      modals={modals}
    />
  );
};
