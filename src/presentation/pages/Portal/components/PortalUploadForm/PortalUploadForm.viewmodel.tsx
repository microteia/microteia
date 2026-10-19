import { useCallback, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { usePortal } from '../../../../../stores/usePortal';
import { useLabel, useT } from '../../../../shared/i18n/useT';
import { PORTAL_UPLOAD_MAX_BYTES } from '../../../../../domain/schema/portal';

export interface PortalUploadFormProps {
  collection: string;
  recordId: string;
  /** Os tipos que a tela oferece — o convidado escolhe um, e não há gesto de criar outro. */
  types: Array<{ value: string; label: string }>;
  onUploaded: () => void;
}

/**
 * Anexar ao registro aberto: o tipo (da lista fechada), o arquivo e o envio. Não há gesto de excluir
 * — nem aqui, nem em lugar nenhum do portal.
 */
export const usePortalUploadFormViewModel = ({ collection, recordId, onUploaded }: PortalUploadFormProps) => {
  const t = useT('core.tenant');
  const label = useLabel();
  const { uploadDocument } = usePortal();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [type, setType] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFile = useCallback(() => fileInputRef.current?.click(), []);

  const chooseFile = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    const chosen = event.target.files?.[0] ?? null;
    event.target.value = '';
    setSent(false);
    if (chosen && chosen.size > PORTAL_UPLOAD_MAX_BYTES) {
      setFile(null);
      setError(t('portal.upload.too-large'));
      return;
    }
    setError(null);
    setFile(chosen);
  }, [t]);

  const send = useCallback(async () => {
    if (!file || !type) return;
    setSending(true);
    setError(null);
    try {
      await uploadDocument(collection, recordId, file, type);
      setFile(null);
      setType('');
      setSent(true);
      onUploaded();
    } catch (err) {
      // A recusa do servidor é uma referência do catálogo (`@core.tenant/...`) — traduzida aqui.
      setError(err instanceof Error && err.message ? label(err.message) : t('portal.upload.failed'));
    } finally {
      setSending(false);
    }
  }, [file, type, uploadDocument, collection, recordId, onUploaded, label, t]);

  return {
    fileInputRef,
    type,
    setType,
    fileName: file?.name ?? '',
    pickFile,
    chooseFile,
    canSend: !!file && !!type && !sending,
    sending,
    sent,
    error,
    send,
  };
};
