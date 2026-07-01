import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { usePersonStore } from '../../../stores/usePersonStore';
import { usePersonTagStore } from '../../../stores/usePersonTagStore';
import { usePersonLookup } from '../../../stores/usePersonLookup';
import { useDocumentTypeLookup } from '../../../stores/useDocumentTypeLookup';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import { makeGetPersonNotesUseCase } from '../../../domain/usecases/personnotes/GetPersonNotesUseCase';
import { makeAddPersonNoteUseCase } from '../../../domain/usecases/personnotes/AddPersonNoteUseCase';
import { makeDeletePersonNoteUseCase } from '../../../domain/usecases/personnotes/DeletePersonNoteUseCase';
import { makeGetPersonDocumentsUseCase } from '../../../domain/usecases/persondocuments/GetPersonDocumentsUseCase';
import { makeUploadPersonDocumentUseCase } from '../../../domain/usecases/persondocuments/UploadPersonDocumentUseCase';
import { makeAddPersonDocumentUseCase } from '../../../domain/usecases/persondocuments/AddPersonDocumentUseCase';
import { makeDeletePersonDocumentUseCase } from '../../../domain/usecases/persondocuments/DeletePersonDocumentUseCase';
import type { Person, PersonNote, PersonDocument, PersonType, PersonAddress } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import { formatCPF, formatCNPJ, formatPhone, formatCEP, onlyNumbers } from '../../../utils/formatters';
import { validateCPF, validateCNPJ } from '../../../utils/validators';

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
  notes: string;
  addressStreet: string;
  addressNumber: string;
  addressComplement: string;
  addressNeighborhood: string;
  addressCity: string;
  addressState: string;
  addressZipCode: string;
}

export interface PersonFormErrors {
  cpf?: string;
  cnpj?: string;
}

interface ViaCEPResponse {
  cep: string;
  logradouro: string;
  complemento: string;
  bairro: string;
  localidade: string;
  uf: string;
  erro?: boolean;
}

const buildFormData = (person: Person | null): PersonFormData => ({
  type: person?.type ?? 'Pessoa Física',
  name: person?.name ?? '',
  cpf: person?.cpf ? formatCPF(person.cpf) : '',
  cnpj: person?.cnpj ? formatCNPJ(person.cnpj) : '',
  email: person?.email ?? '',
  phone: person?.phone ? formatPhone(person.phone) : '',
  secondaryPhone: person?.secondaryPhone ? formatPhone(person.secondaryPhone) : '',
  occupation: person?.occupation ?? '',
  nationality: person?.nationality ?? '',
  maritalStatus: person?.maritalStatus ?? '',
  relationship: person?.relationship ?? '',
  notes: person?.notes ?? '',
  addressStreet: person?.address?.street ?? '',
  addressNumber: person?.address?.number ?? '',
  addressComplement: person?.address?.complement ?? '',
  addressNeighborhood: person?.address?.neighborhood ?? '',
  addressCity: person?.address?.city ?? '',
  addressState: person?.address?.state ?? '',
  addressZipCode: person?.address?.zipCode ? formatCEP(person.address.zipCode) : '',
});

export interface ViewPersonViewModel {
  isNew: boolean;
  person: Person | null;
  activeTab: ViewPersonTab;
  setActiveTab: (tab: ViewPersonTab) => void;
  formData: PersonFormData;
  setFormData: (data: Partial<PersonFormData>) => void;
  formErrors: PersonFormErrors;
  handleCPFChange: (value: string) => void;
  handleCNPJChange: (value: string) => void;
  handlePhoneChange: (value: string) => void;
  handleSecondaryPhoneChange: (value: string) => void;
  handleCEPChange: (value: string) => void;
  isFetchingAddress: boolean;
  addressFetchError: string;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;

  notes: PersonNote[];
  notesLoading: boolean;
  newNoteTitle: string;
  setNewNoteTitle: (v: string) => void;
  newNoteText: string;
  setNewNoteText: (v: string) => void;
  isAddingNote: boolean;
  isNoteEditorOpen: boolean;
  openNoteEditor: () => void;
  closeNoteEditor: () => void;
  expandedNoteIds: Set<string>;
  toggleNoteExpanded: (id: string) => void;
  handleAddNote: () => Promise<void>;
  noteToDelete: PersonNote | null;
  requestDeleteNote: (note: PersonNote) => void;
  confirmDeleteNote: () => Promise<void>;
  cancelDeleteNote: () => void;
  isAdmin: boolean;

