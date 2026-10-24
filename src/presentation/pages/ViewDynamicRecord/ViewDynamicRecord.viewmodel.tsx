import { useCallback, useEffect, useMemo } from 'react';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useRecords } from '../../../stores/useRecords';
import { useTenant } from '../../../stores/useTenant';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_DOCUMENT_TYPES_MANAGE } from '../../../domain/schema/access';
import { useAuth } from '../../../stores/useAuth';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetRecordByIdUseCase } from '../../../domain/usecases/records/GetRecordByIdUseCase';
import {
  buildCloneTabKey,
  buildEntityViewTabKey,
  parseDynamicTabKey,
  recordTabKeyOf,
} from '../../../shared/constants/dynamicScreenKeys';
import {
  buildInitialFormValues,
  formValuesToStoredValues,
  readRecordText,
  resolveRecordImageUrl,
  resolveRecordTitle,
  sortFieldsByOrder,
} from '../../../domain/services/customFieldValues';
import { useCustomFieldListing } from '../../hooks/useCustomFieldListing';
import { useRecordIdentityText } from '../../shared/entityScreen/useRecordIdentityText';
import { useRecordFormValidation } from '../../shared/entityScreen/useRecordFormValidation';
import { useEntityDetail } from '../../shared/entityScreen/useEntityDetail';
import type { ScreenActions } from '../../shared/entityScreen/useScreenActions';
import { useRecordDocumentsPort, useRecordNotesPort } from '../../shared/entityScreen/useRecordPorts';
import { useRecordFileUpload } from '../../shared/entityScreen/useRecordFilePort';
import type {
  EntityDocumentsController,
  EntityNotesController,
  FieldFileUpload,
} from '../../shared/entityScreen/types';
import type { TagStoreAdapter } from '../../components/ui/TagManager';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import { useTagAdapter } from '../../shared/entityScreen/useTagAdapter';
import { useEditWindow } from '../../shared/entityScreen/useEditWindow';
import type { EditWindowState } from '../../shared/entityScreen/useEditWindow';
import { hiddenParentFieldKey, isBoundScreen, isOwnedByParentScreen, screenDataCollection } from '../../../domain/services/screenDataCollection';
import { parentLinkValue } from '../../../domain/services/parentLock';
import { autoValueFields, generateAutoValue } from '../../../domain/services/autoValue';
import { screenForDisplay, useEntityFormFields, useResolvedFields } from '../../shared/useEntityFormFields';
import { useLabel, useT } from '../../shared/i18n/useT';
import type {
  CustomFieldValue,
  EntityRecord,
  FieldDefinition,
  ScreenDefinition,
} from '../../../domain/entities';

export type ViewDynamicRecordTab = 'data' | 'notes' | 'documents';

export interface ViewDynamicRecordViewModel {
  definition: ScreenDefinition | null;
  isAvailable: boolean;
  isLoadingDefinition: boolean;
  isNew: boolean;
  /** Algum campo foi alterado e ainda não foi salvo — exposto às expressões como `isDirty`. */
  isDirty: boolean;
  screenActions: ScreenActions;
  /** A COLEÇÃO do registro — o que `<entity>` vira nas expressões dos campos. */
  collection: string;
  canSave: boolean;
  canDeleteRecordParts: boolean;
  canManageDocumentTypes: boolean;
  /** Excluir é de admin — ou do autor, quando a tela declara `authorCanDelete`. */
  canDelete: boolean;
  /** A janela de edição do registro. `null` = a tela não declara prazo, ou o registro é novo. */
  editWindow: EditWindowState | null;
  /** O prazo passou: os campos travam e salvar some, com o motivo à vista. */
  isEditLocked: boolean;
  screenKey: string;
  recordId: string | null;
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  sortedFields: FieldDefinition[];
  formValues: Record<string, CustomFieldValue>;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  mergeValues: (patch: Record<string, unknown>) => void;
  fieldErrors: Record<string, string>;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  handleClone: () => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  recordToDelete: EntityRecord | null;
  requestDelete: () => void;
  cancelDelete: () => void;
  confirmDelete: () => Promise<void>;
  isDeleting: boolean;
  recordNotFound: boolean;
  /** Título do REGISTRO (campo-título). Vazio → o cabeçalho cai no nome da tela. */
  recordTitle: string;
  /** Subtítulo do registro (`subtitleFieldKey`), abaixo do título. Vazio → sem subtítulo. */
  recordSubtitle: string;
  /** Imagem do registro (`imageFieldKey`), no lugar do ícone da tela. Ausente = o ícone. */
  recordImageUrl: string | null;
  /** Envio dos campos `file`. Ausente = campos de arquivo somente-leitura. */
  fileUpload: FieldFileUpload | null;
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  childTabs: EntityDetailExtraTab[];
  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
}

