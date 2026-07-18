import { useCallback, useMemo } from 'react';
import { useTheme } from 'styled-components';
import { usePersonStore } from '../../../stores/usePersonStore';
import { usePersonTagStore } from '../../../stores/usePersonTagStore';
import { usePersonLookup } from '../../../stores/usePersonLookup';
import { useTenant } from '../../../stores/useTenant';
import { useAuth } from '../../../stores/useAuth';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { resolveColor } from '../../../shared/styles/colorUtils';
import type { Person, PersonType, PersonAddress, Gender, CustomFieldValue, FieldDefinition, PersonLookupKind } from '../../../domain/entities';
import type { LookupOptionSet } from '../../components/ui/CustomFieldsSection/CustomFieldsSection.viewmodel';
import { useEntityDetail, type EntityValidationResult } from '../../shared/entityScreen/useEntityDetail';
import { useNotesPort } from '../../shared/entityScreen/useNotesPort';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type { EntityDocumentsController, EntityNotesController } from '../../shared/entityScreen/types';
import type { EntityDetailExtraTab, EntityDetailTab } from '../../components/layout/EntityDetailView';
import { PERSON_FORM_FIELDS } from './personSchema';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { buildInitialFormValues, collectRequiredErrors, formValuesToStoredValues, validateRequiredFields } from '../../../domain/services/customFieldValues';
import { onlyNumbers } from '../../../utils/formatters';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules, ruleIssueFieldKey } from '../../../data/utils/recordRulesGate';
import { format, parseISO } from 'date-fns';

export type ViewPersonTab = 'data' | 'notes' | 'documents';

type Values = Record<string, CustomFieldValue>;

const CLONE_PREFIX = 'new-person:clone:';

const LOOKUP_COLLECTION_TO_KIND: Record<string, PersonLookupKind> = {
  personTypes: 'types',
  personOccupations: 'occupations',
  personNationalities: 'nationalities',
  personMaritalStatuses: 'maritalStatuses',
  personCities: 'cities',
  personRelationships: 'relationships',
  personGenders: 'genders',
};

const parsePersonTab = (tabKey: string) => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-person' || cloneSourceId !== null;
  return { isNew, recordId: isNew ? null : tabKey.replace('view-person:', ''), cloneSourceId };
};

const NEW_PERSON_DEFAULT_TYPE = 'Pessoa Física';

const personToValues = (person: Person | null, customFields: FieldDefinition[], clone: boolean): Values => {
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
    ...buildInitialFormValues(customFields, person?.customValues ?? null),
  };
  return base as unknown as Values;
};

const str = (values: Values, key: string): string => {
  const v = (values as Record<string, unknown>)[key];
  return typeof v === 'string' ? v : '';
};

const valuesToPersonPayload = (values: Values, customFields: FieldDefinition[]) => {
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
    customValues: formValuesToStoredValues(customFields, values),
  };
};

export interface ViewPersonViewModel {
  isNew: boolean;
  person: Person | null;
  isAdmin: boolean;
  nativeFields: FieldDefinition[];
  customFields: FieldDefinition[];
  values: Values;
  setFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  fieldErrors: Record<string, string>;
  personName: string;
  personType: PersonType;
  personLookupOptions: Record<string, LookupOptionSet>;
  handleAddPersonLookup: (collection: string, label: string) => Promise<void>;
  handleDeletePersonLookup: (collection: string, optionKey: string) => Promise<void>;
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
  const { tags, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag } = usePersonTagStore();
  const { typeConfigs, occupationConfigs, nationalityConfigs, maritalStatusConfigs, cityConfigs, relationshipConfigs, genderConfigs, addItem, removeItem } = usePersonLookup();
  const { tenantRole } = useTenant();
  const { user, effectiveName } = useAuth();
  const { notify } = useNotification();
  const theme = useTheme();
  const { personNoteRepository, personDocumentRepository } = useDI();
  const { getCustomFieldsFor } = useScreenDefinitions();

  const isAdmin = tenantRole === 'admin';
  const customFields = useMemo(() => getCustomFieldsFor('persons'), [getCustomFieldsFor]);

  const findInStore = useCallback((id: string) => persons.find((p) => p.id === id) ?? null, [persons]);

  const recordToValues = useCallback(
    (person: Person | null, opts: { clone: boolean }) => personToValues(person, customFields, opts.clone),
    [customFields],
  );

  const resolveTitleFromValues = useCallback((values: Values) => str(values, 'name').trim(), []);