  documents: PersonDocument[];
  docsLoading: boolean;
  isUploadingDoc: boolean;
  pendingFile: File | null;
  pendingType: string;
  setPendingType: (v: string) => void;
  documentTypeOptions: DynamicSelectOption[];
  documentTypeDynamicOptions: DynamicSelectOption[];
  handleAddDocumentType: (name: string) => Promise<void>;
  handleDeleteDocumentType: (key: string) => Promise<void>;
  handleSelectFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleConfirmUpload: () => Promise<void>;
  handleCancelPendingUpload: () => void;
  docToDelete: PersonDocument | null;
  requestDeleteDoc: (doc: PersonDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;

  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  statusLabel: string;
  relationshipColor: string;
  handleToggleStatus: () => Promise<void>;
  handleDeletePerson: () => void;
  personToDelete: Person | null;
  confirmDeletePerson: () => Promise<void>;
  cancelDeletePerson: () => void;

  typeOptions:             DynamicSelectOption[];
  typeDynamicOptions:      DynamicSelectOption[];
  occupationOptions:       DynamicSelectOption[];
  nationalityOptions:      DynamicSelectOption[];
  nationalityDynamicOptions: DynamicSelectOption[];
  maritalStatusOptions:    DynamicSelectOption[];
  maritalStatusDynamicOptions: DynamicSelectOption[];
  cityOptions:             DynamicSelectOption[];
  relationshipOptions:     DynamicSelectOption[];
  relationshipDynamicOptions: DynamicSelectOption[];

  handleAddType:           (name: string) => Promise<void>;
  handleDeleteType:        (key: string)  => Promise<void>;
  handleAddOccupation:     (name: string) => Promise<void>;
  handleDeleteOccupation:  (key: string)  => Promise<void>;
  handleAddNationality:    (name: string) => Promise<void>;
  handleDeleteNationality: (key: string)  => Promise<void>;
  handleAddMaritalStatus:  (name: string) => Promise<void>;
  handleDeleteMaritalStatus:(key: string) => Promise<void>;
  handleAddCity:           (name: string) => Promise<void>;
  handleDeleteCity:        (key: string)  => Promise<void>;
  handleAddRelationship:   (name: string) => Promise<void>;
  handleDeleteRelationship:(key: string)  => Promise<void>;
}

export const useViewPersonViewModel = (tabKey: string): ViewPersonViewModel => {
  const isNew = tabKey === 'new-person';
  const personId = isNew ? '' : tabKey.replace('view-person:', '');

  const { persons, createPerson, updatePerson, updatePersonStatus, deletePerson } = usePersonStore();
  const { tags, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag } = usePersonTagStore();
  const { typeConfigs, occupationConfigs, nationalityConfigs, maritalStatusConfigs, cityConfigs, relationshipConfigs, addItem, removeItem } = usePersonLookup();
  const { typeConfigs: documentTypeConfigs, addItem: addDocumentType, removeItem: removeDocumentType } = useDocumentTypeLookup();
  const { user } = useAuth();
  const { tenantRole, currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();
  const { personNoteRepository, personDocumentRepository } = useDI();

  const person = useMemo(
    () => (isNew ? null : (persons.find((c) => c.id === personId) ?? null)),
    [persons, personId, isNew],
  );

  const isAdmin = tenantRole === 'admin';

  const [activeTab, setActiveTab] = useState<ViewPersonTab>('data');
  const [formData, setFormDataState] = useState<PersonFormData>(() => buildFormData(person));
  const [formErrors, setFormErrors] = useState<PersonFormErrors>({});
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingAddress, setIsFetchingAddress] = useState(false);
  const [addressFetchError, setAddressFetchError] = useState('');
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [personToDelete, setPersonToDelete] = useState<Person | null>(null);

  const [notes, setNotes] = useState<PersonNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<PersonNote | null>(null);

  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  const [documents, setDocuments] = useState<PersonDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docToDelete, setDocToDelete] = useState<PersonDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');

