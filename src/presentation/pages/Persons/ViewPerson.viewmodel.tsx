import { useCallback } from 'react';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import type { Person, PersonType, PersonAddress, Gender, CustomFieldValue, FieldDefinition } from '../../../domain/entities';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import type { ScreenActions } from '../../shared/entityScreen/useScreenActions';
import { useNotesPort } from '../../shared/entityScreen/useNotesPort';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type { EntityDocumentsController, EntityNotesController } from '../../shared/entityScreen/types';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import { useEntityFormFields } from '../../shared/useEntityFormFields';
import { buildInitialFormValues, collectRequiredErrors, formValuesToStoredValues, validateRequiredFields } from '../../../domain/services/customFieldValues';
import { onlyNumbers } from '../../../utils/formatters';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { format, parseISO } from 'date-fns';
import { useTagAdapter } from '../../shared/entityScreen/useTagAdapter';

export type ViewPersonTab = 'data' | 'notes' | 'documents';

type Values = Record<string, CustomFieldValue>;

const CLONE_PREFIX = 'new-person:clone:';

const parsePersonTab = (tabKey: string) => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-person' || cloneSourceId !== null;
  return { isNew, recordId: isNew ? null : tabKey.replace('view-person:', ''), cloneSourceId };
};

const NEW_PERSON_DEFAULT_TYPE = 'Pessoa Física';

const personToValues = (person: Person | null, addedFields: FieldDefinition[], clone: boolean): Values => {
  const base = {
    type: person ? person.type ?? '' : NEW_PERSON_DEFAULT_TYPE,
    name: person?.name ?? '',
    cpf: clone ? '' : (person?.cpf ?? ''),
    cnpj: clone ? '' : (person?.cnpj ?? ''),
    email: person?.email ?? '',
    phone: person?.phone ?? '',
    secondaryPhone: person?.secondaryPhone ?? '',
    occupation: person?.occupation ?? '',
    nationality: person?.nationality ?? '',
    maritalStatus: person?.maritalStatus ?? '',
    relationship: person?.relationship ?? '',
    birthDate: person?.birthDate ? format(person.birthDate, 'yyyy-MM-dd') : '',
    gender: person?.gender ?? '',
    notes: person?.notes ?? '',
    address: {
      street: person?.address?.street ?? '',
      number: person?.address?.number ?? '',
      complement: person?.address?.complement ?? '',
      neighborhood: person?.address?.neighborhood ?? '',
      city: person?.address?.city ?? '',
      state: person?.address?.state ?? '',
      zipCode: person?.address?.zipCode ?? '',
    },
    ...buildInitialFormValues(addedFields, person ?? null),
  };
  return base as unknown as Values;
};

const str = (values: Values, key: string): string => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
};

const valuesToPersonPayload = (values: Values, addedFields: FieldDefinition[]) => {
  const addr = ((values as Record<string, unknown>).address ?? {}) as Record<string, string>;
  const address: PersonAddress = {};
  if (addr.street) address.street = addr.street;
  if (addr.number) address.number = addr.number;
  if (addr.complement) address.complement = addr.complement;
  if (addr.neighborhood) address.neighborhood = addr.neighborhood;
  if (addr.city) address.city = addr.city;
  if (addr.state) address.state = addr.state;
  if (addr.zipCode) {
    const zip = onlyNumbers(addr.zipCode);
    if (zip.length > 0) address.zipCode = zip;
  }
  const hasAddress = Object.keys(address).length > 0;

  const cpfNumbers = str(values, 'cpf') ? onlyNumbers(str(values, 'cpf')) : null;
  const cnpjNumbers = str(values, 'cnpj') ? onlyNumbers(str(values, 'cnpj')) : null;
  const phoneNumbers = str(values, 'phone') ? onlyNumbers(str(values, 'phone')) : null;
  const secondaryPhoneNumbers = str(values, 'secondaryPhone') ? onlyNumbers(str(values, 'secondaryPhone')) : null;

  return {
    type: (str(values, 'type') || 'Pessoa Física') as PersonType,
    name: str(values, 'name').trim(),
    cpf: cpfNumbers && cpfNumbers.length === 11 ? cpfNumbers : null,
    cnpj: cnpjNumbers && cnpjNumbers.length === 14 ? cnpjNumbers : null,
    email: str(values, 'email') || null,
    phone: phoneNumbers || null,
    secondaryPhone: secondaryPhoneNumbers || null,
    occupation: str(values, 'occupation') || null,
    nationality: str(values, 'nationality') || null,
    maritalStatus: str(values, 'maritalStatus') || null,
    relationship: str(values, 'relationship') || null,
    birthDate: str(values, 'birthDate') ? parseISO(str(values, 'birthDate')) : null,
    gender: (str(values, 'gender') as Gender) || null,
    notes: str(values, 'notes') || null,
    address: hasAddress ? address : null,
    ...formValuesToStoredValues(addedFields, values),
  };
};

