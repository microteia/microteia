import { useState, useMemo, useCallback, useEffect } from 'react';
import { useTheme } from 'styled-components';
import { useCaseStore } from '../../../stores/useCaseStore';
import { useCaseTagStore } from '../../../stores/useCaseTagStore';
import { useContractStore } from '../../../stores/useContractStore';
import { useCaseLookup } from '../../../stores/useCaseLookup';
import { useDocumentTypeLookup } from '../../../stores/useDocumentTypeLookup';
import { usePersonStore } from '../../../stores/usePersonStore';
import { useAuth } from '../../../stores/useAuth';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { resolveColor, getConfigColor } from '../../../shared/styles/colorUtils';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import { makeGetCaseNotesUseCase } from '../../../domain/usecases/casenotes/GetCaseNotesUseCase';
import { makeAddCaseNoteUseCase } from '../../../domain/usecases/casenotes/AddCaseNoteUseCase';
import { makeDeleteCaseNoteUseCase } from '../../../domain/usecases/casenotes/DeleteCaseNoteUseCase';
import { makeGetCaseDocumentsUseCase } from '../../../domain/usecases/casedocuments/GetCaseDocumentsUseCase';
import { makeUploadCaseDocumentUseCase } from '../../../domain/usecases/casedocuments/UploadCaseDocumentUseCase';
import { makeAddCaseDocumentUseCase } from '../../../domain/usecases/casedocuments/AddCaseDocumentUseCase';
import { makeDeleteCaseDocumentUseCase } from '../../../domain/usecases/casedocuments/DeleteCaseDocumentUseCase';
import type { Case, CaseNote, CaseDocument, CaseStatus, CaseArea, CasePhase, CaseInstance } from '../../../domain/entities';
import type { TagStoreAdapter } from '../../components/ui/TagManager/TagManager.viewmodel';
import type { DynamicSelectOption } from '../../components/ui/DynamicSelect';

export type ViewCaseTab = 'data' | 'notes' | 'documents';

export interface CaseFormData {
  caseNumber: string;
  title: string;
  activePoleIds: string[];
  passivePoleIds: string[];
  area: string;
  type: string[];
  court: string;
  courtDistrict: string;
  judge: string;
  instance: string;
  phase: string;
  status: string;
  responsibleLawyerId: string;
  responsibleLawyerName: string;
  contractId: string;
  contractNumber: string;
  notes: string;
  causeValue: string;
  filedAt: string;
}

const buildFormData = (c: Case | null, userId: string, displayName: string): CaseFormData => ({
  caseNumber: c?.caseNumber ?? '',
  title: c?.title ?? '',
  activePoleIds: c?.activePoleIds ?? [],
  passivePoleIds: c?.passivePoleIds ?? [],
  area: c?.area ?? 'Cível',
  type: c?.type ?? [],
  court: c?.court ?? '',
  courtDistrict: c?.courtDistrict ?? '',
  judge: c?.judge ?? '',
  instance: c?.instance ?? '1º Grau',
  phase: c?.phase ?? 'Fase Inicial',
  status: c?.status ?? 'Em Andamento',
  responsibleLawyerId: c?.responsibleLawyerId ?? userId,
  responsibleLawyerName: c?.responsibleLawyerName ?? displayName,
  contractId: c?.contractId ?? '',
  contractNumber: c?.contractNumber ?? '',
  notes: c?.notes ?? '',
  causeValue: c?.causeValue?.toString() ?? '',
  filedAt: c?.filedAt ? c.filedAt.toISOString().slice(0, 10) : '',
});

export interface ViewCaseViewModel {
  isNew: boolean;
  case_: Case | null;
  activeTab: ViewCaseTab;
  setActiveTab: (tab: ViewCaseTab) => void;
  formData: CaseFormData;
  setFormData: (data: Partial<CaseFormData>) => void;
  isSaving: boolean;
  handleSave: () => Promise<void>;

