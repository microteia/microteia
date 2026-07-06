import { useState, useMemo, useCallback, useEffect } from 'react';
import type { IconType } from 'react-icons';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import { syncWorkflowStepCatalog } from '../../../data/services/syncWorkflowStepCatalog';
import { WORKFLOW_EVENT_CATALOG, getWorkflowEventFields } from '../../../domain/services/workflowEventCatalog';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import { WORKFLOW_LOOKUP_COLLECTIONS } from '../../../domain/services/workflowLookupCatalog';
import { getWorkflowEventIcon, getWorkflowLookupGroupIcon } from '../../shared/workflowEventIcons';
import { getScreenIconType } from '../../shared/screenIcons';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import type { WorkflowDefinition, WorkflowExecution, WorkflowStep } from '../../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../../domain/entities/WorkflowStepCatalog';

export type ViewWorkflowTab = 'general' | 'conditions' | 'steps' | 'executions';

const isCustomRecordEventName = (eventName: string): boolean => eventName.startsWith('custom_record.');
const isLookupEventName = (eventName: string): boolean => eventName.startsWith('lookup.');

export interface WorkflowFormData {
  name: string;
  description: string;
  eventName: string;
  screenKey: string;
  lookupCollection: string;
}

const buildForm = (w: WorkflowDefinition | null): WorkflowFormData => ({
  name: w?.name ?? '',
  description: w?.description ?? '',
  eventName: w?.eventName ?? '',
  screenKey: w?.screenKey ?? '',
  lookupCollection: w?.lookupCollection ?? '',
});

export const EVENT_NAME_OPTIONS = WORKFLOW_EVENT_CATALOG.map((entry) => ({
  value: entry.name,
  label: entry.label,
  icon: getWorkflowEventIcon(entry.name),
}));

export const LOOKUP_COLLECTION_OPTIONS = WORKFLOW_LOOKUP_COLLECTIONS.map((entry) => ({
  value: entry.collection,
  label: `${entry.screenLabel}:${entry.entityLabel}`,
  icon: getWorkflowLookupGroupIcon(entry.group),
}));

export interface ViewWorkflowViewModel {
  isNew: boolean;
  workflow: WorkflowDefinition | null;
  activeTab: ViewWorkflowTab;
  setActiveTab: (tab: ViewWorkflowTab) => void;
  formData: WorkflowFormData;
  setFormData: (data: Partial<WorkflowFormData>) => void;
  isSaving: boolean;
  handleSaveGeneral: () => Promise<void>;
  toggleEnabled: () => void;
  steps: WorkflowStep[];
  stepCatalog: StepDefinitionSummary[];
  getStepDefinition: (stepDefinitionId: string) => StepDefinitionSummary | undefined;
  isStepModalOpen: boolean;
  editingStep: WorkflowStep | null;
  openAddStep: () => void;
  openEditStep: (step: WorkflowStep) => void;
  closeStepModal: () => void;
  saveStep: (step: WorkflowStep) => Promise<void>;
  stepToDelete: WorkflowStep | null;
  handleDeleteStep: (step: WorkflowStep) => void;
  confirmDeleteStep: () => Promise<void>;
  cancelDeleteStep: () => void;
  moveStep: (step: WorkflowStep, direction: 'up' | 'down') => Promise<void>;
  toggleStepEnabled: (step: WorkflowStep) => Promise<void>;
  executions: WorkflowExecution[];
  executionsError: string | null;
  eventFields: WorkflowEventFieldOption[];
  isEventNameRecognized: boolean;
  isCustomRecordEvent: boolean;
  screenOptions: { value: string; label: string; icon: IconType }[];
  isScreenKeyRecognized: boolean;
  isLookupEvent: boolean;
  isLookupCollectionRecognized: boolean;
  headerIcon: IconType | null;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  handleDeleteWorkflow: () => void;
  workflowToDelete: WorkflowDefinition | null;
  confirmDeleteWorkflow: () => Promise<void>;
  cancelDeleteWorkflow: () => void;
}

const CLONE_PREFIX = 'new-workflow:clone:';

