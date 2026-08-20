import { useMemo } from 'react';
import { useTenant } from '../../../stores/useTenant';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeUploadRecordFileUseCase } from '../../../domain/usecases/records/UploadRecordFileUseCase';
import type { FieldFileUpload } from './types';

/**
 * Amarra o envio de arquivo de campo a UMA coleção. `ensureRecordId` é chamado DENTRO do `upload`, e
 * não na montagem: é o que faz o id de um registro novo ser cunhado só quando alguém escolhe um
 * arquivo — antes disso não há nada para nomear.
 *
 * Sem tenant ou sem id (uma tela que não cunha), o envio recusa em vez de gravar num caminho
 * inventado: o controle mostra o campo somente-leitura.
 */
export const useRecordFileUpload = (
  collection: string,
  ensureRecordId: () => string | null,
): FieldFileUpload | null => {
  const { currentTenant } = useTenant();
  const { recordFileRepository } = useDI();
  const uc = useMemo(() => makeUploadRecordFileUseCase(recordFileRepository), [recordFileRepository]);
  return useMemo<FieldFileUpload | null>(() => {
    if (!currentTenant || !collection) return null;
    return {
      upload: (fieldKey, file) => {
        const recordId = ensureRecordId();
        if (!recordId) return Promise.reject(new Error('No record id for file upload'));
        return uc.execute(currentTenant.id, collection, recordId, fieldKey, file);
      },
    };
  }, [currentTenant, collection, ensureRecordId, uc]);
};
