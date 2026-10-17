import { useCallback, useMemo, useState } from 'react';
import { useDI } from '../../../../../infrastructure/di/useDI';
import { useTenant } from '../../../../../stores/useTenant';
import { useAuthorization } from '../../../../../stores/useAuthorization';
import { useNotification } from '../../../../../stores/useNotification';
import { useScreenDefinitions } from '../../../../../stores/useScreenDefinitions';
import { useLookups } from '../../../../../stores/useLookups';
import { storeEvents, StoreEvents } from '../../../../../infrastructure/events/StoreEventEmitter';
import { collectionPermissionId } from '../../../../../domain/schema/access/permission';
import { screenDataCollection } from '../../../../../domain/services/screenDataCollection';
import type { DownloadOrigin } from '../../../../../domain/schema/document/documentDownloads';
import { useReferenceOptions } from '../../../../hooks/useReferenceOptions';
import { useLabel, useT } from '../../../../shared/i18n/useT';
import type { SearchSelectOption } from '../../../../components/ui/SearchSelect';

export interface AttachDownloadDialogProps {
  download: { id: string; name: string; origin: DownloadOrigin | null };
  onClose: () => void;
}

export interface AttachDownloadDialogViewModel {
  hasScreens: boolean;
  screenOptions: SearchSelectOption[];
  collection: string;
  setCollection: (collection: string) => void;
  recordOptions: SearchSelectOption[];
  recordId: string;
  setRecordId: (recordId: string) => void;
  documentTypeOptions: SearchSelectOption[];
  documentType: string;
  setDocumentType: (documentType: string) => void;
  isAttaching: boolean;
  canAttach: boolean;
  handleAttach: () => Promise<void>;
}

/**
 * Para onde o arquivo pode ir: as telas com a aba Documentos cujos registros esta pessoa EDITA — anexar
 * altera o registro. A primeira sugestão é o registro de onde o arquivo saiu, quando ele cabe aí.
 */
export const useAttachDownloadDialogViewModel = (props: AttachDownloadDialogProps): AttachDownloadDialogViewModel => {
  const { download, onClose } = props;
  const { downloadRepository } = useDI();
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const { notify } = useNotification();
  const { dynamicScreens } = useScreenDefinitions();
  const { getOptions } = useLookups();
  const referenceOptions = useReferenceOptions();
  const t = useT('core.documents');
  const label = useLabel();

  const screenOptions = useMemo(() => {
    const byCollection = new Map<string, SearchSelectOption>();
    for (const screen of dynamicScreens) {
      const collection = screenDataCollection(screen);
      if (!screen.hasDocuments || byCollection.has(collection)) continue;
      if (!can(collectionPermissionId(collection, 'update'))) continue;
      byCollection.set(collection, { value: collection, label: label(screen.titlePlural), meta: collection });
    }
    return [...byCollection.values()].sort((left, right) => left.label.localeCompare(right.label));
  }, [dynamicScreens, can, label]);

  const origin = download.origin && screenOptions.some((one) => one.value === download.origin?.collection)
    ? download.origin
    : null;

  const [chosenCollection, setChosenCollection] = useState<string | null>(null);
  const [chosenRecordId, setChosenRecordId] = useState<string | null>(null);
  const [documentType, setDocumentType] = useState('');
  const [isAttaching, setIsAttaching] = useState(false);

  const collection = chosenCollection ?? origin?.collection ?? screenOptions[0]?.value ?? '';
  const recordId = chosenRecordId ?? (origin && origin.collection === collection ? origin.recordId : '');

  const recordOptions = useMemo(
    () => (referenceOptions[collection] ?? []).map((option) => ({ value: option.value, label: option.label, meta: option.meta })),
    [referenceOptions, collection],
  );

  const documentTypeOptions = useMemo(
    () => getOptions('documentTypes').map((option) => ({ value: option.key, label: label(option.label) })),
    [getOptions, label],
  );

  const setCollection = useCallback((next: string) => {
    setChosenCollection(next);
    setChosenRecordId('');
  }, []);

  const handleAttach = useCallback(async () => {
    if (!currentTenant || !collection || !recordId) return;
    setIsAttaching(true);
    try {
      const result = await downloadRepository.attachToRecord({
        tenantId: currentTenant.id,
        downloadId: download.id,
        collection,
        recordId,
        ...(documentType ? { documentType } : {}),
      });
      if (!result.document) {
        notify(label(result.error ?? '@core.documents/downloads.attach.failed', result.errorParams), 'error');
        return;
      }
      storeEvents.emit(StoreEvents.RECORD_DOCUMENTS_UPDATED);
      notify(
        t(result.moved === false ? 'downloads.attach.copied' : 'downloads.attach.done', { name: result.document.name }),
        'success',
      );
      onClose();
    } catch {
      notify(t('downloads.attach.failed'), 'error');
    } finally {
      setIsAttaching(false);
    }
  }, [currentTenant, collection, recordId, documentType, downloadRepository, download.id, notify, label, t, onClose]);

  return {
    hasScreens: screenOptions.length > 0,
    screenOptions,
    collection,
    setCollection,
    recordOptions,
    recordId,
    setRecordId: setChosenRecordId,
    documentTypeOptions,
    documentType,
    setDocumentType,
    isAttaching,
    canAttach: !!collection && !!recordId && !isAttaching,
    handleAttach,
  };
};
