import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useTenant } from '../../../stores/useTenant';
import { setValueByPath } from '../../../domain/services/customFieldValues';
import type { CustomFieldValue } from '../../../domain/entities';
import type { EntityDetailTab } from '../../components/layout/EntityDetailView';
import { useEntityDetailChrome } from './useEntityDetailChrome';
import { useEntityNotes } from './useEntityNotes';
import { useEntityDocuments } from './useEntityDocuments';
import type {
  DocumentsPort,
  EntityDocumentsController,
  EntityNotesController,
  NotesPort,
} from './types';

type Values = Record<string, CustomFieldValue>;

export interface EntityValidationResult {
  message: string;
  fieldErrors: Record<string, string>;
}

export interface EntityDetailConfig<TRecord extends { id: string }> {
  tabKey: string;
  parse: (tabKey: string) => { isNew: boolean; recordId: string | null; cloneSourceId: string | null };
  findInStore: (id: string) => TRecord | null;
  getById?: (id: string) => Promise<TRecord | null>;
  recordToValues: (record: TRecord | null, opts: { clone: boolean }) => Values;
  resolveTabTitle: (record: TRecord | null, isNew: boolean) => string | null;
  resolveTitleFromValues: (values: Values) => string;
  validate: (values: Values) => EntityValidationResult | null;
  create: (values: Values) => Promise<{ id: string; title: string }>;
  update: (recordId: string, values: Values) => Promise<void>;
  messages: { created: string; updated: string; error: string };
  deepLinkKey: (id: string) => string;
  cloneKey: (id: string) => string;
  remove: (id: string) => Promise<void>;
  removedMessage: string;
  removeErrorMessage: string;
  notesPort: NotesPort;
  documentsPort: DocumentsPort;
  hasNotes: boolean;
  hasDocuments: boolean;
}

export interface EntityDetail<TRecord extends { id: string }> {
  isNew: boolean;
  record: TRecord | null;
  recordNotFound: boolean;
  values: Values;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleteOpen: boolean;
  isDeleting: boolean;
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
}

export function useEntityDetail<TRecord extends { id: string }>(
  config: EntityDetailConfig<TRecord>,
): EntityDetail<TRecord> {
  const {
    tabKey, parse, findInStore, getById, recordToValues, resolveTabTitle, resolveTitleFromValues,
    validate, create, update, messages, deepLinkKey, cloneKey, remove, removedMessage,
    removeErrorMessage, notesPort, documentsPort, hasNotes, hasDocuments,
  } = config;

  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { currentTenant } = useTenant();

  const { isNew, recordId, cloneSourceId } = useMemo(() => parse(tabKey), [parse, tabKey]);
  const isClone = cloneSourceId !== null;

  const storeRecord = useMemo(() => {
    const targetId = recordId ?? cloneSourceId;
    return targetId ? findInStore(targetId) : null;
  }, [recordId, cloneSourceId, findInStore]);

  const [fetchedRecord, setFetchedRecord] = useState<TRecord | null>(null);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  useEffect(() => {
    const targetId = recordId ?? cloneSourceId;
    if (!targetId || storeRecord || !getById || !currentTenant) return;
    let cancelled = false;
    getById(targetId)
      .then((r) => { if (!cancelled) { setFetchedRecord(r); setFetchAttempted(true); } })
      .catch(() => { if (!cancelled) setFetchAttempted(true); });
    return () => { cancelled = true; };
  }, [recordId, cloneSourceId, storeRecord, getById, currentTenant]);

  const sourceRecord = storeRecord ?? fetchedRecord;
  const record = isNew ? null : sourceRecord;
  const recordNotFound = !isNew && !sourceRecord && fetchAttempted;

  const [values, setValues] = useState<Values>(() => recordToValues(storeRecord, { clone: isClone }));
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza valores ao carregar registro/campos
    setValues(recordToValues(sourceRecord, { clone: isClone }));
  }, [recordToValues, sourceRecord, isClone]);

  const setFieldValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setValues((prev) => setValueByPath(prev, fieldKey, value));
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  useEffect(() => {
    const title = resolveTabTitle(record, isNew);
    if (title !== null) setTabTitle(tabKey, title);
  }, [record, isNew, resolveTabTitle, tabKey, setTabTitle]);

  const chrome = useEntityDetailChrome({
    recordId: record?.id ?? null,
    deepLinkKey,
    cloneKey,
    remove,
    onRemoved: () => closeTab(tabKey, activePanelId),
    removedMessage,
    removeErrorMessage,
  });

  const notesController = useEntityNotes({ enabled: hasNotes && !!record, recordId: record?.id ?? null, port: notesPort });
  const docsController = useEntityDocuments({ enabled: hasDocuments && !!record, recordId: record?.id ?? null, port: documentsPort });

  const [isSaving, setIsSaving] = useState(false);

  const handleSave = useCallback(async () => {
    const invalid = validate(values);
    if (invalid) { setFieldErrors(invalid.fieldErrors); notify(invalid.message, 'error'); return; }
    setFieldErrors({});
    if (!currentTenant) return;
    setIsSaving(true);
    try {
      if (isNew) {
        const created = await create(values);
        notify(messages.created, 'success');
        const newTabKey = deepLinkKey(created.id);
        closeTab(tabKey, activePanelId);
        openTab(newTabKey);
        setTabTitle(newTabKey, created.title);
      } else if (record) {
        await update(record.id, values);
        notify(messages.updated, 'success');
        setTabTitle(tabKey, resolveTitleFromValues(values));
      }
    } catch (err) {
      console.error('[useEntityDetail save]', err);
      notify(messages.error, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [validate, values, currentTenant, isNew, record, create, update, messages, deepLinkKey, resolveTitleFromValues, tabKey, activePanelId, closeTab, openTab, setTabTitle, notify]);

  return {
    isNew,
    record,
    recordNotFound,
    values,
    setFieldValue,
    fieldErrors,
    isSaving,
    handleSave,
    activeTab: chrome.activeTab,
    setActiveTab: chrome.setActiveTab,
    copyLinkDone: chrome.copyLinkDone,
    handleCopyDeepLink: chrome.handleCopyDeepLink,
    handleClone: chrome.handleClone,
    isTagManagerOpen: chrome.isTagManagerOpen,
    openTagManager: chrome.openTagManager,
    closeTagManager: chrome.closeTagManager,
    requestDelete: chrome.requestDelete,
    cancelDelete: chrome.cancelDelete,
    confirmDelete: chrome.confirmDelete,
    isDeleteOpen: chrome.isDeleteOpen,
    isDeleting: chrome.isDeleting,
    notesController,
    docsController,
  };
}
