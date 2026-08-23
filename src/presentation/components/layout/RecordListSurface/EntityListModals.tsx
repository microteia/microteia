import React from 'react';
import { ActionParametersModal } from '../../ui/ActionParametersModal';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { TagManager } from '../../ui/TagManager';
import type { RecordListViewModel } from '../../../shared/entityScreen/useRecordListViewModel';
import { useT } from '../../../shared/i18n/useT';

/**
 * Os modais governados pela configuração de uma listagem de registros: o gerenciador de etiquetas e a
 * confirmação de exclusão e a confirmação de uma ação que pergunta antes de agir.
 *
 * Vive num componente próprio para ser montado UMA vez tanto pela lista padrão
 * (`RecordListSurface`) quanto por uma tela de código de extensão que reaproveite as ações
 * (`useEntityList().getCardActions`) fora da lista — ex.: no cabeçalho da tela de edição.
 */
export const EntityListModals: React.FC<{ vm: RecordListViewModel }> = ({ vm }) => {
  const t = useT('core.ui');

  return (
  <>
    {vm.tagManagerRecord && (
      <TagManager entityId={vm.tagManagerRecord.id} onClose={vm.closeTagManager} adapter={vm.tagAdapter} />
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
    {/* A confirmação da ação do CARTÃO. O detalhe já a tinha; aqui a mesma ação disparava direto. */}
    <ConfirmModal
      isOpen={vm.pendingCardAction !== null}
      title={vm.pendingCardAction?.action.title ?? ''}
      message={vm.pendingCardAction?.action.confirmMessage ?? ''}
      variant={vm.pendingCardAction?.action.danger ? 'danger' : 'default'}
      confirmLabel={t('action.run')}
      onConfirm={vm.confirmPendingCardAction}
      onCancel={vm.cancelPendingCardAction}
    />
    <ActionParametersModal controller={vm.parameterPrompt} />
  </>
  );
};
