import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { useContractStore } from '../../../stores/useContractStore';
import { useContractTagStore } from '../../../stores/useContractTagStore';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseLookup } from '../../../stores/useCaseLookup';
import { useContractLookup } from '../../../stores/useContractLookup';
import { useDocumentTypeLookup } from '../../../stores/useDocumentTypeLookup';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';
import type { MultiSearchSelectOption } from '../../components/ui/MultiSearchSelect';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';
import { makeGetContractNotesUseCase } from '../../../domain/usecases/contractnotes/GetContractNotesUseCase';
import { makeAddContractNoteUseCase } from '../../../domain/usecases/contractnotes/AddContractNoteUseCase';
import { makeDeleteContractNoteUseCase } from '../../../domain/usecases/contractnotes/DeleteContractNoteUseCase';
import { makeGetContractDocumentsUseCase } from '../../../domain/usecases/contractdocuments/GetContractDocumentsUseCase';
import { makeUploadContractDocumentUseCase } from '../../../domain/usecases/contractdocuments/UploadContractDocumentUseCase';
import { makeAddContractDocumentUseCase } from '../../../domain/usecases/contractdocuments/AddContractDocumentUseCase';
import { makeDeleteContractDocumentUseCase } from '../../../domain/usecases/contractdocuments/DeleteContractDocumentUseCase';
import type { Contract, ContractNote, ContractDocument, Case } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';

export type ViewContractTab = 'data' | 'notes' | 'documents' | 'cases';

const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

const generateContractNumber = (existing: Set<string>): string => {
  let candidate: string;
  do {
    const l1 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const l2 = LETTERS[Math.floor(Math.random() * LETTERS.length)];
    const digits = String(Math.floor(Math.random() * 10000)).padStart(4, '0');
    candidate = `${l1}${l2}${digits}`;
  } while (existing.has(candidate));
  return candidate;
};

const toDateInput = (d: Date | null | undefined): string => d ? d.toISOString().slice(0, 10) : '';

export interface ContractFormData {
  number: string;
  title: string;
  type: string;
  category: string;
  status: string;
  object: string;
  contractorIds: string[];
  contracteeIds: string[];
  witnessIds: string[];
  contractorLawyerIds: string[];
  contracteeLawyerIds: string[];
  clientId: string;
  responsibleId: string;
  draftedAt: string;
  signedAt: string;
  effectiveStart: string;
  effectiveEnd: string;
  autoRenewal: boolean;
  renewalDate: string;
  terminationDate: string;
  initialValue: number | null;
  monthlyValue: number | null;
  totalValue: number | null;
  adjustmentIndex: string;
  adjustmentPeriodicity: string;
  currency: string;
  paymentMethod: string;
  dueDay: string;
  installments: string;
  bank: string;
  bankAccount: string;
  pixKey: string;
  costCenter: string;
}

const buildFormData = (contract: Contract | null): ContractFormData => ({
  number: contract?.number ?? '',
  title: contract?.title ?? '',
  type: contract?.type ?? '',
  category: contract?.category ?? '',
  status: contract?.status ?? '',
  object: contract?.object ?? '',
  contractorIds: contract?.contractorIds ?? [],
  contracteeIds: contract?.contracteeIds ?? [],
  witnessIds: contract?.witnessIds ?? [],
  contractorLawyerIds: contract?.contractorLawyerIds ?? [],
  contracteeLawyerIds: contract?.contracteeLawyerIds ?? [],
  clientId: contract?.clientId ?? '',
  responsibleId: contract?.responsibleId ?? '',
  draftedAt: toDateInput(contract?.draftedAt),
  signedAt: toDateInput(contract?.signedAt),
  effectiveStart: toDateInput(contract?.effectiveStart),
  effectiveEnd: toDateInput(contract?.effectiveEnd),
  autoRenewal: contract?.autoRenewal ?? false,
  renewalDate: toDateInput(contract?.renewalDate),
  terminationDate: toDateInput(contract?.terminationDate),
  initialValue: contract?.initialValue ?? null,
  monthlyValue: contract?.monthlyValue ?? null,
  totalValue: contract?.totalValue ?? null,
  adjustmentIndex: contract?.adjustmentIndex ?? '',
  adjustmentPeriodicity: contract?.adjustmentPeriodicity ?? '',
  currency: contract?.currency ?? '',
  paymentMethod: contract?.paymentMethod ?? '',
  dueDay: contract?.dueDay != null ? String(contract.dueDay) : '',
  installments: contract?.installments != null ? String(contract.installments) : '',
  bank: contract?.bank ?? '',
  bankAccount: contract?.bankAccount ?? '',
  pixKey: contract?.pixKey ?? '',
  costCenter: contract?.costCenter ?? '',
});