  const validate = useCallback((values: Values): EntityValidationResult | null => {
    const fieldErrors: Record<string, string> = {};
    if (!str(values, 'name').trim()) fieldErrors.name = 'Nome é obrigatório.';
    Object.assign(fieldErrors, collectRequiredErrors(customFields, values));
    const issues = validateRecordRules('persons', valuesToPersonPayload(values, customFields));
    issues.forEach((issue) => {
      const key = ruleIssueFieldKey(issue.path);
      if (!fieldErrors[key]) fieldErrors[key] = issue.error;
    });
    if (Object.keys(fieldErrors).length === 0) return null;
    const message = fieldErrors.name ?? validateRequiredFields(customFields, values) ?? describeRuleIssues(issues);
    return { message, fieldErrors };
  }, [customFields]);

  const create = useCallback(async (values: Values) => {
    const created = await createPerson({
      ...valuesToPersonPayload(values, customFields),
      status: 'Ativo',
      createdBy: user?.id ?? '',
      tagIds: [],
    });
    return { id: created.id, title: created.name };
  }, [createPerson, customFields, user]);

  const update = useCallback(async (id: string, values: Values) => {
    await updatePerson(id, {
      ...valuesToPersonPayload(values, customFields),
      updatedBy: user?.id ?? '',
      updatedByName: effectiveName,
      updatedByPhotoURL: user?.photoURL ?? '',
    });
  }, [updatePerson, customFields, user, effectiveName]);

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

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForPerson(entityId, person?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForPerson(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, person, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag]);

  const handleToggleStatus = useCallback(async () => {
    if (!person) return;
    const next = person.status === 'Ativo' ? 'Inativo' : 'Ativo';
    await updatePersonStatus(person.id, next);
    notify(`Pessoa ${next === 'Ativo' ? 'ativada' : 'inativada'}.`, 'success');
  }, [person, updatePersonStatus, notify]);

  const personLookupOptions = useMemo<Record<string, LookupOptionSet>>(() => {
    const staticOf = (configs: typeof typeConfigs) =>
      configs.filter((c) => c.isStatic !== false).map((c) => ({ value: c.key, label: c.label }));
    const dynamicOf = (configs: typeof typeConfigs) =>
      configs.filter((c) => c.isStatic === false).map((c) => ({ value: c.key, label: c.label }));
    const relOf = (isStatic: boolean) =>
      relationshipConfigs
        .filter((c) => (isStatic ? c.isStatic !== false : c.isStatic === false))
        .map((c) => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) }));
    return {
      personTypes:            { staticOptions: staticOf(typeConfigs),          dynamicOptions: dynamicOf(typeConfigs) },
      personOccupations:      { staticOptions: [],                             dynamicOptions: occupationConfigs.map((c) => ({ value: c.key, label: c.label })) },
      personNationalities:    { staticOptions: staticOf(nationalityConfigs),   dynamicOptions: dynamicOf(nationalityConfigs) },
      personMaritalStatuses:  { staticOptions: staticOf(maritalStatusConfigs), dynamicOptions: dynamicOf(maritalStatusConfigs) },
      personCities:           { staticOptions: [],                             dynamicOptions: cityConfigs.map((c) => ({ value: c.key, label: c.label })) },
      personRelationships:    { staticOptions: relOf(true),                    dynamicOptions: relOf(false) },
      personGenders:          { staticOptions: staticOf(genderConfigs),        dynamicOptions: dynamicOf(genderConfigs) },
    };
  }, [typeConfigs, occupationConfigs, nationalityConfigs, maritalStatusConfigs, cityConfigs, relationshipConfigs, genderConfigs, theme]);

  const handleAddPersonLookup = useCallback(async (collection: string, label: string): Promise<void> => {
    const kind = LOOKUP_COLLECTION_TO_KIND[collection];
    if (kind) await addItem(kind, label);
  }, [addItem]);

  const handleDeletePersonLookup = useCallback(async (collection: string, optionKey: string): Promise<void> => {
    const kind = LOOKUP_COLLECTION_TO_KIND[collection];
    if (kind) await removeItem(kind, optionKey);
  }, [removeItem]);

  return {
    isNew: detail.isNew,
    person,
    isAdmin,
    nativeFields: PERSON_FORM_FIELDS,
    customFields,
    values: detail.values,
    setFieldValue: detail.setFieldValue,
    fieldErrors: detail.fieldErrors,
    personName: str(detail.values, 'name'),
    personType: (str(detail.values, 'type') || 'Pessoa Física') as PersonType,
    personLookupOptions,
    handleAddPersonLookup,
    handleDeletePersonLookup,
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
