import React, { useRef } from 'react';
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiShareForwardLine,
  RiUploadLine,
} from 'react-icons/ri';
import { S } from './panels.styles';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { DynamicSelect } from '../../ui/DynamicSelect';
import { InfoBanner } from '../../ui/InfoBanner';
import type { EntityDocumentsController } from '../../../shared/entityScreen/types';
import { useT, useLocaleFormat } from '../../../shared/i18n/useT';

interface DocumentsPanelProps {
  controller: EntityDocumentsController;
  /** Pode excluir um documento anexado — a permissão de exclusão da coleção do registro. */
  canDelete: boolean;
  /**
   * A janela de edição do registro fechou: anexar continua, excluir não — para ninguém, como na regra.
   */
  isLocked?: boolean;
  /** Pode tirar um TIPO de documento da lista compartilhada do escritório. */
  canManageTypes: boolean;
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({ controller: vm, canDelete, isLocked = false, canManageTypes }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const t = useT('core.ui');
  const { formatLongDate } = useLocaleFormat();

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        multiple
        style={{ display: 'none' }}
        onChange={vm.handleSelectFiles}
      />

      {isLocked && <InfoBanner variant="info" message={t('documents.locked')} />}

      <S.TabSectionHeader>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={vm.isUploadingDoc}
        >
          <RiUploadLine size={14} />
          {t('documents.attach')}
        </Button>
      </S.TabSectionHeader>

      {vm.pendingUploads.length > 0 && (
        <S.PendingList>
          {vm.pendingUploads.map((pending) => (
            <S.PendingFileCard key={pending.id} $failed={pending.status === 'failed'}>
              <S.PendingFileTopRow>
                <S.DocIcon>
                  {pending.status === 'uploading' ? <Spinner size={18} /> : <RiFileTextLine />}
                </S.DocIcon>
                <S.PendingFileContent>
                  <DynamicSelect
                    staticOptions={vm.documentTypeOptions}
                    dynamicOptions={vm.documentTypeDynamicOptions}
                    value={pending.type}
                    onChange={(value) => vm.setPendingUploadType(pending.id, value)}
                    placeholder={t('documents.type.placeholder')}
                    onAdd={vm.handleAddDocumentType}
                    onDelete={canManageTypes ? vm.handleDeleteDocumentType : undefined}
                    deleteConfirmTitle={t('documents.type.delete.title')}
                    deleteConfirmMessage={t('documents.type.delete.message')}
                    disabled={vm.isUploadingDoc}
                  />
                </S.PendingFileContent>
                <S.PendingFileActions>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => vm.removePendingUpload(pending.id)}
                    disabled={vm.isUploadingDoc}
                    title={t('documents.pending.remove')}
                  >
                    <RiCloseLine size={14} />
                  </Button>
                </S.PendingFileActions>
              </S.PendingFileTopRow>
              <S.PendingFileName title={pending.file.name}>{pending.file.name}</S.PendingFileName>
            </S.PendingFileCard>
          ))}

          <S.PendingActionsBar>
            <Button variant="ghost" size="sm" onClick={vm.handleCancelPendingUpload} disabled={vm.isUploadingDoc}>
              <RiCloseLine size={14} />
              {t('action.cancel')}
            </Button>
            <Button size="sm" onClick={() => void vm.handleConfirmUpload()} disabled={vm.isUploadingDoc}>
              {vm.isUploadingDoc
                ? t('documents.uploading')
                : vm.pendingUploads.length === 1
                  ? t('documents.confirm-upload')
                  : t('documents.confirm-upload.many', { count: vm.pendingUploads.length })}
            </Button>
          </S.PendingActionsBar>
        </S.PendingList>
      )}

      {vm.docsLoading ? (
        <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
      ) : vm.documents.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
          <div>{t('documents.empty')}</div>
        </S.EmptyState>
      ) : (
        <S.DocList>
          {vm.documents.map((docItem) => (
            <S.DocRow key={docItem.id}>
              <S.DocIcon><RiFileTextLine /></S.DocIcon>
              <S.DocContent>
                <S.DocName href={docItem.url} target="_blank" rel="noopener noreferrer" title={docItem.name}>
                  {docItem.name}
                </S.DocName>
                {docItem.description && <S.DocMeta>{docItem.description}</S.DocMeta>}
                {docItem.sha256 && (
                  <S.DocHash title={t('documents.sha256.hint')}>
                    {t('documents.sha256', { hash: docItem.sha256 })}
                  </S.DocHash>
                )}
                <S.DocUploaderRow>
                  <S.DocUploaderAvatar>
                    {docItem.createdByPhotoUrl
                      ? <S.AvatarImg src={docItem.createdByPhotoUrl} alt={docItem.createdByName} />
                      : (docItem.createdByName || 'U').charAt(0).toUpperCase()}
                  </S.DocUploaderAvatar>
                  <S.DocMeta>
                    {docItem.createdByName} · {formatLongDate(docItem.createdAt)}
                  </S.DocMeta>
                </S.DocUploaderRow>
              </S.DocContent>
              {docItem.type && <S.DocTypeBadge>{docItem.type}</S.DocTypeBadge>}
              {docItem.portalShared && <S.PortalBadge>{t('documents.portal.badge')}</S.PortalBadge>}
              <S.DocActions>
                {vm.canShareInPortal && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => void vm.togglePortalShared(docItem)}
                    title={docItem.portalShared ? t('documents.portal.unshare') : t('documents.portal.share')}
                  >
                    <RiShareForwardLine size={14} />
                  </Button>
                )}
                <Button variant="ghost" size="sm" onClick={() => window.open(docItem.url, '_blank', 'noopener,noreferrer')} title={t('documents.open')}>
                  <RiExternalLinkLine size={14} />
                </Button>
                {canDelete && !isLocked && (
                  <Button variant="ghost" size="sm" onClick={() => vm.requestDeleteDoc(docItem)} title={t('documents.delete')}>
                    <RiDeleteBinLine size={13} />
                  </Button>
                )}
              </S.DocActions>
            </S.DocRow>
          ))}
        </S.DocList>
      )}

      <ConfirmModal
        isOpen={!!vm.docToDelete}
        onConfirm={() => void vm.confirmDeleteDoc()}
        onCancel={vm.cancelDeleteDoc}
        title={t('documents.delete.title')}
        message={t('documents.delete.message', { name: vm.docToDelete?.name ?? '' })}
        confirmLabel={t('action.delete')}
        variant="danger"
      />
    </>
  );
};