export interface ViewContractViewModel {
  isNew: boolean;
  contract: Contract | null;
  activeTab: ViewContractTab;
  setActiveTab: (tab: ViewContractTab) => void;
  formData: ContractFormData;
  setFormData: (data: Partial<ContractFormData>) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  personOptions: MultiSearchSelectOption[];
  personSearchOptions: SearchSelectOption[];

  linkedCases: Case[];
  unlinkedCaseOptions: SearchSelectOption[];
  caseToAdd: string;
  setCaseToAdd: (v: string) => void;
  handleLinkCase: (caseId: string) => Promise<void>;
  handleOpenCase: (c: Case) => void;
  handleUnlinkCase: (c: Case) => Promise<void>;
  getCaseStatusColor: (status: string) => string;

  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;

  notes: ContractNote[];
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
  noteToDelete: ContractNote | null;
  requestDeleteNote: (note: ContractNote) => void;
  confirmDeleteNote: () => Promise<void>;
  cancelDeleteNote: () => void;
  isAdmin: boolean;

  documents: ContractDocument[];
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
  docToDelete: ContractDocument | null;
  requestDeleteDoc: (doc: ContractDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;

  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  statusColor: string;
  handleDeleteContract: () => void;
  contractToDelete: Contract | null;
  confirmDeleteContract: () => Promise<void>;
  cancelDeleteContract: () => void;

  typeOptions: DynamicSelectOption[];
  typeDynamicOptions: DynamicSelectOption[];
  categoryOptions: DynamicSelectOption[];
  categoryDynamicOptions: DynamicSelectOption[];
  statusOptions: DynamicSelectOption[];
  statusDynamicOptions: DynamicSelectOption[];
  objectOptions: DynamicSelectOption[];
  adjustmentIndexOptions: DynamicSelectOption[];
  adjustmentIndexDynamicOptions: DynamicSelectOption[];
  adjustmentPeriodicityOptions: DynamicSelectOption[];
  adjustmentPeriodicityDynamicOptions: DynamicSelectOption[];
  currencyOptions: DynamicSelectOption[];
  currencyDynamicOptions: DynamicSelectOption[];
  paymentMethodOptions: DynamicSelectOption[];
  paymentMethodDynamicOptions: DynamicSelectOption[];
  bankOptions: DynamicSelectOption[];
  costCenterOptions: DynamicSelectOption[];

  handleAddType: (name: string) => Promise<void>;
  handleDeleteType: (key: string) => Promise<void>;
  handleAddCategory: (name: string) => Promise<void>;
  handleDeleteCategory: (key: string) => Promise<void>;
  handleAddStatus: (name: string) => Promise<void>;
  handleDeleteStatus: (key: string) => Promise<void>;
  handleAddObject: (name: string) => Promise<void>;
  handleDeleteObject: (key: string) => Promise<void>;
  handleAddAdjustmentIndex: (name: string) => Promise<void>;
  handleDeleteAdjustmentIndex: (key: string) => Promise<void>;
  handleAddAdjustmentPeriodicity: (name: string) => Promise<void>;
  handleDeleteAdjustmentPeriodicity: (key: string) => Promise<void>;
  handleAddCurrency: (name: string) => Promise<void>;
  handleDeleteCurrency: (key: string) => Promise<void>;
  handleAddPaymentMethod: (name: string) => Promise<void>;
  handleDeletePaymentMethod: (key: string) => Promise<void>;
  handleAddBank: (name: string) => Promise<void>;
  handleDeleteBank: (key: string) => Promise<void>;
  handleAddCostCenter: (name: string) => Promise<void>;
  handleDeleteCostCenter: (key: string) => Promise<void>;
}

const CLONE_PREFIX = 'new-contract:clone:';

export const useViewContractViewModel = (tabKey: string): ViewContractViewModel => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-contract' || cloneSourceId !== null;
  const contractId = isNew ? '' : tabKey.replace('view-contract:', '');

