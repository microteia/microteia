import { useCallback, useEffect, useMemo, useState } from 'react';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useTenant } from '../../../stores/useTenant';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import { useRecordActions } from '../recordActions/useRecordActions';
import { applyResult, useScreenActions } from './useScreenActions';
import type { ScreenActions } from './useScreenActions';
import { setValueByPath } from '../../../domain/services/customFieldValues';
import type { CustomFieldValue, EntityRecord } from '../../../domain/entities';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import { useChildScreenTabs } from './useChildScreenTabs';
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
  /** Chave da entidade ('cases', 'contracts', … ou o id da tela dinâmica) — usada para achar as telas filhas. */
  entityKey: string;
  /**
   * Tela que CONFIGURA este detalhe (ações do cabeçalho). Só difere de `entityKey` numa tela que é
   * visão sobre a coleção de outra entidade: a configuração é da tela, os registros são da coleção.
   */
  configScreenKey?: string;
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
  /** Ausente quando a tela não oferece exclusão no detalhe (ex.: Prazos). */
  remove?: (id: string) => Promise<void>;
  removedMessage?: string;
  removeErrorMessage?: string;
  /** 'reopen' (padrão) reabre a aba em modo edição; 'close' apenas fecha (ex.: Prazos). */
  afterCreate?: 'reopen' | 'close';
  /**
   * Quando presente, salvar (criar ou editar) fecha esta aba e volta para a informada — usado pelos
   * registros filhos, que voltam ao registro pai. `openTab` foca a aba se ela já estiver aberta.
   */
  returnTabKey?: string;
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
  /** Mescla vários campos de uma vez — usado pelos efeitos de `onChange`. */
  mergeValues: (patch: Record<string, unknown>) => void;
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
  /** Abas de registros filhos — a view repassa em `extraTabs`. */
  childTabs: EntityDetailExtraTab[];
  /** Ações customizadas configuradas para o cabeçalho desta tela. */
  screenActions: ScreenActions;
}

