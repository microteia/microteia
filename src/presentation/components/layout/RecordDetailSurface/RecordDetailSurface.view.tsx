import React from 'react';
import { CustomFieldsSection } from '../../ui/CustomFieldsSection';
import { UserAvatar } from '../../ui/UserAvatar';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { TagManager } from '../../ui/TagManager';
import { InfoBanner } from '../../ui/InfoBanner';
import { Spinner } from '../../ui/Spinner';
import { EntityDetailView } from '../EntityDetailView';
import type { EntityDetailExtraTab, EntityDetailTab } from '../EntityDetailView';
import { getScreenIcon } from '../../../shared/screenIcons';
import type { ScreenActions } from '../../../shared/entityScreen/useScreenActions';
import type { EditWindowState } from '../../../shared/entityScreen/useEditWindow';
import type { EntityDocumentsController, EntityNotesController, FieldFileUpload } from '../../../shared/entityScreen/types';
import type { TagStoreAdapter } from '../../ui/TagManager';
import type { CustomFieldValue, EntityRecord, FieldDefinition, ScreenDefinition } from '../../../../domain/entities';

import { useLabel, useT } from '../../../shared/i18n/useT';
/**
 * A superfície do DETALHE (criar/editar) de uma tela de registros — o par do `RecordDetailSurface`
 * para `RecordListSurface`. Renderiza a `EntityDetailView` (cabeçalho com salvar/excluir/clonar/
 * copiar-link/etiquetas, abas Dados/Anotações/Documentos) a partir de um view model, e o corpo de
 * "Dados" por padrão com `CustomFieldsSection` (grade 1fr 1fr, seções e campos do schema). Uma tela
 * de código pode injetar um corpo próprio via `renderData` sem perder o resto padrão.
 */
export interface RecordDetailViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoadingDefinition: boolean;
  isNew: boolean;
  /** Algum campo foi alterado e ainda não foi salvo — exposto às expressões como `isDirty`. */
  isDirty: boolean;
  canDeleteRecordParts: boolean;
  canManageDocumentTypes: boolean;
  /** Excluir é de admin — ou do autor, quando a tela declara `authorCanDelete`. */
  canDelete: boolean;
  /** A janela de edição do registro. `null` = a tela não declara prazo, ou o registro é novo. */
  editWindow: EditWindowState | null;
  /** O prazo passou: os campos travam e salvar some, com o motivo à vista. */
  isEditLocked: boolean;
  /** A COLEÇÃO do registro — o que `<entity>` vira nas expressões dos campos. */
  collection: string;
  canSave: boolean;
  screenKey: string;
  recordId: string | null;
  recordNotFound: boolean;
  /** Título do REGISTRO (campo-título). Vazio → o cabeçalho cai no nome da tela. */
  recordTitle: string;
  /** Subtítulo do registro (`subtitleFieldKey`), abaixo do título. Vazio → sem subtítulo. */
  recordSubtitle: string;
  /** Imagem do registro (`imageFieldKey`), no lugar do ícone da tela. Ausente = o ícone. */
  recordImageUrl: string | null;
  /** Envio dos campos `file`. Ausente = campos de arquivo somente-leitura. */
  fileUpload: FieldFileUpload | null;
  sortedFields: FieldDefinition[];
  formValues: Record<string, CustomFieldValue>;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  mergeValues: (patch: Record<string, unknown>) => void;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  handleSave: () => void | Promise<void>;
  handleClone: () => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  screenActions: ScreenActions;
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  childTabs: EntityDetailExtraTab[];
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
  recordToDelete: EntityRecord | null;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
}

interface RecordDetailSurfaceProps {
  vm: RecordDetailViewModel;
  /** Corpo da aba "Dados". Ausente → formulário padrão do schema (`CustomFieldsSection`). */
  renderData?: (vm: RecordDetailViewModel) => React.ReactNode;
}

export const RecordDetailSurface: React.FC<RecordDetailSurfaceProps> = ({ vm, renderData }) => {
  const { definition } = vm;
  const t = useT('core.ui');
  const label = useLabel();

  if (!vm.isAvailable || !definition) {
    return (
      <div style={{ padding: 24 }}>
        {vm.isLoadingDefinition ? <Spinner /> : (
          <InfoBanner variant="info" message={t('record.screen-unavailable')} />
        )}
      </div>
    );
  }

  if (vm.recordNotFound) {
    return (
      <div style={{ padding: 24 }}>
        <InfoBanner variant="info" message={t('record.not-found')} />
      </div>
    );
  }

  const appliedTags = !vm.isNew ? vm.tagAdapter.getAppliedTags(vm.recordId ?? '') : [];

  const dataContent = (
    <>
      {vm.editWindow && (
        <InfoBanner variant={vm.isEditLocked ? 'warning' : 'info'} message={vm.editWindow.notice} />
      )}
      {renderData ? renderData(vm) : (
        <CustomFieldsSection
          entity={vm.collection}
          fields={vm.sortedFields}
          values={vm.formValues}
          onChange={vm.setFieldValue}
          onMergeValues={vm.mergeValues}
          errors={vm.fieldErrors}
          fileUpload={vm.fileUpload ?? undefined}
          isNew={vm.isNew}
          isDirty={vm.isDirty}
          disabled={vm.isEditLocked}
        />
      )}
    </>
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
        confirmLabel={t('action.delete')}
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
      canDeleteRecordParts={vm.canDeleteRecordParts}
      canManageDocumentTypes={vm.canManageDocumentTypes}
      avatar={vm.recordImageUrl
        ? <UserAvatar src={vm.recordImageUrl} name={vm.recordTitle} size={48} fallback={getScreenIcon(definition.icon, 22)} />
        : getScreenIcon(definition.icon, 22)}
      title={vm.isNew
        ? t('core.records/record.new.title', { entity: label(definition.titleSingular) })
        : (vm.recordTitle || label(definition.titleSingular))}
      subtitle={!vm.isNew && vm.recordSubtitle ? vm.recordSubtitle : undefined}
      tags={appliedTags}
      showTags={!vm.isNew && definition.hasTags}
      copyLinkDone={vm.copyLinkDone}
      onCopyLink={vm.handleCopyDeepLink}
      onClone={vm.handleClone}
      showTagsAction={!vm.isNew && definition.hasTags}
      onManageTags={vm.openTagManager}
      onSave={() => void vm.handleSave()}
      canSave={vm.canSave}
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
