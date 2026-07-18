import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { usePersonStore } from '../../../stores/usePersonStore';
import { usePersonTagStore } from '../../../stores/usePersonTagStore';
import { usePersonLookup } from '../../../stores/usePersonLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import type { Person, PersonType, PersonAddress, Gender, CustomFieldValue, FieldDefinition, PersonLookupKind } from '../../../domain/entities';
import type { LookupOptionSet } from '../../components/ui/CustomFieldsSection/CustomFieldsSection.viewmodel';
import { useEntityNotes } from '../../shared/entityScreen/useEntityNotes';
import { useEntityDocuments } from '../../shared/entityScreen/useEntityDocuments';
import { useEntityDetailChrome } from '../../shared/entityScreen/useEntityDetailChrome';
import { useNotesPort } from '../../shared/entityScreen/useNotesPort';
import { useDocumentsPort } from '../../shared/entityScreen/useDocumentsPort';
import type {
  EntityDocumentsController,
  EntityNotesController,
} from '../../shared/entityScreen/types';
import { PERSON_FORM_FIELDS } from './personSchema';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { buildInitialFormValues, formValuesToStoredValues, validateRequiredFields } from '../../../domain/services/customFieldValues';
import { onlyNumbers } from '../../../utils/formatters';
import { describeRuleIssues } from '../../../domain/schema/fieldRules';
import { validateRecordRules } from '../../../data/utils/recordRulesGate';
import { format, parseISO } from 'date-fns';

export type ViewPersonTab = 'data' | 'notes' | 'documents';

export interface PersonFormData {
  type: PersonType;
  name: string;
  cpf: string;
  cnpj: string;
  email: string;
  phone: string;
  secondaryPhone: string;
  occupation: string;
  nationality: string;
  maritalStatus: string;
  relationship: string;
  birthDate: string;
  gender: string;
  notes: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
}

const buildFormData = (person: Person | null): PersonFormData => ({
  type: person?.type ?? 'Pessoa Física',
  name: person?.name ?? '',
  cpf: person?.cpf ?? '',
  cnpj: person?.cnpj ?? '',
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
  addressStreet: person?.address?.street ?? '',
  addressNumber: person?.address?.number ?? '',
  addressComplement: person?.address?.complement ?? '',
  addressNeighborhood: person?.address?.neighborhood ?? '',
  addressCity: person?.address?.city ?? '',
  addressState: person?.address?.state ?? '',
  addressZipCode: person?.address?.zipCode ?? '',
});

const ADDRESS_KEY_MAP: Record<string, keyof PersonFormData> = {
  'address.street': 'addressStreet',
  'address.number': 'addressNumber',
  'address.complement': 'addressComplement',
  'address.neighborhood': 'addressNeighborhood',
  'address.city': 'addressCity',
  'address.state': 'addressState',
  'address.zipCode': 'addressZipCode',
};

const LOOKUP_COLLECTION_TO_KIND: Record<string, PersonLookupKind> = {
  personTypes: 'types',
  personOccupations: 'occupations',
  personNationalities: 'nationalities',
  personMaritalStatuses: 'maritalStatuses',
  personCities: 'cities',
  personRelationships: 'relationships',
  personGenders: 'genders',
};

export interface ViewPersonViewModel {
  isNew: boolean;
  person: Person | null;
  activeTab: ViewPersonTab;
  setActiveTab: (tab: ViewPersonTab) => void;
  formData: PersonFormData;
  setFormData: (data: Partial<PersonFormData>) => void;
  nativeFields: FieldDefinition[];
  nativeValues: Record<string, CustomFieldValue>;
  setNativeFieldValue: (fieldKey: string, value: CustomFieldValue) => void;
  personLookupOptions: Record<string, LookupOptionSet>;
  handleAddPersonLookup: (collection: string, label: string) => Promise<void>;
  handleDeletePersonLookup: (collection: string, optionKey: string) => Promise<void>;
  customFields: FieldDefinition[];
  customValues: Record<string, CustomFieldValue>;
  setCustomValue: (fieldKey: string, value: CustomFieldValue) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;

  notesController: EntityNotesController;
  docsController: EntityDocumentsController;
  isAdmin: boolean;

  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  statusLabel: string;
  relationshipColor: string;
  handleToggleStatus: () => Promise<void>;
  handleDeletePerson: () => void;
  personToDelete: Person | null;
  confirmDeletePerson: () => Promise<void>;
  cancelDeletePerson: () => void;
}