export interface ViewPersonViewModel {
  isNew: boolean;
  screenActions: ScreenActions;
  person: Person | null;
  isAdmin: boolean;
  fields: FieldDefinition[];
  addedFields: FieldDefinition[];
  values: Values;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  mergeValues: (patch: Record<string, unknown>) => void;
  fieldErrors: Record<string, string>;
  personName: string;
  personType: PersonType;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  childTabs: EntityDetailExtraTab[];
  activeTab: EntityDetailTab;
  setActiveTab: (tab: EntityDetailTab) => void;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  handleToggleStatus: () => Promise<void>;
  handleDeletePerson: () => void;
  personToDelete: Person | null;
  confirmDeletePerson: () => Promise<void>;
  cancelDeletePerson: () => void;
}

export const useViewPersonViewModel = (tabKey: string): ViewPersonViewModel => {
  const { persons, createPerson, updatePerson, updatePersonStatus, deletePerson } = usePersonStore();
  const { tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { notify } = useNotification();
  const { personNoteRepository, personDocumentRepository } = useDI();

  const isAdmin = tenantRole === 'admin';
  const { fields: formFields, addedFields } = useEntityFormFields('persons');

  const findInStore = useCallback((id: string) => persons.find((p) => p.id === id) ?? null, [persons]);

  const recordToValues = useCallback(
    (person: Person | null, opts: { clone: boolean }) => personToValues(person, addedFields, opts.clone),
    [addedFields],
  );

  const resolveTitleFromValues = useCallback((values: Values) => str(values, 'name').trim(), []);

  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors: Record<string, string> = {};
    if (!str(values, 'name').trim()) fieldErrors.name = 'Nome é obrigatório.';
    Object.assign(fieldErrors, collectRequiredErrors(addedFields, values));
    const issues = validateRecordRules('persons', valuesToPersonPayload(values, addedFields));
    issues.forEach((issue) => {
      const key = issue.path;
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message = fieldErrors.name ?? validateRequiredFields(addedFields, values) ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [addedFields]);

  const create = useCallback(async (values: Values) => {
    const created = await createPerson({
      ...valuesToPersonPayload(values, addedFields),
      status: 'Ativo',
      createdBy: user?.id ?? '',
      tagIds: [],
    });
    return { id: created.id, title: created.name };
  }, [createPerson, addedFields, user]);

  const update = useCallback(async (id: string, values: Values) => {
    await updatePerson(id, {
      ...valuesToPersonPayload(values, addedFields),
      updatedBy: user?.id ?? '',
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updatePerson, addedFields, user, effectiveName]);

  const notesPort = useNotesPort(personNoteRepository);
  const documentsPort = useDocumentsPort(personDocumentRepository);

  const detail = useEntityDetail<Person>({
    tabKey,
    entityKey: 'persons',
    parse: parsePersonTab,
    findInStore,
    recordToValues,
    resolveTabTitle: (person) => person?.name ?? null,
    resolveTitleFromValues,
    validate,
    create,
    update,
    messages: {
      created: 'Pessoa cadastrada com sucesso!',
      updated: 'Pessoa atualizada com sucesso!',
      error: 'Erro ao salvar pessoa.',
    },
    deepLinkKey: (id) => `view-person:${id}`,
    cloneKey: (id) => `${CLONE_PREFIX}${id}`,
    remove: (id) => deletePerson(id),
    removedMessage: 'Pessoa excluída.',
    removeErrorMessage: 'Erro ao excluir pessoa.',
    notesPort,
    documentsPort,
    hasNotes: true,
    hasDocuments: true,
  });

  const person = detail.record;

  const tagIdsOf = useCallback(() => person?.tagIds ?? [], [person]);
  const setRecordTags = useCallback((entityId: string, tagIds: string[]) => updatePerson(entityId, { tagIds }), [updatePerson]);
  const tagAdapter = useTagAdapter('persons', tagIdsOf, setRecordTags);

  const handleToggleStatus = useCallback(async () => {
    if (!person) return;
    const next = person.status === 'Ativo' ? 'Inativo' : 'Ativo';
    await updatePersonStatus(person.id, next);
    notify(`Pessoa ${next === 'Ativo' ? 'ativada' : 'inativada'}.`, 'success');
  }, [person, updatePersonStatus, notify]);

  return {
    isNew: detail.isNew,
    screenActions: detail.screenActions,
    person,
    isAdmin,
    fields: formFields,
    addedFields,
    values: detail.values,
    setFieldValue: detail.setFieldValue,
    mergeValues: detail.mergeValues,
    fieldErrors: detail.fieldErrors,
    personName: str(detail.values, 'name'),
    personType: (str(detail.values, 'type') || 'Pessoa Física') as PersonType,
    isSaving: detail.isSaving,
    handleSave: detail.handleSave,
    tagAdapter,
    isTagManagerOpen: detail.isTagManagerOpen,
    openTagManager: detail.openTagManager,
    closeTagManager: detail.closeTagManager,
    notesController: detail.notesController,
    docsController: detail.docsController,
    childTabs: detail.childTabs,
    activeTab: detail.activeTab,
    setActiveTab: detail.setActiveTab,
    copyLinkDone: detail.copyLinkDone,
    handleCopyDeepLink: detail.handleCopyDeepLink,
    handleClone: detail.handleClone,
    handleToggleStatus,
    handleDeletePerson: detail.requestDelete,
    personToDelete: detail.isDeleteOpen ? person : null,
    confirmDeletePerson: detail.confirmDelete,
    cancelDeletePerson: detail.cancelDelete,
  };
};