  tagAdapter: TagStoreAdapter;
  isTagManagerOpen: boolean;
  openTagManager: () => void;
  closeTagManager: () => void;
  appliedTags: { id: string; name: string; color: string }[];

  personOptions: { value: string; label: string }[];
  memberOptions: { value: string; label: string }[];
  contractOptions: { value: string; label: string }[];

  notes: CaseNote[];
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
  noteToDelete: CaseNote | null;
  requestDeleteNote: (note: CaseNote) => void;
  confirmDeleteNote: () => Promise<void>;
  cancelDeleteNote: () => void;

  documents: CaseDocument[];
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
  docToDelete: CaseDocument | null;
  requestDeleteDoc: (doc: CaseDocument) => void;
  confirmDeleteDoc: () => Promise<void>;
  cancelDeleteDoc: () => void;

  isAdmin: boolean;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleDeleteCase: () => void;
  caseToDelete: Case | null;
  confirmDeleteCase: () => Promise<void>;
  cancelDeleteCase: () => void;

  areaOptions: DynamicSelectOption[];
  areaDynamicOptions: DynamicSelectOption[];
  phaseOptions: DynamicSelectOption[];
  phaseDynamicOptions: DynamicSelectOption[];
  statusOptions: DynamicSelectOption[];
  statusDynamicOptions: DynamicSelectOption[];
  instanceOptions: DynamicSelectOption[];
  instanceDynamicOptions: DynamicSelectOption[];
  actionTypeOptions: DynamicSelectOption[];
  courtOptions: DynamicSelectOption[];
  districtOptions: DynamicSelectOption[];
  judgeOptions: DynamicSelectOption[];

  handleAddArea: (name: string) => Promise<void>;
  handleDeleteArea: (name: string) => Promise<void>;
  handleAddPhase: (name: string) => Promise<void>;
  handleDeletePhase: (name: string) => Promise<void>;
  handleAddStatus: (name: string) => Promise<void>;
  handleDeleteStatus: (name: string) => Promise<void>;
  handleAddInstance: (name: string) => Promise<void>;
  handleDeleteInstance: (name: string) => Promise<void>;
  handleAddActionType: (name: string) => Promise<void>;
  handleDeleteActionType: (name: string) => Promise<void>;
  handleAddCourt: (name: string) => Promise<void>;
  handleDeleteCourt: (name: string) => Promise<void>;
  handleAddDistrict: (name: string) => Promise<void>;
  handleDeleteDistrict: (name: string) => Promise<void>;
  handleAddJudge: (name: string) => Promise<void>;
  handleDeleteJudge: (name: string) => Promise<void>;

  getStatusColor: (status: string) => string;
}