export const useViewWorkflowViewModel = (tabKey: string): ViewWorkflowViewModel => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-workflow' || cloneSourceId !== null;
  const workflowId = isNew ? '' : tabKey.replace('view-workflow:', '');

  const { workflows, createWorkflow, updateWorkflow, updateWorkflowSteps, deleteWorkflow } = useWorkflowStore();
  const { currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { stepCatalogRepository, workflowExecutionRepository } = useDI();
  const { dynamicScreens, getDefinition } = useScreenDefinitions();

  const workflow = useMemo(
    () => (isNew ? null : (workflows.find((w) => w.id === workflowId) ?? null)),
    [isNew, workflows, workflowId],
  );

  const cloneSource = useMemo(
    () => (cloneSourceId ? (workflows.find((w) => w.id === cloneSourceId) ?? null) : null),
    [workflows, cloneSourceId],
  );

  const [activeTab, setActiveTab] = useState<ViewWorkflowTab>('general');
  const [formData, setFormDataState] = useState<WorkflowFormData>(() => buildForm(cloneSource));
  const [isSaving, setIsSaving] = useState(false);
  const [stepCatalog, setStepCatalog] = useState<StepDefinitionSummary[]>([]);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [isStepModalOpen, setIsStepModalOpen] = useState(false);
  const [editingStep, setEditingStep] = useState<WorkflowStep | null>(null);
  const [stepToDelete, setStepToDelete] = useState<WorkflowStep | null>(null);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);

  useEffect(() => {
    if (workflow) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- re-inicializa o formulário quando o workflow carrega da store
      setFormDataState(buildForm(workflow));
    }
  }, [workflow]);

  useEffect(() => {
    if (workflow) setTabTitle(tabKey, workflow.name || 'Automação');
  }, [workflow, tabKey, setTabTitle]);

  useEffect(() => {
    void syncWorkflowStepCatalog().catch((error) => console.error('[ViewWorkflow] syncWorkflowStepCatalog:', error));
  }, []);

  useEffect(() => stepCatalogRepository.subscribeToStepCatalog(setStepCatalog), [stepCatalogRepository]);

  useEffect(() => {
    if (!currentTenant || isNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa erro anterior ao trocar de workflow/tenant
    setExecutionsError(null);
    return workflowExecutionRepository.subscribeToWorkflowExecutions(
      currentTenant.id,
      workflowId,
      setExecutions,
      (error) => setExecutionsError(error.message),
    );
  }, [currentTenant, isNew, workflowId, workflowExecutionRepository]);

  const setFormData = useCallback((data: Partial<WorkflowFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const steps = useMemo(
    () => [...(workflow?.steps ?? [])].sort((a, b) => a.order - b.order),
    [workflow],
  );

  const getStepDefinition = useCallback(
    (stepDefinitionId: string) => stepCatalog.find((s) => s.id === stepDefinitionId),
    [stepCatalog],
  );

  const dynamicEventFields = useMemo(() => {
    if (!workflow?.screenKey || !isCustomRecordEventName(workflow.eventName)) return [];
    const definition = getDefinition(workflow.screenKey);
    return definition
      ? sortFieldsByOrder(definition.fields).map((field) => ({ path: `values.${field.key}`, label: field.label }))
      : [];
  }, [workflow, getDefinition]);

  const eventFields = useMemo(
    () => (workflow ? getWorkflowEventFields(workflow.eventName, dynamicEventFields) : []),
    [workflow, dynamicEventFields],
  );

  // Se o eventName gravado não corresponde a nenhum evento do catálogo atual (ex: automação
  // criada antes de uma renomeação de evento), os pickers de "Do evento" não têm o que listar
  // e caem para texto livre — este flag avisa o usuário na aba Geral para escolher de novo.
  const isEventNameRecognized = useMemo(
    () => !workflow || WORKFLOW_EVENT_CATALOG.some((entry) => entry.name === workflow.eventName),
    [workflow],
  );

  const isCustomRecordEvent = useMemo(() => isCustomRecordEventName(formData.eventName), [formData.eventName]);

  const screenOptions = useMemo(
    () => dynamicScreens.map((def) => ({ value: def.id, label: def.titleSingular, icon: getScreenIconType(def.icon) })),
    [dynamicScreens],
  );

  // Mesma ideia de isEventNameRecognized, mas para a entidade customizada escolhida: se ela foi
  // excluída depois que o gatilho foi configurado, avisa o usuário a escolher de novo.
  const isScreenKeyRecognized = useMemo(
    () => !isCustomRecordEvent || !formData.screenKey || dynamicScreens.some((def) => def.id === formData.screenKey),
    [isCustomRecordEvent, formData.screenKey, dynamicScreens],
  );

  const isLookupEvent = useMemo(() => isLookupEventName(formData.eventName), [formData.eventName]);

  // Mesma ideia de isScreenKeyRecognized, mas para a lista de lookup escolhida.
  const isLookupCollectionRecognized = useMemo(
    () => !isLookupEvent || !formData.lookupCollection || WORKFLOW_LOOKUP_COLLECTIONS.some((entry) => entry.collection === formData.lookupCollection),
    [isLookupEvent, formData.lookupCollection],
  );

  // Ícone exibido ao lado do título: usa o ícone da tela/lista específica quando reconhecida,
  // caindo para o ícone genérico do evento (a mesma lógica do card em Automações).
  const headerIcon = useMemo<IconType | null>(() => {
    if (!formData.eventName) return null;
    if (isCustomRecordEvent && formData.screenKey) {
      const definition = getDefinition(formData.screenKey);
      if (definition) return getScreenIconType(definition.icon);
    }
    if (isLookupEvent && formData.lookupCollection) {
      const entry = WORKFLOW_LOOKUP_COLLECTIONS.find((e) => e.collection === formData.lookupCollection);
      if (entry) return getWorkflowLookupGroupIcon(entry.group);
    }
    return getWorkflowEventIcon(formData.eventName);
  }, [formData.eventName, formData.screenKey, formData.lookupCollection, isCustomRecordEvent, isLookupEvent, getDefinition]);

  const handleSaveGeneral = useCallback(async () => {
    if (!currentTenant) return;
    setIsSaving(true);
    try {
      const screenKey = isCustomRecordEvent ? (formData.screenKey || undefined) : undefined;
      const lookupCollection = isLookupEvent ? (formData.lookupCollection || undefined) : undefined;
      if (isNew) {
        const created = await createWorkflow({
          name: formData.name,
          description: formData.description || undefined,
          eventName: formData.eventName,
          screenKey,
          lookupCollection,
          enabled: true,
          version: 1,
          condition: { kind: 'AlwaysTrue' },
          steps: cloneSource ? cloneSource.steps.map((step) => ({ ...step, id: crypto.randomUUID() })) : [],
        });
        notify('Automação criada.', 'success');
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(`view-workflow:${created.id}`);
      } else if (workflow) {
        await updateWorkflow(workflow.id, {
          name: formData.name,
          description: formData.description || undefined,
          eventName: formData.eventName,
          screenKey,
          lookupCollection,
        });
        notify('Automação salva.', 'success');
      }
    } catch {
      notify('Erro ao salvar automação.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant, isNew, formData, isCustomRecordEvent, isLookupEvent, cloneSource, createWorkflow, updateWorkflow, workflow, notify, closeTab, tabKey, activePanelId, openTab]);

  const toggleEnabled = useCallback(() => {
    if (!workflow) return;
    const next = !workflow.enabled;
    updateWorkflow(workflow.id, { enabled: next })
      .then(() => notify(`Automação ${next ? 'ativada' : 'inativada'}.`, 'success'))
      .catch(() => notify('Erro ao atualizar automação.', 'error'));
  }, [workflow, updateWorkflow, notify]);

  const handleCopyDeepLink = useCallback(() => {
    if (!workflow) return;
    void navigator.clipboard.writeText(generateDeepLink(`view-workflow:${workflow.id}`));
    setCopyLinkDone(true);
    setTimeout(() => setCopyLinkDone(false), 2000);
  }, [workflow]);

  const handleClone = useCallback(() => {
    if (!workflow) return;
    openTab(`${CLONE_PREFIX}${workflow.id}`);
  }, [workflow, openTab]);

  const handleDeleteWorkflow = useCallback(() => {
    if (workflow) setWorkflowToDelete(workflow);
  }, [workflow]);

  const confirmDeleteWorkflow = useCallback(async () => {
    if (!workflowToDelete) return;
    try {
      await deleteWorkflow(workflowToDelete.id);
      notify('Automação excluída.', 'success');
      closeTab(tabKey, activePanelId);
    } catch {
      notify('Erro ao excluir automação.', 'error');
    } finally {
      setWorkflowToDelete(null);
    }
  }, [workflowToDelete, deleteWorkflow, notify, closeTab, tabKey, activePanelId]);

  const cancelDeleteWorkflow = useCallback(() => setWorkflowToDelete(null), []);

  const openAddStep = useCallback(() => { setEditingStep(null); setIsStepModalOpen(true); }, []);
  const openEditStep = useCallback((step: WorkflowStep) => { setEditingStep(step); setIsStepModalOpen(true); }, []);
  const closeStepModal = useCallback(() => setIsStepModalOpen(false), []);

  const saveStep = useCallback(async (step: WorkflowStep) => {
    if (!workflow) return;
    const exists = workflow.steps.some((s) => s.id === step.id);
    const nextSteps = exists
      ? workflow.steps.map((s) => (s.id === step.id ? step : s))
      : [...workflow.steps, { ...step, order: workflow.steps.length }];
    try {
      await updateWorkflowSteps(workflow.id, nextSteps);
      notify('Step salvo.', 'success');
      setIsStepModalOpen(false);
    } catch {
      notify('Erro ao salvar step.', 'error');
    }
  }, [workflow, updateWorkflowSteps, notify]);

  const handleDeleteStep = useCallback((step: WorkflowStep) => setStepToDelete(step), []);
  const cancelDeleteStep = useCallback(() => setStepToDelete(null), []);

  const confirmDeleteStep = useCallback(async () => {
    if (!workflow || !stepToDelete) return;
    const nextSteps = workflow.steps
      .filter((s) => s.id !== stepToDelete.id)
      .sort((a, b) => a.order - b.order)
      .map((s, index) => ({ ...s, order: index }));
    try {
      await updateWorkflowSteps(workflow.id, nextSteps);
      notify('Step excluído.', 'success');
    } catch {
      notify('Erro ao excluir step.', 'error');
    } finally {
      setStepToDelete(null);
    }
  }, [workflow, stepToDelete, updateWorkflowSteps, notify]);

  const moveStep = useCallback(async (step: WorkflowStep, direction: 'up' | 'down') => {
    if (!workflow) return;
    const sorted = [...workflow.steps].sort((a, b) => a.order - b.order);
    const index = sorted.findIndex((s) => s.id === step.id);
    const swapWith = direction === 'up' ? index - 1 : index + 1;
    if (swapWith < 0 || swapWith >= sorted.length) return;
    [sorted[index], sorted[swapWith]] = [sorted[swapWith], sorted[index]];
    const reordered = sorted.map((s, i) => ({ ...s, order: i }));
    await updateWorkflowSteps(workflow.id, reordered).catch(() => notify('Erro ao reordenar steps.', 'error'));
  }, [workflow, updateWorkflowSteps, notify]);

  const toggleStepEnabled = useCallback(async (step: WorkflowStep) => {
    if (!workflow) return;
    const nextSteps = workflow.steps.map((s) => (s.id === step.id ? { ...s, enabled: !s.enabled } : s));
    await updateWorkflowSteps(workflow.id, nextSteps).catch(() => notify('Erro ao atualizar step.', 'error'));
  }, [workflow, updateWorkflowSteps, notify]);

  return {
    isNew,
    workflow,
    activeTab,
    setActiveTab,
    formData,
    setFormData,
    isSaving,
    handleSaveGeneral,
    toggleEnabled,
    steps,
    stepCatalog,
    getStepDefinition,
    isStepModalOpen,
    editingStep,
    openAddStep,
    openEditStep,
    closeStepModal,
    saveStep,
    stepToDelete,
    handleDeleteStep,
    confirmDeleteStep,
    cancelDeleteStep,
    moveStep,
    toggleStepEnabled,
    executions,
    executionsError,
    eventFields,
    isEventNameRecognized,
    isCustomRecordEvent,
    screenOptions,
    isScreenKeyRecognized,
    isLookupEvent,
    isLookupCollectionRecognized,
    headerIcon,
    copyLinkDone,
    handleCopyDeepLink,
    handleClone,
    handleDeleteWorkflow,
    workflowToDelete,
    confirmDeleteWorkflow,
    cancelDeleteWorkflow,
  };
};
