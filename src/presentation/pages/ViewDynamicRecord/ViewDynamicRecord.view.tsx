import React from 'react';
import {
  RiCheckLine,
  RiDeleteBinLine,
  RiFileCopyLine,
  RiLinkM,
  RiPriceTag3Line,
  RiSaveLine,
} from 'react-icons/ri';
import { S } from './ViewDynamicRecord.styles';
import { useViewDynamicRecordViewModel } from './ViewDynamicRecord.viewmodel';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { InfoBanner } from '../../components/ui/InfoBanner';
import { ConfirmModal } from '../../components/ui/ConfirmModal';
import { CustomFieldsSection } from '../../components/ui/CustomFieldsSection';
import { TagManager } from '../../components/ui/TagManager';
import { NotesPanel, DocumentsPanel } from '../../components/layout/EntityDetailPanels';
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

  const showTabs = !vm.isNew && (definition.hasNotes || definition.hasDocuments);
  const appliedTags = !vm.isNew ? vm.tagAdapter.getAppliedTags(vm.recordId ?? '') : [];

  return (
    <S.Page>
      <S.Header>
        <S.HeaderLeft>
          <S.TitleRow>
            {getScreenIcon(definition.icon, 22)}
            <S.Title>{vm.isNew ? `Novo ${definition.titleSingular}` : definition.titleSingular}</S.Title>
          </S.TitleRow>
          {!vm.isNew && definition.hasTags && appliedTags.length > 0 && (
            <S.Tags>
              {appliedTags.map((t) => (
                <S.TagPill key={t.id} $color={t.color}>
                  <S.TagDot $color={t.color} />
                  {t.name}
                </S.TagPill>
              ))}
            </S.Tags>
          )}
        </S.HeaderLeft>
        <S.HeaderActions>
          {!vm.isNew && (
            <Button variant="ghost" size="sm" onClick={vm.handleCopyDeepLink} title="Copiar link">
              {vm.copyLinkDone ? <RiCheckLine size={14} /> : <RiLinkM size={14} />}
            </Button>
          )}
          {!vm.isNew && (
            <Button variant="ghost" size="sm" onClick={vm.handleClone} title="Clonar">
              <RiFileCopyLine size={14} />
            </Button>
          )}
          {!vm.isNew && definition.hasTags && (
            <Button variant="ghost" size="sm" onClick={vm.openTagManager} title="Gerenciar etiquetas">
              <RiPriceTag3Line size={14} />
            </Button>
          )}
          {(vm.activeTab === 'data' || vm.isNew) && (
            <S.SaveBtn onClick={() => void vm.handleSave()} disabled={vm.isSaving} title={vm.isSaving ? 'Salvando...' : 'Salvar'}>
              <RiSaveLine size={14} />
            </S.SaveBtn>
          )}
          {!vm.isNew && vm.isAdmin && (
            <S.DeleteBtn onClick={vm.requestDelete} title="Excluir">
              <RiDeleteBinLine size={14} />
            </S.DeleteBtn>
          )}
        </S.HeaderActions>
      </S.Header>

      {showTabs && (
        <S.TabBar>
          <S.TabBtn $active={vm.activeTab === 'data'} onClick={() => vm.setActiveTab('data')}>Dados</S.TabBtn>
          {definition.hasNotes && (
            <S.TabBtn $active={vm.activeTab === 'notes'} onClick={() => vm.setActiveTab('notes')}>Anotações</S.TabBtn>
          )}
          {definition.hasDocuments && (
            <S.TabBtn $active={vm.activeTab === 'documents'} onClick={() => vm.setActiveTab('documents')}>Documentos</S.TabBtn>
          )}
        </S.TabBar>
      )}

      <S.Content>
        {(vm.activeTab === 'data' || vm.isNew) && (
          <S.FormWrapper>
            <CustomFieldsSection
              screenKey={vm.screenKey}
              fields={vm.sortedFields}
              values={vm.formValues}
              onChange={vm.setFieldValue}
            />
          </S.FormWrapper>
        )}

        {vm.activeTab === 'notes' && !vm.isNew && definition.hasNotes && (
          <NotesPanel controller={vm.notesController} isAdmin={vm.isAdmin} />
        )}

        {vm.activeTab === 'documents' && !vm.isNew && definition.hasDocuments && (
          <DocumentsPanel controller={vm.docsController} isAdmin={vm.isAdmin} />
        )}
      </S.Content>

      {vm.isTagManagerOpen && vm.recordId && (
        <TagManager
          entityId={vm.recordId}
          onClose={vm.closeTagManager}
          adapter={vm.tagAdapter}
        />
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
    </S.Page>
  );
};
