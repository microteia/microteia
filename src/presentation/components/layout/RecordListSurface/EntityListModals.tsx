import React from 'react';
import { ActionParametersModal } from '../../ui/ActionParametersModal';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { TagManager } from '../../ui/TagManager';
import type { RecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';

/**
 * Os modais governados pela configuração de uma listagem de registros: o gerenciador de etiquetas e a
 * confirmação de exclusão. Vive num componente próprio para ser montado UMA vez tanto pela lista
 * padrão (`RecordListSurface`) quanto por uma tela de código de extensão que reaproveite as ações
 * (`useEntityList().getCardActions`) fora da lista — ex.: no cabeçalho da tela de edição.
 */
export const EntityListModals: React.FC<{ vm: RecordListViewModel }> = ({ vm }) => (
  <>
    {vm.tagManagerRecord && (
      <TagManager entityId={vm.tagManagerRecord.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
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
    <ActionParametersModal controller={vm.parameterPrompt} />
  </>
);