const CLONE_PREFIX = 'new-person:clone:';

export const useViewPersonViewModel = (tabKey: string): ViewPersonViewModel => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-person' || cloneSourceId !== null;
  const personId = isNew ? '' : tabKey.replace('view-person:', '');

  const { persons, createPerson, updatePerson, updatePersonStatus, deletePerson } = usePersonStore();
  const { tags, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag } = usePersonTagStore();
  const { typeConfigs, occupationConfigs, nationalityConfigs, maritalStatusConfigs, cityConfigs, relationshipConfigs, genderConfigs, addItem, removeItem } = usePersonLookup();
  const { user, effectiveName } = useAuth();
  const { tenantRole, currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();
  const { personNoteRepository, personDocumentRepository } = useDI();

  const person = useMemo(
    () => (isNew ? null : (persons.find((c) => c.id === personId) ?? null)),
    [persons, personId, isNew],
  );

  const cloneSource = useMemo(
    () => (cloneSourceId ? (persons.find((p) => p.id === cloneSourceId) ?? null) : null),
    [persons, cloneSourceId],
  );

  const isAdmin = tenantRole === 'admin';

  const [formData, setFormDataState] = useState<PersonFormData>(() => {
    const base = buildFormData(cloneSource);
    return cloneSource ? { ...base, cpf: '', cnpj: '' } : base;
  });
  const [isSaving, setIsSaving] = useState(false);
  const { getCustomFieldsFor } = useScreenDefinitions();
  const customFields = useMemo(() => getCustomFieldsFor('persons'), [getCustomFieldsFor]);
  const [customValues, setCustomValues] = useState<Record<string, CustomFieldValue>>({});

  const chrome = useEntityDetailChrome({
    recordId: person?.id ?? null,
    deepLinkKey: (id) => `view-person:${id}`,
    cloneKey: (id) => `${CLONE_PREFIX}${id}`,
    remove: (id) => deletePerson(id),
    onRemoved: () => closeTab(tabKey, activePanelId),
    removedMessage: 'Pessoa excluída.',
    removeErrorMessage: 'Erro ao excluir pessoa.',
  });

  const notesPort = useNotesPort(personNoteRepository);
  const documentsPort = useDocumentsPort(personDocumentRepository);

  const notesController = useEntityNotes({ enabled: !!person, recordId: person?.id ?? null, port: notesPort });
  const docsController = useEntityDocuments({ enabled: !!person, recordId: person?.id ?? null, port: documentsPort });

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza campos adicionais ao carregar/atualizar dados
    setCustomValues(buildInitialFormValues(customFields, (person ?? cloneSource)?.customValues ?? null));
  }, [person, cloneSource, customFields]);

  const setCustomValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    setCustomValues((prev) => ({ ...prev, [fieldKey]: value }));
  }, []);

  useEffect(() => {
    if (person) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar/atualizar dados da pessoa
      setFormDataState(buildFormData(person));
      setTabTitle(tabKey, person.name);
    }
  }, [person, tabKey, setTabTitle]);

  const setFormData = useCallback((data: Partial<PersonFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) { notify('Nome é obrigatório.', 'error'); return; }
    const customFieldsError = validateRequiredFields(customFields, customValues);
    if (customFieldsError) { notify(customFieldsError, 'error'); return; }
    if (!currentTenant) return;

    setIsSaving(true);
    try {
      const address: PersonAddress = {};
      if (formData.addressStreet)       address.street        = formData.addressStreet;
      if (formData.addressNumber)       address.number        = formData.addressNumber;
      if (formData.addressComplement)   address.complement    = formData.addressComplement;
      if (formData.addressNeighborhood) address.neighborhood  = formData.addressNeighborhood;
      if (formData.addressCity)         address.city          = formData.addressCity;
      if (formData.addressState)        address.state         = formData.addressState;
      if (formData.addressZipCode) {
        const zipNumbers = onlyNumbers(formData.addressZipCode);
        if (zipNumbers.length > 0) address.zipCode = zipNumbers;
      }
      const hasAddress = Object.keys(address).length > 0;

      const cpfNumbers = formData.cpf ? onlyNumbers(formData.cpf) : null;
      const cnpjNumbers = formData.cnpj ? onlyNumbers(formData.cnpj) : null;
      const phoneNumbers = formData.phone ? onlyNumbers(formData.phone) : null;
      const secondaryPhoneNumbers = formData.secondaryPhone ? onlyNumbers(formData.secondaryPhone) : null;

      const payload = {
        type: formData.type,
        name: formData.name.trim(),
        cpf: cpfNumbers && cpfNumbers.length === 11 ? cpfNumbers : null,
        cnpj: cnpjNumbers && cnpjNumbers.length === 14 ? cnpjNumbers : null,
        email: formData.email || null,
        phone: phoneNumbers || null,
        secondaryPhone: secondaryPhoneNumbers || null,
        occupation: formData.occupation || null,
        nationality: formData.nationality || null,
        maritalStatus: formData.maritalStatus || null,
        relationship: formData.relationship || null,
        birthDate: formData.birthDate ? parseISO(formData.birthDate) : null,
        gender: (formData.gender as Gender) || null,
        notes: formData.notes || null,
        address: hasAddress ? address : null,
        customValues: formValuesToStoredValues(customFields, customValues),
      };

      const ruleIssues = validateRecordRules('persons', payload);
      if (ruleIssues.length > 0) {
        notify(describeRuleIssues(ruleIssues), 'error');
        return;
      }

      if (isNew) {
        const created = await createPerson({ ...payload, status: 'Ativo', createdBy: user?.id ?? '', tagIds: [] });
        notify('Pessoa cadastrada com sucesso!', 'success');
        const newTabKey = `view-person:${created.id}`;
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.name);
      } else if (person) {
        await updatePerson(person.id, {
          ...payload,
          updatedBy: user?.id ?? '',
          updatedByName: effectiveName,
          updatedByPhotoURL: user?.photoURL ?? '',
        });
        notify('Pessoa atualizada com sucesso!', 'success');
      }
    } catch (err) {
      console.error('[ViewPerson handleSave]', err);
      notify('Erro ao salvar pessoa.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, customFields, customValues, isNew, person, createPerson, updatePerson, currentTenant, notify, user, effectiveName, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForPerson(entityId, person?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForPerson(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, person, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag]);

  const statusLabel = person?.status === 'Ativo' ? 'Ativo' : 'Inativo';

  const relationshipColor = useMemo(() => {
    const rel = formData.relationship;
    if (!rel) return theme.colors.relationshipDefault;
    return getConfigColor(relationshipConfigs, rel, theme, theme.colors.relationshipDefault);
  }, [formData.relationship, relationshipConfigs, theme]);

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

  const setNativeFieldValue = useCallback((fieldKey: string, value: CustomFieldValue) => {
    const mapped = ADDRESS_KEY_MAP[fieldKey] ?? fieldKey;
    setFormData({ [mapped]: value } as Partial<PersonFormData>);
  }, [setFormData]);

  const nativeValues = useMemo<Record<string, CustomFieldValue>>(() => {
    const {
      addressStreet, addressNumber, addressComplement, addressNeighborhood,
      addressCity, addressState, addressZipCode, ...rest
    } = formData;
    return {
      ...rest,
      address: {
        street: addressStreet,
        number: addressNumber,
        complement: addressComplement,
        neighborhood: addressNeighborhood,
        city: addressCity,
        state: addressState,
        zipCode: addressZipCode,
      },
    } as unknown as Record<string, CustomFieldValue>;
  }, [formData]);

  return {
    isNew,
    person,
    activeTab: chrome.activeTab,
    setActiveTab: chrome.setActiveTab,
    formData,
    setFormData,
    nativeFields: PERSON_FORM_FIELDS,
    nativeValues,
    setNativeFieldValue,
    personLookupOptions,
    handleAddPersonLookup,
    handleDeletePersonLookup,
    customFields,
    customValues,
    setCustomValue,
    isSaving,
    handleSave,
    tagAdapter,
    isTagManagerOpen: chrome.isTagManagerOpen,
    openTagManager: chrome.openTagManager,
    closeTagManager: chrome.closeTagManager,
    notesController,
    docsController,
    isAdmin,
    copyLinkDone: chrome.copyLinkDone,
    handleCopyDeepLink: chrome.handleCopyDeepLink,
    handleClone: chrome.handleClone,
    statusLabel,
    relationshipColor,
    handleToggleStatus,
    handleDeletePerson: chrome.requestDelete,
    personToDelete: chrome.isDeleteOpen ? person : null,
    confirmDeletePerson: chrome.confirmDelete,
    cancelDeletePerson: chrome.cancelDelete,
  };
};
