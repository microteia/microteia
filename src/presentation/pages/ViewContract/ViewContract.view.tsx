import React from 'react';
import { RiFileTextLine, RiFolderLine, RiExternalLinkLine, RiLinkUnlinkM } from 'react-icons/ri';
import { S } from './ViewContract.styles';
import { useViewContractViewModel, CONTRACT_CASES_TAB } from './ViewContract.viewmodel';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { SearchSelect } from '../../components/ui/SearchSelect';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { TagManager } from '../../components/ui/TagManager';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { EntityDetailView } from '../../components/layout/EntityDetailView';

export const ViewContractView: React.FC<{ tabKey: string }> = ({ tabKey }) => {
  const vm = useViewContractViewModel(tabKey);
  const appliedTags = vm.contract ? vm.tagAdapter.getAppliedTags(vm.contract.id) : [];

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

  // Aba própria do Contrato: vincular/desvincular processos.
  const casesContent = (
    <>
      <S.CaseLinkControl>
        <SearchSelect
          options={vm.unlinkedCaseOptions}
          value={vm.caseToAdd}
          onChange={(val) => void vm.handleLinkCase(val)}
          placeholder="Vincular um processo..."
        />
      </S.CaseLinkControl>

      {vm.linkedCases.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon><RiFolderLine /></S.EmptyIcon>
          <div>Nenhum processo vinculado a este contrato.</div>
        </S.EmptyState>
      ) : (
        <S.DocList>
          {vm.linkedCases.map((c) => (
            <S.DocRow key={c.id}>
              <S.DocIcon><RiFolderLine /></S.DocIcon>
              <S.DocContent>
                <S.CaseLink type="button" onClick={() => vm.handleOpenCase(c)} title={c.title}>
                  {c.caseNumber}
                </S.CaseLink>
                <S.DocMeta>{c.title}</S.DocMeta>
              </S.DocContent>
              <Badge color={vm.getCaseStatusColor(c.status)}>{c.status}</Badge>
              <S.DocActions>
                <Button variant="ghost" size="sm" onClick={() => vm.handleOpenCase(c)} title="Abrir processo">
                  <RiExternalLinkLine size={14} />
                </Button>
                <Button variant="ghost" size="sm" onClick={() => void vm.handleUnlinkCase(c)} title="Desvincular processo">
                  <RiLinkUnlinkM size={14} />
                </Button>
              </S.DocActions>
            </S.DocRow>
          ))}
        </S.DocList>
      )}
    </>
  );

  const modals = (
    <>
      {vm.isTagManagerOpen && vm.contract && (
        <TagManager entityId={vm.contract.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
      )}
      <ConfirmModal
        isOpen={vm.contractToDelete !== null}
        title="Excluir contrato"
        message={`Tem certeza que deseja excluir o contrato "${vm.contractToDelete?.title ?? ''}"? As anotações e documentos vinculados também serão excluídos. Esta ação não pode ser desfeita.`}
        variant="danger"
        confirmLabel="Excluir"
        onConfirm={() => void vm.confirmDeleteContract()}
        onCancel={vm.cancelDeleteContract}
      />
    </>
  );

  return (
    <EntityDetailView
      isNew={vm.isNew}
      screenActions={vm.screenActions}
      isAdmin={vm.isAdmin}
      avatar={<RiFileTextLine size={22} />}
      title={vm.isNew ? 'Novo Contrato' : (vm.contract?.title ?? 'Contrato')}
      subtitle={!vm.isNew && vm.contract?.number ? vm.contract.number : undefined}
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
      onDelete={vm.handleDeleteContract}
      activeTab={vm.activeTab}
      setActiveTab={vm.setActiveTab}
      showNotesTab
      showDocsTab
      extraTabs={[{ key: CONTRACT_CASES_TAB, label: 'Processos', content: casesContent }, ...vm.childTabs]}
      notesController={vm.notesController}
      docsController={vm.docsController}
      dataContent={dataContent}
      modals={modals}
    />
  );
};