export function useEntityDetail<TRecord extends { id: string }>(
  config: EntityDetailConfig<TRecord>,
): EntityDetail<TRecord> {
  const {
    tabKey, entityKey, configScreenKey, parse, findInStore, getById, recordToValues, resolveTabTitle, resolveTitleFromValues,
    validate, create, update, messages, deepLinkKey, cloneKey, remove, removedMessage,
    removeErrorMessage, notesPort, documentsPort, hasNotes, hasDocuments,
    afterCreate = 'reopen', returnTabKey,
  } = config;

  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { currentTenant } = useTenant();
  const { getDefinition } = useScreenDefinitions();
  const { updateRecord } = useRecords();
  const recordActions = useRecordActions();

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
  const [isDirty, setIsDirty] = useState(false);

  useEffect(() => {
    if (isDirty) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza valores ao carregar registro/campos
    setValues(recordToValues(sourceRecord, { clone: isClone }));
    setIsDirty(false);
  }, [recordToValues, sourceRecord, isClone, isDirty]);

  const setFieldValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setValues((prev) => setValueByPath(prev, fieldKey, value));
    setIsDirty(true);
    setFieldErrors((prev) => {
      if (!prev[fieldKey]) return prev;
      const next = { ...prev };
      delete next[fieldKey];
      return next;
    });
  }, []);

  const applyValues = useCallback((next: Values) => {
    setValues(next);
    setIsDirty(true);
  }, []);

  /**
   * Meio-termo entre `setFieldValue` (um campo) e `applyValues` (substitui tudo): mescla um objeto
   * sobre os valores atuais, achatando caminhos aninhados. Usado pelos efeitos de `onChange`, que
   * preenchem vários campos de uma vez.
   */
  const mergeValues = useCallback((patch: Record<string, unknown>) => {
    if (Object.keys(patch).length === 0) return;
    setValues((prev) => applyResult(prev, patch));
    setIsDirty(true);
  }, []);

  useEffect(() => {
    const title = resolveTabTitle(record, isNew);
    if (title !== null) setTabTitle(tabKey, title);
  }, [record, isNew, resolveTabTitle, tabKey, setTabTitle]);

  const chrome = useEntityDetailChrome({
    recordId: record?.id ?? null,
    deepLinkKey,
    cloneKey,
    remove: remove ?? (() => Promise.resolve()),
    onRemoved: () => closeTab(tabKey, activePanelId),
    removedMessage: removedMessage ?? '',
    removeErrorMessage: removeErrorMessage ?? '',
  });

  const notesController = useEntityNotes({ enabled: hasNotes && !!record, recordId: record?.id ?? null, port: notesPort });
  const docsController = useEntityDocuments({ enabled: hasDocuments && !!record, recordId: record?.id ?? null, port: documentsPort });

  const childTabs = useChildScreenTabs(entityKey, record?.id ?? null);

  const [isSaving, setIsSaving] = useState(false);

  /**
   * `override` existe para o despacho de Actions: um `merge` seguido de `save` precisa gravar os
   * valores recém-mesclados, que ainda não passaram por um render quando o `save` é chamado.
   */
  const handleSave = useCallback(async (override?: Values) => {
    const saved = override ?? values;
    const invalid = validate(saved);
    if (invalid) { setFieldErrors(invalid.fieldErrors); notify(invalid.message, 'error'); return; }
    setFieldErrors({});
    if (!currentTenant) return;
    setIsSaving(true);
    try {
      if (isNew) {
        const created = await create(saved);
        notify(messages.created, 'success');
        if (returnTabKey) {
          closeTab(tabKey, activePanelId);
          openTab(returnTabKey);
        } else if (afterCreate === 'close') {
          closeTab(tabKey, activePanelId);
        } else {
          const newTabKey = deepLinkKey(created.id);
          closeTab(tabKey, activePanelId);
          openTab(newTabKey);
          setTabTitle(newTabKey, created.title);
        }
      } else if (record) {
        await update(record.id, saved);
        notify(messages.updated, 'success');
        if (returnTabKey) {
          closeTab(tabKey, activePanelId);
          openTab(returnTabKey);
        } else {
          setTabTitle(tabKey, resolveTitleFromValues(saved));
        }
      }
    } catch (err) {
      console.error('[useEntityDetail save]', err);
      notify(messages.error, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [validate, values, currentTenant, isNew, record, create, update, messages, deepLinkKey, resolveTitleFromValues, tabKey, activePanelId, closeTab, openTab, setTabTitle, notify, afterCreate, returnTabKey]);

  const refetch = useCallback(async () => {
    const targetId = record?.id ?? null;
    const fresh = targetId && getById ? await getById(targetId) : null;
    if (fresh) setFetchedRecord(fresh);
    setValues(recordToValues(fresh ?? sourceRecord, { clone: isClone }));
    setIsDirty(false);
  }, [record, getById, recordToValues, sourceRecord, isClone]);

  const viewActionIds = useMemo(
    () => getDefinition(configScreenKey ?? entityKey)?.viewActionIds ?? [],
    [getDefinition, configScreenKey, entityKey],
  );

  /**
   * O host das ações de registro no CABEÇALHO. Um ponto só para todas as telas de detalhe: os
   * endereços de aba vêm do que a própria tela declarou (`deepLinkKey`/`cloneKey`), e não de uma
   * convenção que o comando teria de adivinhar.
   */
  const runRecordCommand = useCallback(async (commandKey: string) => {
    if (!record) return;
    const command = recordActions.find((candidate) => candidate.metadata.key === commandKey);
    if (!command) return;
    await command.run({
      record: record as unknown as EntityRecord,
      collection: entityKey,
      screenKey: configScreenKey ?? entityKey,
      surface: 'detail',
      parent: null,
      recordTabKey: deepLinkKey(record.id),
      cloneTabKey: cloneKey(record.id),
      openTab,
      notify,
      patchRecord: (patch) => updateRecord(entityKey, record.id, patch),
      copyText: (text) => navigator.clipboard.writeText(text),
      openTagManager: chrome.openTagManager,
      requestDelete: chrome.requestDelete,
    });
  }, [record, recordActions, entityKey, configScreenKey, deepLinkKey, cloneKey, openTab, notify, updateRecord, chrome.openTagManager, chrome.requestDelete]);

  const screenActions = useScreenActions({
    runRecordCommand,
    screenKey: entityKey,
    actionIds: viewActionIds,
    values,
    record: (record as Record<string, unknown> | null) ?? null,
    recordId: record?.id ?? null,
    isNew,
    isDirty,
    applyValues,
    setFieldErrors,
    save: handleSave,
    clone: chrome.handleClone,
    remove: chrome.requestDelete,
    refresh: refetch,
    close: () => closeTab(tabKey, activePanelId),
  });

  return {
    isNew,
    record,
    recordNotFound,
    values,
    setFieldValue,
    mergeValues,
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
    childTabs,
    screenActions,
  };
}