type Values = Record<string, CustomFieldValue>;

export const useViewDynamicRecordViewModel = (tabKey: string): ViewDynamicRecordViewModel => {
  const t = useT('core.records');
  const label = useLabel();
  const { getDefinition, isLoading: isLoadingDefinition } = useScreenDefinitions();
  const { recordsByCollection, createRecord, newRecordId, updateRecord, deleteRecord } = useRecords();
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const { user, effectiveName } = useAuth();
  const { recordRepository } = useDI();

  const screenKey = useMemo(() => parseDynamicTabKey(tabKey)?.screenKey ?? '', [tabKey]);
  const recordId = useMemo(() => {
    const t = parseDynamicTabKey(tabKey);
    return t?.kind === 'view' ? (t.recordId ?? null) : null;
  }, [tabKey]);
  const stored = useMemo(() => getDefinition(screenKey) ?? null, [getDefinition, screenKey]);
  const definition = useMemo(() => screenForDisplay(stored, label), [stored, label]);

  // Ao criar um filho a partir da aba do pai, a chave carrega quem é o pai.
  const parentContext = useMemo(() => {
    const info = parseDynamicTabKey(tabKey);
    return info?.parentEntity && info.parentId
      ? { entity: info.parentEntity, id: info.parentId, fieldKey: info.parentFieldKey ?? null }
      : null;
  }, [tabKey]);
  const isAvailable = !!definition && definition.origin !== 'builtin';
  const canManageDocumentTypes = can(PERMISSION_DOCUMENT_TYPES_MANAGE);

  // Tela que é VISÃO sobre outra coleção lê e grava lá, e herda os campos da entidade alvo.
  const collection = definition ? screenDataCollection(definition) : screenKey;
  const canDeleteRecords = can(`${collection}.delete`);
  const isBound = !!definition && isBoundScreen(definition);
  const boundFields = useEntityFormFields(isBound ? collection : '');

  // Os rótulos passam por `useResolvedFields` NOS DOIS ramos. A tela que declara os próprios campos
  // — toda extensão — chegava aqui crua, e o formulário mostrava a referência em vez do texto.
  const declaredFields = useMemo(
    () => (isBound ? boundFields.fields : definition ? sortFieldsByOrder(definition.fields) : []),
    [isBound, boundFields.fields, definition],
  );
  const sortedFields = useResolvedFields(declaredFields);
  const titleFieldKey = definition?.titleFieldKey ?? '';

  const listing = useCustomFieldListing(sortedFields);
  const identity = useRecordIdentityText(definition, sortedFields, listing.displayValue);

  const getByIdUC = useMemo(() => makeGetRecordByIdUseCase(recordRepository), [recordRepository]);

  const parse = useCallback((tk: string) => {
    const t = parseDynamicTabKey(tk);
    return {
      isNew: t?.kind === 'new',
      recordId: t?.kind === 'view' ? (t.recordId ?? null) : null,
      cloneSourceId: t?.cloneSourceId ?? null,
    };
  }, []);

  const findInStore = useCallback(
    (id: string) => (recordsByCollection[collection] ?? []).find((r) => r.id === id) ?? null,
    [recordsByCollection, collection],
  );

  const getById = useCallback(
    (id: string) => (currentTenant ? getByIdUC.execute(currentTenant.id, collection, id) : Promise.resolve(null)),
    [getByIdUC, currentTenant, collection],
  );

  const recordToValues = useCallback(
    (record: EntityRecord | null) => {
      const values = buildInitialFormValues(sortedFields, record);
      // Registro filho novo já nasce vinculado ao pai que abriu a aba — pelo campo que a chave
      // carrega, ou pelo `parentFieldKey` da tela. Num `multi`, como lista: uma string ali era
      // descartada ao gravar, e o registro nascia solto.
      const linkFieldKey = parentContext?.fieldKey ?? definition?.parentFieldKey;
      if (parentContext && linkFieldKey) {
        const linkField = sortedFields.find((field) => field.key === linkFieldKey);
        values[linkFieldKey] = parentLinkValue(linkField, parentContext.id);
      }
      return values;
    },
    [sortedFields, parentContext, definition],
  );

  // Rótulo da aba: o campo-TÍTULO do registro — é por ele que o usuário reconhece o que está aberto,
  // e é o mesmo nome que aparece na listagem, na busca e numa menção. O subtítulo só entra quando o
  // título está vazio, para a aba não ficar "Sem título".
  const resolveTabTitle = useCallback(
    (record: EntityRecord | null, isNew: boolean) => {
      if (!definition) return null;
      if (isNew) return t('record.new.title', { entity: label(definition.titleSingular) });
      if (!record) return null;
      return label(identity.titleOf(record) || identity.subtitleOf(record)
        || resolveRecordTitle(record, titleFieldKey));
    },
    [definition, identity, titleFieldKey, t, label],
  );

  const resolveTitleFromValues = useCallback(
    (values: Values) => resolveRecordTitle(formValuesToStoredValues(sortedFields, values), titleFieldKey),
    [sortedFields, titleFieldKey],
  );

  const validate = useRecordFormValidation(collection, sortedFields);

  const create = useCallback(
    async (values: Values, recordId: string | null) => {
      const stored = formValuesToStoredValues(sortedFields, values);
      const created = await createRecord(collection, stored, recordId ?? undefined);
      return { id: created.id, title: resolveRecordTitle(created, titleFieldKey) };
    },
    [sortedFields, titleFieldKey, createRecord, collection],
  );

  const newId = useCallback(() => newRecordId(collection), [newRecordId, collection]);

  const update = useCallback(
    async (id: string, values: Values) => {
      await updateRecord(collection, id, {
        ...formValuesToStoredValues(sortedFields, values),
        updatedBy: user?.id ?? '',
        updatedByName: effectiveName,
        updatedByPhotoURL: user?.photoURL ?? '',
      });
    },
    [sortedFields, updateRecord, collection, user, effectiveName],
  );

  const deepLinkKey = useCallback(
    (id: string) => recordTabKeyOf(definition, screenKey, id),
    [definition, screenKey],
  );
  const cloneKey = useCallback((id: string) => buildCloneTabKey(screenKey, id), [screenKey]);
  const remove = useCallback((id: string) => deleteRecord(collection, id), [deleteRecord, collection]);

  // Registro filho volta para o pai ao salvar. Na criação o pai vem da chave da aba; na edição,
  // do valor já gravado no campo de vínculo. Vale só para o registro que PERTENCE ao pai — o
  // relacionado é uma tela de topo, e sair dela ao salvar seria perder o lugar.
  const returnTabKey = useMemo(() => {
    if (!definition || !isOwnedByParentScreen(definition)) return undefined;
    if (parentContext) return buildEntityViewTabKey(parentContext.entity, parentContext.id);
    if (!definition.parentEntity || !definition.parentFieldKey || !recordId) return undefined;
    const existing = (recordsByCollection[collection] ?? []).find((r) => r.id === recordId);
    const parentId = existing?.[definition.parentFieldKey];
    return typeof parentId === 'string' && parentId
      ? buildEntityViewTabKey(definition.parentEntity, parentId)
      : undefined;
  }, [parentContext, definition, recordId, recordsByCollection, collection]);

  // O campo de vínculo não vai ao formulário aberto de dentro do pai (já vem preenchido), mas segue
  // em `sortedFields` para ser gravado normalmente. Aberto pela tela própria do filho, o pai não é
  // conhecido, e o campo aparece como declarado — ver `hiddenParentFieldKey`.
  const hiddenFieldKey = definition ? hiddenParentFieldKey(definition, parentContext) : null;
  const formFields = useMemo(
    () => (hiddenFieldKey ? sortedFields.filter((f) => f.key !== hiddenFieldKey) : sortedFields),
    [sortedFields, hiddenFieldKey],
  );

  const notesPort = useRecordNotesPort(collection);
  const documentsPort = useRecordDocumentsPort(collection);

  const messages = useMemo(() => {
    const entity = definition ? label(definition.titleSingular) : t('record.title');
    return {
      created: t('record.created', { entity }),
      updated: t('record.updated', { entity }),
      error: t('record.save-failed'),
    };
  }, [definition, t, label]);

  const detail = useEntityDetail<EntityRecord>({
    tabKey,
    entityKey: collection,
    configScreenKey: screenKey,
    parse,
    findInStore,
    getById,
    recordToValues,
    resolveTabTitle,
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages,
    deepLinkKey,
    cloneKey,
    remove,
    removedMessage: t('record.deleted'),
    removeErrorMessage: t('record.delete-failed'),
    notesPort,
    documentsPort,
    hasNotes: !!definition?.hasNotes,
    hasDocuments: !!definition?.hasDocuments,
    returnTabKey,
    newId,
  });

  const fileUpload = useRecordFileUpload(collection, detail.ensureRecordId);

  const sourceRecord = detail.record;
  const { setFieldValue } = detail;

  /**
   * Os códigos gerados (`autoValue`) de um registro NOVO. Fica em efeito porque sortear é impuro, e
   * só semeia o campo vazio: o valor sugerido continua editável, e um clone que já trouxe código
   * preenchido não é sobrescrito. A unicidade é conferida contra os registros já carregados da
   * coleção — a mesma garantia que a tela fixa dava.
   */
  const pendingAutoValues = useMemo(
    () => (detail.isNew
      ? autoValueFields(sortedFields).filter((field) => !readRecordText(detail.values, field.key))
      : []),
    [detail.isNew, detail.values, sortedFields],
  );
  const collectionRecords = recordsByCollection[collection];

  useEffect(() => {
    for (const field of pendingAutoValues) {
      const taken = new Set((collectionRecords ?? []).map((record) => readRecordText(record, field.key)));
      setFieldValue(field.key, generateAutoValue(field.pattern, taken));
    }
  }, [pendingAutoValues, collectionRecords, setFieldValue]);

  // Cabeçalho: título e subtítulo do REGISTRO, como nas telas fixas.
  const recordTitle = sourceRecord ? identity.titleOf(sourceRecord) : '';
  const recordSubtitle = sourceRecord ? identity.subtitleOf(sourceRecord) : '';
  const recordImageUrl = resolveRecordImageUrl(sourceRecord, sortedFields, definition?.imageFieldKey);

  const tagIdsOf = useCallback(() => sourceRecord?.tagIds ?? [], [sourceRecord]);
  const setRecordTags = useCallback(
    (entityId: string, tagIds: string[]) => updateRecord(collection, entityId, { tagIds }),
    [updateRecord, collection],
  );
  const tagAdapter = useTagAdapter(collection, tagIdsOf, setRecordTags, definition?.tagCollection);

  // Excluir exige a permissão de exclusão DESTA coleção, salvo onde a tela declara que a autoria é a
  // posse. Espelha o `firestore.rules`.
  // Gravar um registro NOVO é criar; gravar um que já existe é alterar. São permissões diferentes, e
  // a mesma tela serve às duas — é por isso que a conta é feita aqui, e não uma vez só.
  //
  // A janela de edição soma às permissões, nunca as substitui: depois do prazo, nem quem tem
  // `update` grava — e a regra do Firestore recusaria do mesmo jeito.
  const editWindow = useEditWindow(definition?.editWindow, sourceRecord?.createdAt, detail.isNew);
  const isEditLocked = editWindow !== null && !editWindow.isOpen;
  const canSave = can(`${collection}.${detail.isNew ? 'create' : 'update'}`) && !isEditLocked;

  const canDelete = (canDeleteRecords
    || (!!definition?.authorCanDelete && !!sourceRecord && sourceRecord.createdBy === user?.id))
    && (editWindow?.canDelete ?? true);

  return {
    definition,
    isAvailable,
    isLoadingDefinition,
    isNew: detail.isNew,
    isDirty: detail.isDirty,
    screenActions: detail.screenActions,
    collection,
    canSave,
    canDeleteRecordParts: canDeleteRecords,
    canManageDocumentTypes,
    canDelete,
    editWindow,
    isEditLocked,
    screenKey,
    recordId,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
    sortedFields: formFields,
    formValues: detail.values,
    setFieldValue: detail.setFieldValue,
    mergeValues: detail.mergeValues,
    fieldErrors: detail.fieldErrors,
    isSaving: detail.isSaving,
    handleSave: detail.handleSave,
    handleClone: detail.handleClone,
    copyLinkDone: detail.copyLinkDone,
    handleCopyDeepLink: detail.handleCopyDeepLink,
    recordToDelete: detail.isDeleteOpen ? detail.record : null,
    requestDelete: detail.requestDelete,
    cancelDelete: detail.cancelDelete,
    confirmDelete: detail.confirmDelete,
    isDeleting: detail.isDeleting,
    recordNotFound: detail.recordNotFound,
    recordTitle,
    recordSubtitle,
    recordImageUrl,
    fileUpload,
    notesController: detail.notesController,
    docsController: detail.docsController,
    childTabs: detail.childTabs,
    tagAdapter,
    isTagManagerOpen: detail.isTagManagerOpen,
    openTagManager: detail.openTagManager,
    closeTagManager: detail.closeTagManager,
  };
};
