import React, { useRef } from 'react';
import {
  RiCloseLine,
  RiDeleteBinLine,
  RiExternalLinkLine,
  RiFileTextLine,
  RiUploadLine,
} from 'react-icons/ri';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { S } from './panels.styles';
import { Button } from '../../ui/Button';
import { Spinner } from '../../ui/Spinner';
import { ConfirmModal } from '../../ui/ConfirmModal';
import { DynamicSelect } from '../../ui/DynamicSelect';
import type { EntityDocumentsController } from '../../../shared/entityScreen/types';

interface DocumentsPanelProps {
  controller: EntityDocumentsController;
  isAdmin: boolean;
}

export const DocumentsPanel: React.FC<DocumentsPanelProps> = ({ controller: vm, isAdmin }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input ref={fileInputRef} type="file" style={{ display: 'none' }} onChange={vm.handleSelectFile} />

      <S.TabSectionHeader>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={vm.isUploadingDoc || !!vm.pendingFile}
        >
          <RiUploadLine size={14} />
          Anexar Documento
        </Button>
      </S.TabSectionHeader>

      {vm.pendingFile && (
        <S.PendingFileCard>
          <S.PendingFileTopRow>
            <S.DocIcon><RiFileTextLine /></S.DocIcon>
            <S.PendingFileContent>
              <DynamicSelect
                staticOptions={vm.documentTypeOptions}
                dynamicOptions={vm.documentTypeDynamicOptions}
                value={vm.pendingType}
                onChange={vm.setPendingType}
                placeholder="Tipo (opcional)"
                onAdd={vm.handleAddDocumentType}
                onDelete={isAdmin ? vm.handleDeleteDocumentType : undefined}
                deleteConfirmTitle="Excluir tipo de documento"
                deleteConfirmMessage="Tem certeza que deseja excluir este tipo de documento?"
                disabled={vm.isUploadingDoc}
              />
            </S.PendingFileContent>
            <S.PendingFileActions>
              <Button variant="ghost" size="sm" onClick={vm.handleCancelPendingUpload} disabled={vm.isUploadingDoc}>
                <RiCloseLine size={14} />
                Cancelar
              </Button>
              <Button size="sm" onClick={() => void vm.handleConfirmUpload()} disabled={vm.isUploadingDoc}>
                {vm.isUploadingDoc ? 'Enviando...' : 'Confirmar Envio'}
              </Button>
            </S.PendingFileActions>
          </S.PendingFileTopRow>
          <S.PendingFileName title={vm.pendingFile.name}>{vm.pendingFile.name}</S.PendingFileName>
        </S.PendingFileCard>
      )}

      {vm.docsLoading ? (
        <S.SpinnerWrap><Spinner /></S.SpinnerWrap>
      ) : vm.documents.length === 0 ? (
        <S.EmptyState>
          <S.EmptyIcon><RiFileTextLine /></S.EmptyIcon>
          <div>Nenhum documento anexado.</div>
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
                <S.DocUploaderRow>
                  <S.DocUploaderAvatar>
                    {docItem.createdByPhotoUrl
                      ? <S.AvatarImg src={docItem.createdByPhotoUrl} alt={docItem.createdByName} />
                      : (docItem.createdByName || 'U').charAt(0).toUpperCase()}
                  </S.DocUploaderAvatar>
                  <S.DocMeta>
                    {docItem.createdByName} · {format(docItem.createdAt, "d 'de' MMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </S.DocMeta>
                </S.DocUploaderRow>
              </S.DocContent>
              {docItem.type && <S.DocTypeBadge>{docItem.type}</S.DocTypeBadge>}
              <S.DocActions>
                <Button variant="ghost" size="sm" onClick={() => window.open(docItem.url, '_blank', 'noopener,noreferrer')} title="Abrir documento">
                  <RiExternalLinkLine size={14} />
                </Button>
                {isAdmin && (
                  <Button variant="ghost" size="sm" onClick={() => vm.requestDeleteDoc(docItem)} title="Excluir documento">
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
        title="Excluir Documento"
        message={`Tem certeza que deseja excluir "${vm.docToDelete?.name}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        variant="danger"
      />
    </>
  );
};