  const noteUC = useMemo(() => ({
    get:    makeGetPersonNotesUseCase(personNoteRepository),
    add:    makeAddPersonNoteUseCase(personNoteRepository),
    delete: makeDeletePersonNoteUseCase(personNoteRepository),
  }), [personNoteRepository]);

  const docUC = useMemo(() => ({
    get:    makeGetPersonDocumentsUseCase(personDocumentRepository),
    upload: makeUploadPersonDocumentUseCase(personDocumentRepository),
    add:    makeAddPersonDocumentUseCase(personDocumentRepository),
    delete: makeDeletePersonDocumentUseCase(personDocumentRepository),
  }), [personDocumentRepository]);

  useEffect(() => {
    if (person) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar/atualizar dados da pessoa
      setFormDataState(buildFormData(person));
      setTabTitle(tabKey, person.name);
    }
  }, [person, tabKey, setTabTitle]);

  useEffect(() => {
    if (!person || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial após navegação para aba
    setNotesLoading(true);
    noteUC.get.execute(currentTenant.id, person.id)
      .then(setNotes)
      .finally(() => setNotesLoading(false));
  }, [person, currentTenant, noteUC]);

  useEffect(() => {
    if (!person || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial após navegação para aba
    setDocsLoading(true);
    docUC.get.execute(currentTenant.id, person.id)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [person, currentTenant, docUC]);

  const setFormData = useCallback((data: Partial<PersonFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleCPFChange = useCallback((value: string) => {
    const cleanValue = value.toLowerCase().trim();
    if (cleanValue === 'x' || cleanValue === '') {
      setFormDataState((prev) => ({ ...prev, cpf: '' }));
      setFormErrors((prev) => ({ ...prev, cpf: undefined }));
      return;
    }
    const formatted = formatCPF(value);
    setFormDataState((prev) => ({ ...prev, cpf: formatted }));
    const numbers = onlyNumbers(formatted);
    if (numbers.length > 0 && numbers.length === 11) {
      if (!validateCPF(numbers)) {
        setFormErrors((prev) => ({ ...prev, cpf: 'CPF inválido' }));
      } else {
        setFormErrors((prev) => ({ ...prev, cpf: undefined }));
      }
    } else if (numbers.length === 11) {
      setFormErrors((prev) => ({ ...prev, cpf: undefined }));
    }
  }, []);

  const handleCNPJChange = useCallback((value: string) => {
    const cleanValue = value.toLowerCase().trim();
    if (cleanValue === 'x' || cleanValue === '') {
      setFormDataState((prev) => ({ ...prev, cnpj: '' }));
      setFormErrors((prev) => ({ ...prev, cnpj: undefined }));
      return;
    }
    const formatted = formatCNPJ(value);
    setFormDataState((prev) => ({ ...prev, cnpj: formatted }));
    const numbers = onlyNumbers(formatted);
    if (numbers.length > 0 && numbers.length === 14) {
      if (!validateCNPJ(numbers)) {
        setFormErrors((prev) => ({ ...prev, cnpj: 'CNPJ inválido' }));
      } else {
        setFormErrors((prev) => ({ ...prev, cnpj: undefined }));
      }
    } else if (numbers.length === 14) {
      setFormErrors((prev) => ({ ...prev, cnpj: undefined }));
    }
  }, []);

  const handlePhoneChange = useCallback((value: string) => {
    const cleanValue = value.toLowerCase().trim();
    if (cleanValue === 'x' || cleanValue === '') {
      setFormDataState((prev) => ({ ...prev, phone: '' }));
      return;
    }
    const formatted = formatPhone(value);
    setFormDataState((prev) => ({ ...prev, phone: formatted }));
  }, []);

  const handleSecondaryPhoneChange = useCallback((value: string) => {
    const cleanValue = value.toLowerCase().trim();
    if (cleanValue === 'x' || cleanValue === '') {
      setFormDataState((prev) => ({ ...prev, secondaryPhone: '' }));
      return;
    }
    const formatted = formatPhone(value);
    setFormDataState((prev) => ({ ...prev, secondaryPhone: formatted }));
  }, []);

  const handleCEPChange = useCallback((value: string) => {
    const cleanValue = value.toLowerCase().trim();
    if (cleanValue === 'x' || cleanValue === '') {
      setFormDataState((prev) => ({ ...prev, addressZipCode: '' }));
      setAddressFetchError('');
      return;
    }
    const formatted = formatCEP(value);
    setFormDataState((prev) => ({ ...prev, addressZipCode: formatted }));
    
    const numbers = onlyNumbers(formatted);
    if (numbers.length === 8) {
      setIsFetchingAddress(true);
      setAddressFetchError('');
      
      fetch(`https://viacep.com.br/ws/${numbers}/json/`)
        .then(async (res) => {
          if (!res.ok) throw new Error('Erro ao buscar CEP');
          return res.json() as Promise<ViaCEPResponse>;
        })
        .then((data) => {
          if (data.erro) {
            setAddressFetchError('CEP não encontrado');
            return;
          }
          setFormDataState((prev) => ({
            ...prev,
            addressStreet: data.logradouro || prev.addressStreet,
            addressNeighborhood: data.bairro || prev.addressNeighborhood,
            addressCity: data.localidade || prev.addressCity,
            addressState: data.uf || prev.addressState,
          }));
        })
        .catch(() => {
          setAddressFetchError('Erro ao buscar endereço');
        })
        .finally(() => {
          setIsFetchingAddress(false);
        });
    }
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.name.trim()) { notify('Nome é obrigatório.', 'error'); return; }
    if (!currentTenant) return;

    // Valida CPF/CNPJ se preenchidos
    if (formData.cpf) {
      const cpfNumbers = onlyNumbers(formData.cpf);
      if (cpfNumbers.length > 0 && !validateCPF(cpfNumbers)) {
        notify('CPF inválido.', 'error');
        return;
      }
    }
    if (formData.cnpj) {
      const cnpjNumbers = onlyNumbers(formData.cnpj);
      if (cnpjNumbers.length > 0 && !validateCNPJ(cnpjNumbers)) {
        notify('CNPJ inválido.', 'error');
        return;
      }
    }

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
        notes: formData.notes || null,
        address: hasAddress ? address : null,
      };

      if (isNew) {
        const created = await createPerson({ ...payload, status: 'Ativo', createdBy: user?.id ?? '', tagIds: [] });
        notify('Pessoa cadastrada com sucesso!', 'success');
        // Transição automática para modo de edição
        const newTabKey = `view-person:${created.id}`;
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.name);
      } else if (person) {
        await updatePerson(person.id, payload);
        notify('Pessoa atualizada com sucesso!', 'success');
      }
    } catch (err) {
      console.error('[ViewPerson handleSave]', err);
      notify('Erro ao salvar pessoa.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isNew, person, createPerson, updatePerson, currentTenant, notify, user, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForPerson(entityId, person?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForPerson(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, person, getTagsForPerson, setTagsForPerson, createTag, updateTag, deleteTag]);

  const openTagManager = useCallback(() => setIsTagManagerOpen(true), []);
  const closeTagManager = useCallback(() => setIsTagManagerOpen(false), []);

  const openNoteEditor = useCallback(() => setIsNoteEditorOpen(true), []);
  const closeNoteEditor = useCallback(() => {
    setIsNoteEditorOpen(false);
    setNewNoteTitle('');
    setNewNoteText('');
  }, []);

  const toggleNoteExpanded = useCallback((id: string) => {
    setExpandedNoteIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const handleAddNote = useCallback(async () => {
    if (!newNoteTitle.trim() || !newNoteText.trim() || !person || !currentTenant || !user) return;
    setIsAddingNote(true);
    try {
      const note = await noteUC.add.execute(currentTenant.id, person.id, {
        title: newNoteTitle.trim(),
        text: newNoteText.trim(),
        createdBy: user.id,
        createdByName: user.displayName,
        createdByPhotoUrl: user.photoURL ?? undefined,
      });
      setNotes((prev) => [note, ...prev]);
      setNewNoteTitle('');
      setNewNoteText('');
      setIsNoteEditorOpen(false);
      notify('Anotação adicionada.', 'success');
    } catch {
      notify('Erro ao adicionar anotação.', 'error');
    } finally {
      setIsAddingNote(false);
    }
  }, [newNoteTitle, newNoteText, person, currentTenant, user, noteUC, notify]);

  const requestDeleteNote = useCallback((note: PersonNote) => setNoteToDelete(note), []);
  const cancelDeleteNote = useCallback(() => setNoteToDelete(null), []);
  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete || !person || !currentTenant) return;
    try {
      await noteUC.delete.execute(currentTenant.id, person.id, noteToDelete.id);
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      notify('Anotação excluída.', 'success');
    } catch {
      notify('Erro ao excluir anotação.', 'error');
    } finally {
      setNoteToDelete(null);
    }
  }, [noteToDelete, person, currentTenant, noteUC, notify]);

  const handleSelectFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setPendingFile(file);
      setPendingType('');
    }
    e.target.value = '';
  }, []);

  const handleCancelPendingUpload = useCallback(() => {
    setPendingFile(null);
    setPendingType('');
  }, []);

  const handleConfirmUpload = useCallback(async () => {
    if (!pendingFile || !person || !currentTenant || !user) return;
    setIsUploadingDoc(true);
    try {
      const raw = await docUC.upload.execute(currentTenant.id, person.id, pendingFile);
      const { url, storagePath } = JSON.parse(raw) as { url: string; storagePath: string };
      const addedDoc = await docUC.add.execute(currentTenant.id, person.id, {
        name: pendingFile.name,
        type: pendingType.trim() || undefined,
        url,
        storagePath,
        createdBy: user.id,
        createdByName: user.displayName,
        createdByPhotoUrl: user.photoURL ?? undefined,
      });
      setDocuments((prev) => [addedDoc, ...prev]);
      setPendingFile(null);
      setPendingType('');
      notify('Documento enviado com sucesso.', 'success');
    } catch {
      notify('Erro ao enviar documento.', 'error');
    } finally {
      setIsUploadingDoc(false);
    }
  }, [pendingFile, pendingType, person, currentTenant, user, docUC, notify]);

  const requestDeleteDoc = useCallback((doc: PersonDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !person || !currentTenant) return;
    try {
      await docUC.delete.execute(currentTenant.id, person.id, docToDelete.id, docToDelete.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, person, currentTenant, docUC, notify]);

  const handleCopyDeepLink = useCallback(() => {
    if (!person) return;
    void navigator.clipboard.writeText(generateDeepLink(`view-person:${person.id}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [person]);

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

  const handleDeletePerson = useCallback(() => {
    if (person) setPersonToDelete(person);
  }, [person]);

  const confirmDeletePerson = useCallback(async () => {
    if (!personToDelete) return;
    try {
      await deletePerson(personToDelete.id);
      notify('Pessoa excluída.', 'success');
      closeTab(tabKey, activePanelId);
    } catch {
      notify('Erro ao excluir pessoa.', 'error');
    } finally {
      setPersonToDelete(null);
    }
  }, [personToDelete, deletePerson, notify, closeTab, tabKey, activePanelId]);

  const cancelDeletePerson = useCallback(() => setPersonToDelete(null), []);

  const typeOptions = useMemo<DynamicSelectOption[]>(
    () => typeConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );
  const typeDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => typeConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );

  const occupationOptions = useMemo<DynamicSelectOption[]>(
    () => occupationConfigs.map(c => ({ value: c.key, label: c.label })),
    [occupationConfigs],
  );

  const nationalityOptions = useMemo<DynamicSelectOption[]>(
    () => nationalityConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [nationalityConfigs],
  );
  const nationalityDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => nationalityConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [nationalityConfigs],
  );

  const maritalStatusOptions = useMemo<DynamicSelectOption[]>(
    () => maritalStatusConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [maritalStatusConfigs],
  );
  const maritalStatusDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => maritalStatusConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [maritalStatusConfigs],
  );

  const cityOptions = useMemo<DynamicSelectOption[]>(
    () => cityConfigs.map(c => ({ value: c.key, label: c.label })),
    [cityConfigs],
  );

  const relationshipOptions = useMemo<DynamicSelectOption[]>(
    () => relationshipConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [relationshipConfigs, theme],
  );
  const relationshipDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => relationshipConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [relationshipConfigs, theme],
  );

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter(t => t.isStatic !== false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter(t => t.isStatic === false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );

  const handleAddType            = useCallback(async (name: string) => { await addItem('types', name); },           [addItem]);
  const handleDeleteType         = useCallback(async (key: string)  => { await removeItem('types', key); },         [removeItem]);
  const handleAddOccupation      = useCallback(async (name: string) => { await addItem('occupations', name); },     [addItem]);
  const handleDeleteOccupation   = useCallback(async (key: string)  => { await removeItem('occupations', key); },   [removeItem]);
  const handleAddNationality     = useCallback(async (name: string) => { await addItem('nationalities', name); },   [addItem]);
  const handleDeleteNationality  = useCallback(async (key: string)  => { await removeItem('nationalities', key); }, [removeItem]);
  const handleAddMaritalStatus   = useCallback(async (name: string) => { await addItem('maritalStatuses', name); }, [addItem]);
  const handleDeleteMaritalStatus= useCallback(async (key: string)  => { await removeItem('maritalStatuses', key); },[removeItem]);
  const handleAddCity            = useCallback(async (name: string) => { await addItem('cities', name); },          [addItem]);
  const handleDeleteCity         = useCallback(async (key: string)  => { await removeItem('cities', key); },        [removeItem]);
  const handleAddRelationship    = useCallback(async (name: string) => { await addItem('relationships', name); },   [addItem]);
  const handleDeleteRelationship = useCallback(async (key: string)  => { await removeItem('relationships', key); }, [removeItem]);

  const handleAddDocumentType = useCallback(async (name: string) => { await addDocumentType(name); }, [addDocumentType]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeDocumentType(key); }, [removeDocumentType]);

  return {
    isNew,
    person,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    formErrors,
    handleCPFChange,
    handleCNPJChange,
    handlePhoneChange,
    handleSecondaryPhoneChange,
    handleCEPChange,
    isFetchingAddress,
    addressFetchError,
    isSaving,
    handleSave,
    tagAdapter,
    isTagManagerOpen,
    openTagManager,
    closeTagManager,
    notes,
    notesLoading,
    newNoteTitle,
    setNewNoteTitle,
    newNoteText,
    setNewNoteText,
    isAddingNote,
    isNoteEditorOpen,
    openNoteEditor,
    closeNoteEditor,
    expandedNoteIds,
    toggleNoteExpanded,
    handleAddNote,
    noteToDelete,
    requestDeleteNote,
    confirmDeleteNote,
    cancelDeleteNote,
    isAdmin,
    documents,
    docsLoading,
    isUploadingDoc,
    pendingFile,
    pendingType,
    setPendingType,
    documentTypeOptions,
    documentTypeDynamicOptions,
    handleAddDocumentType,
    handleDeleteDocumentType,
    handleSelectFile,
    handleConfirmUpload,
    handleCancelPendingUpload,
    docToDelete,
    requestDeleteDoc,
    confirmDeleteDoc,
    cancelDeleteDoc,
    copyLinkDone,
    handleCopyDeepLink,
    statusLabel,
    relationshipColor,
    handleToggleStatus,
    handleDeletePerson,
    personToDelete,
    confirmDeletePerson,
    cancelDeletePerson,
    typeOptions,
    typeDynamicOptions,
    occupationOptions,
    nationalityOptions,
    nationalityDynamicOptions,
    maritalStatusOptions,
    maritalStatusDynamicOptions,
    cityOptions,
    relationshipOptions,
    relationshipDynamicOptions,
    handleAddType,
    handleDeleteType,
    handleAddOccupation,
    handleDeleteOccupation,
    handleAddNationality,
    handleDeleteNationality,
    handleAddMaritalStatus,
    handleDeleteMaritalStatus,
    handleAddCity,
    handleDeleteCity,
    handleAddRelationship,
    handleDeleteRelationship,
  };
};