export const useViewCaseViewModel = (tabKey: string): ViewCaseViewModel => {
  const isNew = tabKey === 'new-case';
  const caseId = isNew ? '' : tabKey.replace('view-case:', '');

  const { cases, createCase, updateCase, deleteCase } = useCaseStore();
  const { tags, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag } = useCaseTagStore();
  const { areaConfigs, phaseConfigs, statusConfigs, instanceConfigs, actionTypeConfigs, courtConfigs, districtConfigs, judgeConfigs, addItem, removeItem } = useCaseLookup();
  const { typeConfigs, addItem: addDocumentType, removeItem: removeDocumentType } = useDocumentTypeLookup();
  const { persons } = usePersonStore();
  const { contracts } = useContractStore();
  const { user, effectiveName } = useAuth();
  const { tenantRole, currentTenant, members } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { caseNoteRepository, caseDocumentRepository } = useDI();
  const theme = useTheme();

  const case_ = useMemo(
    () => (isNew ? null : (cases.find((c) => c.id === caseId) ?? null)),
    [cases, caseId, isNew],
  );

  const isAdmin = tenantRole === 'admin';

  const [activeTab, setActiveTab] = useState<ViewCaseTab>('data');
  const [formData, setFormDataState] = useState<CaseFormData>(() => buildFormData(case_, user?.id ?? '', effectiveName));
  const [isSaving, setIsSaving] = useState(false);
  const [isTagManagerOpen, setIsTagManagerOpen] = useState(false);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [caseToDelete, setCaseToDelete] = useState<Case | null>(null);

  const [notes, setNotes] = useState<CaseNote[]>([]);
  const [notesLoading, setNotesLoading] = useState(false);
  const [newNoteTitle, setNewNoteTitle] = useState('');
  const [newNoteText, setNewNoteText] = useState('');
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [noteToDelete, setNoteToDelete] = useState<CaseNote | null>(null);
  const [isNoteEditorOpen, setIsNoteEditorOpen] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<Set<string>>(new Set());

  const [documents, setDocuments] = useState<CaseDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [isUploadingDoc, setIsUploadingDoc] = useState(false);
  const [docToDelete, setDocToDelete] = useState<CaseDocument | null>(null);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [pendingType, setPendingType] = useState('');

  const noteUC = useMemo(() => ({
    get:    makeGetCaseNotesUseCase(caseNoteRepository),
    add:    makeAddCaseNoteUseCase(caseNoteRepository),
    delete: makeDeleteCaseNoteUseCase(caseNoteRepository),
  }), [caseNoteRepository]);

  const docUC = useMemo(() => ({
    get:    makeGetCaseDocumentsUseCase(caseDocumentRepository),
    upload: makeUploadCaseDocumentUseCase(caseDocumentRepository),
    add:    makeAddCaseDocumentUseCase(caseDocumentRepository),
    delete: makeDeleteCaseDocumentUseCase(caseDocumentRepository),
  }), [caseDocumentRepository]);

  const personOptions = useMemo(() =>
    persons.map((c) => ({ value: c.id, label: c.name })),
    [persons],
  );

  const memberOptions = useMemo(() =>
    members.map((m) => ({ value: m.userId, label: m.displayName })),
    [members],
  );

  const contractOptions = useMemo(() =>
    contracts.map((c) => ({ value: c.id, label: `${c.number} — ${c.title}` })),
    [contracts],
  );

  useEffect(() => {
    if (case_) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário ao carregar/atualizar dados do processo
      setFormDataState(buildFormData(case_, user?.id ?? '', effectiveName));
      setTabTitle(tabKey, case_.caseNumber ?? case_.title);
    }
  }, [case_, tabKey, setTabTitle, user, effectiveName]);

  useEffect(() => {
    if (!case_ || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de anotações
    setNotesLoading(true);
    noteUC.get.execute(currentTenant.id, case_.id)
      .then(setNotes)
      .finally(() => setNotesLoading(false));
  }, [case_, currentTenant, noteUC]);

  useEffect(() => {
    if (!case_ || !currentTenant) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carregamento inicial de documentos
    setDocsLoading(true);
    docUC.get.execute(currentTenant.id, case_.id)
      .then(setDocuments)
      .finally(() => setDocsLoading(false));
  }, [case_, currentTenant, docUC]);

  const setFormData = useCallback((data: Partial<CaseFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const handleSave = useCallback(async () => {
    if (!formData.title.trim()) { notify('Título é obrigatório.', 'error'); return; }
    if (!formData.caseNumber.trim()) { notify('Número do processo é obrigatório.', 'error'); return; }
    if (!currentTenant) return;

    const selectedMember = members.find((m) => m.userId === formData.responsibleLawyerId);
    const selectedContract = contracts.find((c) => c.id === formData.contractId);

    setIsSaving(true);
    try {
      const payload = {
        caseNumber: formData.caseNumber.trim(),
        title: formData.title.trim(),
        area: formData.area as CaseArea,
        type: formData.type.length > 0 ? formData.type : undefined,
        court: formData.court || null,
        courtDistrict: formData.courtDistrict || null,
        judge: formData.judge || null,
        instance: formData.instance as CaseInstance,
        phase: formData.phase as CasePhase,
        status: formData.status as CaseStatus,
        responsibleLawyerId: formData.responsibleLawyerId || (user?.id ?? ''),
        responsibleLawyerName: (selectedMember?.displayName ?? formData.responsibleLawyerName) || effectiveName,
        contractId: formData.contractId || null,
        contractNumber: formData.contractId ? (selectedContract?.number ?? formData.contractNumber) : null,
        activePoleIds: formData.activePoleIds,
        passivePoleIds: formData.passivePoleIds,
        opposingParties: case_?.opposingParties ?? [],
        filedAt: formData.filedAt ? new Date(formData.filedAt) : null,
        causeValue: formData.causeValue ? parseFloat(formData.causeValue) : null,
        notes: formData.notes || null,
        tags: case_?.tags ?? [],
        tagIds: case_?.tagIds ?? [],
      };

      if (isNew) {
        const created = await createCase({ ...payload, createdBy: user?.id ?? '' });
        notify('Processo cadastrado com sucesso!', 'success');
        // Transição automática para modo de edição
        const newTabKey = `view-case:${created.id}`;
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(newTabKey);
        setTabTitle(newTabKey, created.caseNumber ?? created.title);
      } else if (case_) {
        await updateCase(case_.id, {
          ...payload,
          updatedBy: user?.id ?? '',
          updatedByName: effectiveName,
          updatedByPhotoURL: user?.photoURL ?? '',
        });
        notify('Processo atualizado com sucesso!', 'success');
      }
    } catch {
      notify('Erro ao salvar processo.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [formData, isNew, case_, members, contracts, createCase, updateCase, currentTenant, notify, user, effectiveName, tabKey, setTabTitle, closeTab, openTab, activePanelId]);

  const appliedTags = useMemo(
    () => (case_ ? getTagsForCase(case_.id, case_.tagIds ?? []) : []),
    [case_, getTagsForCase],
  );

  const tagAdapter: TagStoreAdapter = useMemo(() => ({
    tags,
    getAppliedTags: (entityId: string) => getTagsForCase(entityId, case_?.tagIds ?? []),
    setTags: (entityId: string, tagIds: string[]) => setTagsForCase(entityId, tagIds),
    createTag: (name: string, color: string) => createTag(name, color),
    updateTag: (id: string, data: { name: string; color: string }) => updateTag(id, data),
    deleteTag: (id: string) => deleteTag(id),
  }), [tags, case_, getTagsForCase, setTagsForCase, createTag, updateTag, deleteTag]);

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
    if (!newNoteTitle.trim() || !newNoteText.trim() || !case_ || !currentTenant || !user) return;
    setIsAddingNote(true);
    try {
      const note = await noteUC.add.execute(currentTenant.id, case_.id, {
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
  }, [newNoteTitle, newNoteText, case_, currentTenant, user, effectiveName, noteUC, notify]);

  const requestDeleteNote = useCallback((note: CaseNote) => setNoteToDelete(note), []);
  const cancelDeleteNote = useCallback(() => setNoteToDelete(null), []);
  const confirmDeleteNote = useCallback(async () => {
    if (!noteToDelete || !case_ || !currentTenant) return;
    try {
      await noteUC.delete.execute(currentTenant.id, case_.id, noteToDelete.id);
      setNotes((prev) => prev.filter((n) => n.id !== noteToDelete.id));
      notify('Anotação excluída.', 'success');
    } catch {
      notify('Erro ao excluir anotação.', 'error');
    } finally {
      setNoteToDelete(null);
    }
  }, [noteToDelete, case_, currentTenant, noteUC, notify]);

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
    if (!pendingFile || !case_ || !currentTenant || !user) return;
    setIsUploadingDoc(true);
    try {
      const raw = await docUC.upload.execute(currentTenant.id, case_.id, pendingFile);
      const { url, storagePath } = JSON.parse(raw) as { url: string; storagePath: string };
      const addedDoc = await docUC.add.execute(currentTenant.id, case_.id, {
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
  }, [pendingFile, pendingType, case_, currentTenant, user, effectiveName, docUC, notify]);

  const requestDeleteDoc = useCallback((doc: CaseDocument) => setDocToDelete(doc), []);
  const cancelDeleteDoc = useCallback(() => setDocToDelete(null), []);
  const confirmDeleteDoc = useCallback(async () => {
    if (!docToDelete || !case_ || !currentTenant) return;
    try {
      await docUC.delete.execute(currentTenant.id, case_.id, docToDelete.id, docToDelete.storagePath);
      setDocuments((prev) => prev.filter((d) => d.id !== docToDelete.id));
      notify('Documento excluído.', 'success');
    } catch {
      notify('Erro ao excluir documento.', 'error');
    } finally {
      setDocToDelete(null);
    }
  }, [docToDelete, case_, currentTenant, docUC, notify]);

  const handleCopyDeepLink = useCallback(() => {
    if (!case_) return;
    void navigator.clipboard.writeText(generateDeepLink(`view-case:${case_.id}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [case_]);

  const handleDeleteCase = useCallback(() => {
    if (case_) setCaseToDelete(case_);
  }, [case_]);

  const confirmDeleteCase = useCallback(async () => {
    if (!caseToDelete) return;
    try {
      await deleteCase(caseToDelete.id);
      notify('Processo excluído.', 'success');
      closeTab(tabKey, activePanelId);
    } catch {
      notify('Erro ao excluir processo.', 'error');
    } finally {
      setCaseToDelete(null);
    }
  }, [caseToDelete, deleteCase, notify, closeTab, tabKey, activePanelId]);

  const cancelDeleteCase = useCallback(() => setCaseToDelete(null), []);

  const getStatusColor = useCallback((status: string): string => {
    return getConfigColor(statusConfigs, status, theme);
  }, [statusConfigs, theme]);

  const areaOptions = useMemo<DynamicSelectOption[]>(() =>
    areaConfigs.filter(a => a.isStatic !== false).map((a) => ({ value: a.key, label: a.label })),
    [areaConfigs],
  );
  const areaDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    areaConfigs.filter(a => a.isStatic === false).map((a) => ({ value: a.key, label: a.label })),
    [areaConfigs],
  );

  const phaseOptions = useMemo<DynamicSelectOption[]>(() =>
    phaseConfigs.filter(p => p.isStatic !== false).map((p) => ({ value: p.key, label: p.label, color: resolveColor(p.color, theme) })),
    [phaseConfigs, theme],
  );
  const phaseDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    phaseConfigs.filter(p => p.isStatic === false).map((p) => ({ value: p.key, label: p.label, color: resolveColor(p.color, theme) })),
    [phaseConfigs, theme],
  );

  const statusOptions = useMemo<DynamicSelectOption[]>(() =>
    statusConfigs.filter(s => s.isStatic !== false).map((s) => ({ value: s.key, label: s.label, color: resolveColor(s.color, theme) })),
    [statusConfigs, theme],
  );
  const statusDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    statusConfigs.filter(s => s.isStatic === false).map((s) => ({ value: s.key, label: s.label, color: resolveColor(s.color, theme) })),
    [statusConfigs, theme],
  );

  const instanceOptions = useMemo<DynamicSelectOption[]>(() =>
    instanceConfigs.filter(i => i.isStatic !== false).map((i) => ({ value: i.key, label: i.label, color: i.color })),
    [instanceConfigs],
  );
  const instanceDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    instanceConfigs.filter(i => i.isStatic === false).map((i) => ({ value: i.key, label: i.label, color: i.color })),
    [instanceConfigs],
  );

  const actionTypeOptions = useMemo<DynamicSelectOption[]>(() =>
    actionTypeConfigs.map(a => ({ value: a.key, label: a.label })),
    [actionTypeConfigs],
  );

  const courtOptions = useMemo<DynamicSelectOption[]>(() =>
    courtConfigs.map(c => ({ value: c.key, label: c.label })),
    [courtConfigs],
  );

  const districtOptions = useMemo<DynamicSelectOption[]>(() =>
    districtConfigs.map(d => ({ value: d.key, label: d.label })),
    [districtConfigs],
  );

  const judgeOptions = useMemo<DynamicSelectOption[]>(() =>
    judgeConfigs.map(j => ({ value: j.key, label: j.label })),
    [judgeConfigs],
  );

  const documentTypeOptions = useMemo<DynamicSelectOption[]>(() =>
    typeConfigs.filter(t => t.isStatic !== false).map((t) => ({ value: t.key, label: t.label })),
    [typeConfigs],
  );
  const documentTypeDynamicOptions = useMemo<DynamicSelectOption[]>(() =>
    typeConfigs.filter(t => t.isStatic === false).map((t) => ({ value: t.key, label: t.label })),
    [typeConfigs],
  );

  const handleAddArea = useCallback(async (name: string) => { await addItem('areas', name); }, [addItem]);
  const handleDeleteArea = useCallback(async (key: string) => { await removeItem('areas', key); }, [removeItem]);

  const handleAddPhase = useCallback(async (name: string) => { await addItem('phases', name); }, [addItem]);
  const handleDeletePhase = useCallback(async (key: string) => { await removeItem('phases', key); }, [removeItem]);

  const handleAddStatus = useCallback(async (name: string) => { await addItem('statuses', name); }, [addItem]);
  const handleDeleteStatus = useCallback(async (key: string) => { await removeItem('statuses', key); }, [removeItem]);

  const handleAddInstance = useCallback(async (name: string) => { await addItem('instances', name); }, [addItem]);
  const handleDeleteInstance = useCallback(async (key: string) => { await removeItem('instances', key); }, [removeItem]);

  const handleAddActionType = useCallback(async (name: string) => { await addItem('actionTypes', name); }, [addItem]);
  const handleDeleteActionType = useCallback(async (key: string) => { await removeItem('actionTypes', key); }, [removeItem]);

  const handleAddCourt = useCallback(async (name: string) => { await addItem('courts', name); }, [addItem]);
  const handleDeleteCourt = useCallback(async (key: string) => { await removeItem('courts', key); }, [removeItem]);

  const handleAddDistrict = useCallback(async (name: string) => { await addItem('districts', name); }, [addItem]);
  const handleDeleteDistrict = useCallback(async (key: string) => { await removeItem('districts', key); }, [removeItem]);

  const handleAddJudge = useCallback(async (name: string) => { await addItem('judges', name); }, [addItem]);
  const handleDeleteJudge = useCallback(async (key: string) => { await removeItem('judges', key); }, [removeItem]);

  const handleAddDocumentType = useCallback(async (name: string) => { await addDocumentType(name); }, [addDocumentType]);
  const handleDeleteDocumentType = useCallback(async (key: string) => { await removeDocumentType(key); }, [removeDocumentType]);

  return {
    isNew,
    case_,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    isSaving,
    handleSave,
    tagAdapter,
    isTagManagerOpen,
    openTagManager,
    closeTagManager,
    appliedTags,
    personOptions,
    memberOptions,
    contractOptions,
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
    isAdmin,
    copyLinkDone,
    handleCopyDeepLink,
    handleDeleteCase,
    caseToDelete,
    confirmDeleteCase,
    cancelDeleteCase,
    areaOptions,
    areaDynamicOptions,
    phaseOptions,
    phaseDynamicOptions,
    statusOptions,
    statusDynamicOptions,
    instanceOptions,
    instanceDynamicOptions,
    actionTypeOptions,
    courtOptions,
    districtOptions,
    judgeOptions,
    handleAddArea,
    handleDeleteArea,
    handleAddPhase,
    handleDeletePhase,
    handleAddStatus,
    handleDeleteStatus,
    handleAddInstance,
    handleDeleteInstance,
    handleAddActionType,
    handleDeleteActionType,
    handleAddCourt,
    handleDeleteCourt,
    handleAddDistrict,
    handleDeleteDistrict,
    handleAddJudge,
    handleDeleteJudge,
    getStatusColor,
  };
};