  const { contracts, createContract, updateContract, deleteContract } = useContractStore();
  const { tags, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag } = useContractTagStore();
  const {
    typeConfigs, categoryConfigs, statusConfigs, objectConfigs,
    adjustmentIndexConfigs, adjustmentPeriodicityConfigs, currencyConfigs, paymentMethodConfigs,
    bankConfigs, costCenterConfigs, addItem, removeItem,
  } = useContractLookup();
  const { typeConfigs: documentTypeConfigs, addItem: addDocumentType, removeItem: removeDocumentType } = useDocumentTypeLookup();
  const { persons } = usePersonStore();
  const { cases, updateCase } = useCaseStore();
  const { statusConfigs: caseStatusConfigs } = useCaseLookup();
  const { user, effectiveName } = useAuth();
  const { tenantRole, currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const theme = useTheme();
  const { contractNoteRepository, contractDocumentRepository } = useDI();

  const contract = useMemo(
    () => (isNew ? null : (contracts.find((c) => c.id === contractId) ?? null)),
    [contracts, contractId, isNew],
  );

  const cloneSource = useMemo(
    () => (cloneSourceId ? (contracts.find((c) => c.id === cloneSourceId) ?? null) : null),
    [contracts, cloneSourceId],
  );

  const isAdmin = tenantRole === 'admin';

  const [activeTab, setActiveTab] = useState<ViewContractTab>('data');
  const [formData, setFormDataState] = useState<ContractFormData>(() => {
    const base = buildFormData(cloneSource);
    return cloneSource ? { ...base, number: '' } : base;
  });
  const [isSaving, setIsSaving] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [contractToDelete, setContractToDelete] = useState<Contract | null>(null);

  const [notes, setNotes] = useState<ContractNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<ContractNote | null>(null);

  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  const [documents, setDocuments] = useState<ContractDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docToDelete, setDocToDelete] = useState<ContractDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');

  const noteUC = useMemo(() => ({
    get: makeGetContractNotesUseCase(contractNoteRepository),
    add: makeAddContractNoteUseCase(contractNoteRepository),
    delete: makeDeleteContractNoteUseCase(contractNoteRepository),
  }), [contractNoteRepository]);

  const docUC = useMemo(() => ({
    get: makeGetContractDocumentsUseCase(contractDocumentRepository),
    upload: makeUploadContractDocumentUseCase(contractDocumentRepository),
    add: makeAddContractDocumentUseCase(contractDocumentRepository),
    delete: makeDeleteContractDocumentUseCase(contractDocumentRepository),
  }), [contractDocumentRepository]);

