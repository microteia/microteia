import { useCallback, useEffect, useMemo, useState } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useCustomRecords } from '../../../stores/useCustomRecords';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetCustomRecordByIdUseCase } from '../../../domain/usecases/customrecords/GetCustomRecordByIdUseCase';
import {
  buildCloneTabKey,
  buildViewTabKey,
  parseDynamicTabKey,
} from '../../../shared/constants/dynamicScreenKeys';
import {
  buildInitialFormValues,
  formValuesToStoredValues,
  resolveRecordTitle,
  sortFieldsByOrder,
  validateRequiredFields,
} from '../../../domain/services/customFieldValues';
import type { CustomFieldValue, CustomRecord, FieldDefinition, ScreenDefinition } from '../../../domain/entities';

export interface ViewDynamicRecordViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoadingDefinition: boolean;
  isNew: boolean;
  isAdmin: boolean;
  screenKey: string;
  sortedFields: FieldDefinition[];
  formValues: Record<string, CustomFieldValue>;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  handleClone: () => void;
  recordToDelete: CustomRecord | null;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  recordNotFound: boolean;
}

export const useViewDynamicRecordViewModel = (tabKey: string): ViewDynamicRecordViewModel => {
  const { getDefinition, isLoading: isLoadingDefinition } = useScreenDefinitions();
  const { recordsByScreen, createRecord, updateRecord, deleteRecord } = useCustomRecords();
  const { currentTenant, tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { customRecordRepository } = useDI();

  const tabInfo = useMemo(() => parseDynamicTabKey(tabKey), [tabKey]);
  const screenKey = tabInfo?.screenKey ?? '';
  const isNew = tabInfo?.kind === 'new';
  const recordId = tabInfo?.kind === 'view' ? tabInfo.recordId ?? null : null;
  const cloneSourceId = tabInfo?.cloneSourceId ?? null;

  const definition = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const isAvailable = !!definition && !definition.builtin;
  const isAdmin = tenantRole === 'admin';

  const getByIdUC = useMemo(() => makeGetCustomRecordByIdUseCase(customRecordRepository), [customRecordRepository]);

  const [fetchedRecord, setFetchedRecord] = useState<CustomRecord | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const storeRecord = useMemo(() => {
    const targetId = recordId ?? cloneSourceId;
    if (!targetId) return null;
    return (recordsByScreen[screenKey] ?? []).find((r) => r.id === targetId) ?? null;
  }, [recordsByScreen, screenKey, recordId, cloneSourceId]);

  const sourceRecord = storeRecord ?? fetchedRecord;

  useEffect(() => {
    const targetId = recordId ?? cloneSourceId;
    if (!targetId || storeRecord || !currentTenant) return;
    let cancelled = false;
    getByIdUC.execute(currentTenant.id, targetId)
      .then((record) => {
        if (cancelled) return;
        setFetchedRecord(record);
        setFetchAttempted(true);
      })
      .catch(() => {
        if (!cancelled) setFetchAttempted(true);
      });
    return () => { cancelled = true; };
  }, [recordId, cloneSourceId, storeRecord, currentTenant, getByIdUC]);

  const sortedFields = useMemo(
    () => (definition ? sortFieldsByOrder(definition.fields) : []),
    [definition],
  );

  const [formValues, setFormValues] = useState<Record<string, CustomFieldValue>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [recordToDelete, setRecordToDelete] = useState<CustomRecord | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar definição/registro
    setFormValues(buildInitialFormValues(sortedFields, sourceRecord?.values ?? null));
  }, [sortedFields, sourceRecord]);

  useEffect(() => {
    if (!definition) return;
    if (isNew) {
      setTabTitle(tabKey, `Novo ${definition.titleSingular}`);
    } else if (sourceRecord) {
      setTabTitle(tabKey, sourceRecord.title);
    }
  }, [definition, isNew, sourceRecord, tabKey, setTabTitle]);

  const setFieldValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setFormValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!definition || !currentTenant) return;
    const validationError = validateRequiredFields(sortedFields, formValues);
    if (validationError) {
      notify(validationError, 'error');
      return;
    }
    setIsSaving(true);
    try {
      const values = formValuesToStoredValues(sortedFields, formValues);
      const title = resolveRecordTitle(values, definition.titleFieldKey);
      if (isNew) {
        const created = await createRecord({
          screenKey,
          title,
          values,
          createdBy: user?.id ?? '',
        });
        notify(`${definition.titleSingular} cadastrado com sucesso!`, 'success');
        const newTabKey = buildViewTabKey(screenKey, created.id);
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.title);
      } else if (recordId) {
        await updateRecord(recordId, screenKey, {
          title,
          values,
          updatedBy: user?.id ?? '',
          updatedByName: effectiveName,
          updatedByPhotoURL: user?.photoURL ?? '',
        });
        notify(`${definition.titleSingular} atualizado com sucesso!`, 'success');
        setTabTitle(tabKey, title);
      }
    } catch {
      notify('Erro ao salvar o registro.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [definition, currentTenant, sortedFields, formValues, isNew, recordId, screenKey, createRecord, updateRecord, user, effectiveName, notify, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const handleClone = useCallback(() => {
    if (!recordId) return;
    openTab(buildCloneTabKey(screenKey, recordId));
  }, [openTab, screenKey, recordId]);

  const requestDelete = useCallback(() => {
    if (sourceRecord && recordId) setRecordToDelete(sourceRecord);
  }, [sourceRecord, recordId]);

  const cancelDelete = useCallback(() => setRecordToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!recordToDelete) return;
    setIsDeleting(true);
    try {
      await deleteRecord(recordToDelete.id, screenKey);
      notify('Registro excluído com sucesso.', 'success');
      setRecordToDelete(null);
      closeTab(tabKey, activePanelId ?? 'main');
    } catch {
      notify('Erro ao excluir o registro.', 'error');
    } finally {
      setIsDeleting(false);
    }
  }, [recordToDelete, deleteRecord, screenKey, notify, closeTab, tabKey, activePanelId]);

  const recordNotFound = !isNew && !sourceRecord && fetchAttempted;

  return {
    definition,
    isAvailable,
    isLoadingDefinition,
    isNew,
    isAdmin,
    screenKey,
    sortedFields,
    formValues,
    setFieldValue,
    isSaving,
    handleSave,
    handleClone,
    recordToDelete,
    requestDelete,
    cancelDelete,
    confirmDelete,
    isDeleting,
    recordNotFound,
  };
};