  useEffect(() => {
    if (contract) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar/atualizar dados do contrato
      setFormDataState(buildFormData(contract));
      setTabTitle(tabKey, contract.number ?? contract.title);
    }
  }, [contract, tabKey, setTabTitle]);

  useEffect(() => {
    if (!isNew) return;
    const existing = new Set(contracts.map((c) => c.number));
    const suggested = generateContractNumber(existing);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sugere um número de contrato aleatório ao criar
    setFormDataState((prev) => (prev.number ? prev : { ...prev, number: suggested }));
  }, [isNew, contracts]);

  useEffect(() => {
    if (!contract || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial após navegação para aba
    setNotesLoading(true);
    noteUC.get.execute(currentTenant.id, contract.id)
      .then(setNotes)
      .finally(() => setNotesLoading(false));
  }, [contract, currentTenant, noteUC]);

  useEffect(() => {
    if (!contract || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial após navegação para aba
    setDocsLoading(true);
    docUC.get.execute(currentTenant.id, contract.id)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [contract, currentTenant, docUC]);

  const setFormData = useCallback((data: Partial<ContractFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const personOptions = useMemo<MultiSearchSelectOption[]>(() =>
    persons.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
  );

  const personSearchOptions = useMemo<SearchSelectOption[]>(() =>
    persons.map((p) => ({ value: p.id, label: p.name })).sort((a, b) => a.label.localeCompare(b.label)),
    [persons],
  );

  const [caseToAdd, setCaseToAdd] = useState('');

  const linkedCases = useMemo(
    () => (contract ? cases.filter((c) => c.contractId === contract.id) : []),
    [cases, contract],
  );

  const unlinkedCaseOptions = useMemo<SearchSelectOption[]>(
    () => cases.filter((c) => !c.contractId).map((c) => ({ value: c.id, label: `${c.caseNumber} — ${c.title}` })),
    [cases],
  );

  const handleLinkCase = useCallback(async (caseId: string) => {
    if (!contract) return;
    try {
      await updateCase(caseId, { contractId: contract.id, contractNumber: contract.number });
      notify('Processo vinculado ao contrato.', 'success');
    } catch {
      notify('Erro ao vincular processo.', 'error');
    } finally {
      setCaseToAdd('');
    }
  }, [contract, updateCase, notify]);

  const handleOpenCase = useCallback((c: Case) => {
    openTab(`view-case:${c.id}`);
  }, [openTab]);

  const getCaseStatusColor = useCallback((status: string): string => {
    return getConfigColor(caseStatusConfigs, status, theme);
  }, [caseStatusConfigs, theme]);

  const handleUnlinkCase = useCallback(async (c: Case) => {
    try {
      await updateCase(c.id, { contractId: null, contractNumber: null });
      notify('Processo desvinculado do contrato.', 'success');
    } catch {
      notify('Erro ao desvincular processo.', 'error');
    }
  }, [updateCase, notify]);

  const handleSave = useCallback(async () => {
    if (!formData.number.trim()) { notify('Número do contrato é obrigatório.', 'error'); return; }
    if (!formData.title.trim()) { notify('Título é obrigatório.', 'error'); return; }
    if (!formData.type) { notify('Tipo de contrato é obrigatório.', 'error'); return; }
    if (!formData.category) { notify('Categoria é obrigatória.', 'error'); return; }
    if (!formData.status) { notify('Status é obrigatório.', 'error'); return; }
    if (!currentTenant) return;

    setIsSaving(true);
    try {
      const payload = {
        number: formData.number.trim(),
        title: formData.title.trim(),
        type: formData.type,
        category: formData.category,
        status: formData.status,
        object: formData.object || null,
        contractorIds: formData.contractorIds,
        contracteeIds: formData.contracteeIds,
        witnessIds: formData.witnessIds,
        contractorLawyerIds: formData.contractorLawyerIds,
        contracteeLawyerIds: formData.contracteeLawyerIds,
        clientId: formData.clientId || null,
        responsibleId: formData.responsibleId || null,
        draftedAt: formData.draftedAt ? new Date(formData.draftedAt) : null,
        signedAt: formData.signedAt ? new Date(formData.signedAt) : null,
        effectiveStart: formData.effectiveStart ? new Date(formData.effectiveStart) : null,
        effectiveEnd: formData.effectiveEnd ? new Date(formData.effectiveEnd) : null,
        autoRenewal: formData.autoRenewal,
        renewalDate: formData.renewalDate ? new Date(formData.renewalDate) : null,
        terminationDate: formData.terminationDate ? new Date(formData.terminationDate) : null,
        initialValue: formData.initialValue,
        monthlyValue: formData.monthlyValue,
        totalValue: formData.totalValue,
        adjustmentIndex: formData.adjustmentIndex || null,
        adjustmentPeriodicity: formData.adjustmentPeriodicity || null,
        currency: formData.currency || null,
        paymentMethod: formData.paymentMethod || null,
        dueDay: formData.dueDay ? Number(formData.dueDay) : null,
        installments: formData.installments ? Number(formData.installments) : null,
        bank: formData.bank || null,
        bankAccount: formData.bankAccount || null,
        pixKey: formData.pixKey || null,
        costCenter: formData.costCenter || null,
      };

      if (isNew) {
        const created = await createContract({ ...payload, createdBy: user?.id ?? '', tagIds: [] });
        notify('Contrato cadastrado com sucesso!', 'success');
        const newTabKey = `view-contract:${created.id}`;
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.title);
      } else if (contract) {
        await updateContract(contract.id, {
          ...payload,
          updatedBy: user?.id ?? '',
          updatedByName: effectiveName,
          updatedByPhotoURL: user?.photoURL ?? '',
        });
        notify('Contrato atualizado com sucesso!', 'success');
      }
    } catch (err) {
      console.error('[ViewContract handleSave]', err);
      notify('Erro ao salvar contrato.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isNew, contract, createContract, updateContract, currentTenant, notify, user, effectiveName, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForContract(entityId, contract?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForContract(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, contract, getTagsForContract, setTagsForContract, createTag, updateTag, deleteTag]);

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
    if (!newNoteTitle.trim() || !newNoteText.trim() || !contract || !currentTenant || !user) return;
    setIsAddingNote(true);
    try {
      const note = await noteUC.add.execute(currentTenant.id, contract.id, {
        title: newNoteTitle.trim(),
        text: newNoteText.trim(),
        createdBy: user.id,
        createdByName: effectiveName,
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
  }, [newNoteTitle, newNoteText, contract, currentTenant, user, effectiveName, noteUC, notify]);

  const requestDeleteNote = useCallback((note: ContractNote) => setNoteToDelete(note), []);
  const cancelDeleteNote = useCallback(() => setNoteToDelete(null), []);
  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete || !contract || !currentTenant) return;
    try {
      await noteUC.delete.execute(currentTenant.id, contract.id, noteToDelete.id);
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      notify('Anotação excluída.', 'success');
    } catch {
      notify('Erro ao excluir anotação.', 'error');
    } finally {
      setNoteToDelete(null);
    }
  }, [noteToDelete, contract, currentTenant, noteUC, notify]);

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
    if (!pendingFile || !contract || !currentTenant || !user) return;
    setIsUploadingDoc(true);
    try {
      const raw = await docUC.upload.execute(currentTenant.id, contract.id, pendingFile);
      const { url, storagePath } = JSON.parse(raw) as { url: string; storagePath: string };
      const addedDoc = await docUC.add.execute(currentTenant.id, contract.id, {
        name: pendingFile.name,
        type: pendingType.trim() || undefined,
        url,
        storagePath,
        createdBy: user.id,
        createdByName: effectiveName,
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
  }, [pendingFile, pendingType, contract, currentTenant, user, effectiveName, docUC, notify]);

  const requestDeleteDoc = useCallback((doc: ContractDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !contract || !currentTenant) return;
    try {
      await docUC.delete.execute(currentTenant.id, contract.id, docToDelete.id, docToDelete.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, contract, currentTenant, docUC, notify]);

  const handleCopyDeepLink = useCallback(() => {
    if (!contract) return;
    void navigator.clipboard.writeText(generateDeepLink(`view-contract:${contract.id}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [contract]);

  const handleClone = useCallback(() => {
    if (!contract) return;
    openTab(`${CLONE_PREFIX}${contract.id}`);
  }, [contract, openTab]);

  const statusColor = useMemo(() => {
    if (!formData.status) return theme.colors.textSecondary;
    return getConfigColor(statusConfigs, formData.status, theme);
  }, [formData.status, statusConfigs, theme]);

  const handleDeleteContract = useCallback(() => {
    if (contract) setContractToDelete(contract);
  }, [contract]);

  const confirmDeleteContract = useCallback(async () => {
    if (!contractToDelete) return;
    try {
      await deleteContract(contractToDelete.id);
      notify('Contrato excluído.', 'success');
      closeTab(tabKey, activePanelId);
    } catch {
      notify('Erro ao excluir contrato.', 'error');
    } finally {
      setContractToDelete(null);
    }
  }, [contractToDelete, deleteContract, notify, closeTab, tabKey, activePanelId]);

  const cancelDeleteContract = useCallback(() => setContractToDelete(null), []);

  const typeOptions = useMemo<DynamicSelectOption[]>(
    () => typeConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );
  const typeDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => typeConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [typeConfigs],
  );

  const categoryOptions = useMemo<DynamicSelectOption[]>(
    () => categoryConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );
  const categoryDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => categoryConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [categoryConfigs],
  );

  const statusOptions = useMemo<DynamicSelectOption[]>(
    () => statusConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [statusConfigs, theme],
  );
  const statusDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => statusConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label, color: resolveColor(c.color, theme) })),
    [statusConfigs, theme],
  );

  const objectOptions = useMemo<DynamicSelectOption[]>(
    () => objectConfigs.map(c => ({ value: c.key, label: c.label })),
    [objectConfigs],
  );

  const adjustmentIndexOptions = useMemo<DynamicSelectOption[]>(
    () => adjustmentIndexConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [adjustmentIndexConfigs],
  );
  const adjustmentIndexDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => adjustmentIndexConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [adjustmentIndexConfigs],
  );

  const adjustmentPeriodicityOptions = useMemo<DynamicSelectOption[]>(
    () => adjustmentPeriodicityConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [adjustmentPeriodicityConfigs],
  );
  const adjustmentPeriodicityDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => adjustmentPeriodicityConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [adjustmentPeriodicityConfigs],
  );

  const currencyOptions = useMemo<DynamicSelectOption[]>(
    () => currencyConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [currencyConfigs],
  );
  const currencyDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => currencyConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [currencyConfigs],
  );

  const paymentMethodOptions = useMemo<DynamicSelectOption[]>(
    () => paymentMethodConfigs.filter(c => c.isStatic !== false).map(c => ({ value: c.key, label: c.label })),
    [paymentMethodConfigs],
  );
  const paymentMethodDynamicOptions = useMemo<DynamicSelectOption[]>(
    () => paymentMethodConfigs.filter(c => c.isStatic === false).map(c => ({ value: c.key, label: c.label })),
    [paymentMethodConfigs],
  );

  const bankOptions = useMemo<DynamicSelectOption[]>(
    () => bankConfigs.map(c => ({ value: c.key, label: c.label })),
    [bankConfigs],
  );

  const costCenterOptions = useMemo<DynamicSelectOption[]>(
    () => costCenterConfigs.map(c => ({ value: c.key, label: c.label })),
    [costCenterConfigs],
  );

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter(t => t.isStatic !== false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    documentTypeConfigs.filter(t => t.isStatic === false).map((t) => ({ value: t.key, label: t.label })),
    [documentTypeConfigs],
  );

  const handleAddType = useCallback(async (name: string) => { await addItem('types', name); }, [addItem]);
  const handleDeleteType = useCallback(async (key: string) => { await removeItem('types', key); }, [removeItem]);
  const handleAddCategory = useCallback(async (name: string) => { await addItem('categories', name); }, [addItem]);
  const handleDeleteCategory = useCallback(async (key: string) => { await removeItem('categories', key); }, [removeItem]);
  const handleAddStatus = useCallback(async (name: string) => { await addItem('statuses', name); }, [addItem]);
  const handleDeleteStatus = useCallback(async (key: string) => { await removeItem('statuses', key); }, [removeItem]);
  const handleAddObject = useCallback(async (name: string) => { await addItem('objects', name); }, [addItem]);
  const handleDeleteObject = useCallback(async (key: string) => { await removeItem('objects', key); }, [removeItem]);
  const handleAddAdjustmentIndex = useCallback(async (name: string) => { await addItem('adjustmentIndexes', name); }, [addItem]);
  const handleDeleteAdjustmentIndex = useCallback(async (key: string) => { await removeItem('adjustmentIndexes', key); }, [removeItem]);
  const handleAddAdjustmentPeriodicity = useCallback(async (name: string) => { await addItem('adjustmentPeriodicities', name); }, [addItem]);
  const handleDeleteAdjustmentPeriodicity = useCallback(async (key: string) => { await removeItem('adjustmentPeriodicities', key); }, [removeItem]);
  const handleAddCurrency = useCallback(async (name: string) => { await addItem('currencies', name); }, [addItem]);
  const handleDeleteCurrency = useCallback(async (key: string) => { await removeItem('currencies', key); }, [removeItem]);
  const handleAddPaymentMethod = useCallback(async (name: string) => { await addItem('paymentMethods', name); }, [addItem]);
  const handleDeletePaymentMethod = useCallback(async (key: string) => { await removeItem('paymentMethods', key); }, [removeItem]);
  const handleAddBank = useCallback(async (name: string) => { await addItem('banks', name); }, [addItem]);
  const handleDeleteBank = useCallback(async (key: string) => { await removeItem('banks', key); }, [removeItem]);
  const handleAddCostCenter = useCallback(async (name: string) => { await addItem('costCenters', name); }, [addItem]);
  const handleDeleteCostCenter = useCallback(async (key: string) => { await removeItem('costCenters', key); }, [removeItem]);

  const handleAddDocumentType = useCallback(async (name: string) => { await addDocumentType(name); }, [addDocumentType]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeDocumentType(key); }, [removeDocumentType]);

  return {
    isNew,
    contract,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    isSaving,
    handleSave,
    personOptions,
    personSearchOptions,
    linkedCases,
    unlinkedCaseOptions,
    caseToAdd,
    setCaseToAdd,
    handleLinkCase,
    handleOpenCase,
    handleUnlinkCase,
    getCaseStatusColor,
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
    handleClone,
    statusColor,
    handleDeleteContract,
    contractToDelete,
    confirmDeleteContract,
    cancelDeleteContract,
    typeOptions,
    typeDynamicOptions,
    categoryOptions,
    categoryDynamicOptions,
    statusOptions,
    statusDynamicOptions,
    objectOptions,
    adjustmentIndexOptions,
    adjustmentIndexDynamicOptions,
    adjustmentPeriodicityOptions,
    adjustmentPeriodicityDynamicOptions,
    currencyOptions,
    currencyDynamicOptions,
    paymentMethodOptions,
    paymentMethodDynamicOptions,
    bankOptions,
    costCenterOptions,
    handleAddType,
    handleDeleteType,
    handleAddCategory,
    handleDeleteCategory,
    handleAddStatus,
    handleDeleteStatus,
    handleAddObject,
    handleDeleteObject,
    handleAddAdjustmentIndex,
    handleDeleteAdjustmentIndex,
    handleAddAdjustmentPeriodicity,
    handleDeleteAdjustmentPeriodicity,
    handleAddCurrency,
    handleDeleteCurrency,
    handleAddPaymentMethod,
    handleDeletePaymentMethod,
    handleAddBank,
    handleDeleteBank,
    handleAddCostCenter,
    handleDeleteCostCenter,
  };
};
