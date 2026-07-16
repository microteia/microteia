import { useState, useMemo, useCallback, useEffect } from 'react';
import type { DragEvent } from 'react';
import type { IconType } from 'react-icons';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useStepCatalog } from '../../../stores/useStepCatalog';
import { sortFieldsByOrder } from '../../../domain/services/customFieldValues';
import { WORKFLOW_EVENT_CATALOG, WORKFLOW_CALLED_EVENT, getWorkflowEventFields, eventNameToEntityKey, workflowParametersToFieldOptions } from '../../../domain/services/workflowEventCatalog';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import { WORKFLOW_LOOKUP_COLLECTIONS } from '../../../domain/services/workflowLookupCatalog';
import { ENTITY_REGISTRY } from '../../../domain/schema/entityRegistry';
import { siblingParameterErrors, hasParameterErrorsDeep, sanitizeWorkflowParameters, cloneParameterInList } from '../../../domain/schema/workflowParameters';
import { getWorkflowEventIcon, getWorkflowLookupGroupIcon } from '../../shared/workflowEventIcons';
import { getScreenIconType } from '../../shared/screenIcons';
import { getStepIcon as getStepIconType } from '../../shared/stepIcons';
import { RiGitBranchLine } from 'react-icons/ri';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import {
  getStepDisplayName,
  describeCondition,
  flattenSteps,
  removeStepFromTree,
  updateStepInTree,
  insertStepInto,
  moveStepWithinSiblings,
  reorderSiblings,
} from '../../shared/workflowHelpers';
import type { InsertTarget } from '../../shared/workflowHelpers';
import type { WorkflowDefinition, WorkflowExecution, WorkflowStep, Condition, WorkflowParameter } from '../../../domain/entities/Workflow';
import type { StepDefinitionSummary, StepCategory } from '../../../domain/entities/WorkflowStepCatalog';

export type ViewWorkflowTab = 'general' | 'conditions' | 'steps' | 'executions';

export type StepsViewMode = 'flow' | 'list';
export type ConditionViewMode = 'editor' | 'diagram';

const STEPS_VIEW_MODE_KEY = 'curatino:workflowStepsViewMode';
const CONDITION_VIEW_MODE_KEY = 'curatino:workflowConditionViewMode';

const loadStepsViewMode = (): StepsViewMode => {
  try {
    return localStorage.getItem(STEPS_VIEW_MODE_KEY) === 'list' ? 'list' : 'flow';
  } catch {
    return 'flow';
  }
};

const saveStepsViewMode = (mode: StepsViewMode): void => {
  try {
    localStorage.setItem(STEPS_VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
};

const loadConditionViewMode = (): ConditionViewMode => {
  try {
    return localStorage.getItem(CONDITION_VIEW_MODE_KEY) === 'diagram' ? 'diagram' : 'editor';
  } catch {
    return 'editor';
  }
};

const saveConditionViewMode = (mode: ConditionViewMode): void => {
  try {
    localStorage.setItem(CONDITION_VIEW_MODE_KEY, mode);
  } catch {
    // ignore
  }
};

const STEP_CATEGORY_LABELS: Record<StepCategory, string> = {
  Action: 'Ação',
  Data: 'Dados',
  Notification: 'Notificação',
  Integration: 'Integração',
};

const isCustomRecordEventName = (eventName: string): boolean => eventName.startsWith('custom_record.');
const isLookupEventName = (eventName: string): boolean => eventName.startsWith('lookup.');
const isCalledEventName = (eventName: string): boolean => eventName === WORKFLOW_CALLED_EVENT;

export const PARAMETER_TYPE_OPTIONS: { value: WorkflowParameter['type']; label: string }[] = [
  { value: 'String', label: 'Texto' },
  { value: 'Number', label: 'Número' },
  { value: 'Date', label: 'Data' },
  { value: 'Boolean', label: 'Booleano' },
  { value: 'select', label: 'Lista de opções' },
  { value: 'EntityReference', label: 'Referência a entidade' },
  { value: 'Object', label: 'Objeto (aninhado)' },
];

export interface WorkflowFormData {
  name: string;
  description: string;
  eventName: string;
  screenKey: string;
  lookupCollection: string;
  parameters: WorkflowParameter[];
  isPublic: boolean;
  version: number;
}

const sanitizeParameters = sanitizeWorkflowParameters;

const buildForm = (w: WorkflowDefinition | null): WorkflowFormData => ({
  name: w?.name ?? '',
  description: w?.description ?? '',
  eventName: w?.eventName ?? '',
  screenKey: w?.screenKey ?? '',
  lookupCollection: w?.lookupCollection ?? '',
  parameters: w?.parameters ?? [],
  isPublic: w?.isPublic ?? false,
  version: w?.version ?? 1,
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
  getStepIcon: (stepDefinitionId: string) => IconType;
  getStepIconForStep: (step: WorkflowStep) => IconType;
  getStepById: (id: string) => WorkflowStep | undefined;
  openAddStep: (target?: InsertTarget) => void;
  openAddCondition: (target?: InsertTarget) => Promise<void>;
  openEditStep: (step: WorkflowStep) => void;
  stepToDelete: WorkflowStep | null;
  handleDeleteStep: (step: WorkflowStep) => void;
  confirmDeleteStep: () => Promise<void>;
  cancelDeleteStep: () => void;
  moveStep: (step: WorkflowStep, direction: 'up' | 'down') => Promise<void>;
  toggleStepEnabled: (step: WorkflowStep) => Promise<void>;
  stepsViewMode: StepsViewMode;
  setStepsViewMode: (mode: StepsViewMode) => void;
  conditionViewMode: ConditionViewMode;
  setConditionViewMode: (mode: ConditionViewMode) => void;
  conditionFocusPath: number[] | null;
  handleRequestConditionEdit: (path: number[]) => void;
  clearConditionFocusPath: () => void;
  eventLabel: string;
  getStepTypeLabel: (step: WorkflowStep) => string;
  getConditionSummary: (step: WorkflowStep) => string;
  draggingStepId: string | null;
  dropTarget: { parentKey: string; index: number } | null;
  handleStepDragStart: (event: DragEvent<HTMLElement>, stepId: string, parentKey: string) => void;
  handleStepDragEnd: () => void;
  handleStepDragOverNode: (event: DragEvent<HTMLElement>, parentKey: string, index: number) => void;
  handleStepDragOverGap: (event: DragEvent<HTMLElement>, parentKey: string, gapIndex: number) => void;
  handleStepDrop: (event: DragEvent<HTMLElement>) => void;
  executions: WorkflowExecution[];
  executionsError: string | null;
  toggleExecutionOutputs: (executionId: string) => void;
  isExecutionOutputsExpanded: (executionId: string) => boolean;
  toggleLogData: (executionId: string, logIndex: number, type: 'inputs' | 'outputs' | 'contextInput') => void;
  isLogDataExpanded: (executionId: string, logIndex: number, type: 'inputs' | 'outputs' | 'contextInput') => boolean;
  toggleStepResult: (executionId: string, stepId: string) => void;
  isStepResultExpanded: (executionId: string, stepId: string) => boolean;
  getStepLogStatus: (log: { level: string }) => 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO';
  eventFields: WorkflowEventFieldOption[];
  isEventNameRecognized: boolean;
  isCustomRecordEvent: boolean;
  screenOptions: { value: string; label: string; icon: IconType }[];
  isScreenKeyRecognized: boolean;
  isLookupEvent: boolean;
  isLookupCollectionRecognized: boolean;
  isCalledEvent: boolean;
  parameterEntityOptions: { value: string; label: string }[];
  parameterErrors: (string | undefined)[];
  hasParameterErrors: boolean;
  addParameter: () => void;
  updateParameter: (index: number, patch: Partial<WorkflowParameter>) => void;
  removeParameter: (index: number) => void;
  cloneParameter: (index: number) => void;
  replaceParameters: (parameters: WorkflowParameter[]) => void;
  headerIcon: IconType | null;
  copyLinkDone: boolean;
  handleCopyDeepLink: () => void;
  handleClone: () => void;
  handleDeleteWorkflow: () => void;
  workflowToDelete: WorkflowDefinition | null;
  confirmDeleteWorkflow: () => Promise<void>;
  cancelDeleteWorkflow: () => void;
  pendingCondition: Condition;
  conditionChanged: boolean;
  handleConditionLocalChange: (condition: Condition) => void;
  handleSaveCondition: () => Promise<void>;
  isOutdated: boolean;
  sourceWorkflowVersion: number | null;
  handleUpdateFromSource: () => Promise<void>;
  isUpdating: boolean;
}

const CLONE_PREFIX = 'new-workflow:clone:';

export const useViewWorkflowViewModel = (tabKey: string): ViewWorkflowViewModel => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-workflow' || cloneSourceId !== null;
  const [workflowIdRaw, initialTabRaw] = isNew ? ['', undefined] : tabKey.replace('view-workflow:', '').split('::');
  const workflowId = workflowIdRaw;
  const initialTab: ViewWorkflowTab = initialTabRaw === 'executions' ? 'executions' : 'general';

  const { workflows, publicWorkflows, createWorkflow, updateWorkflow, updateWorkflowSteps, deleteWorkflow, updateFromSourceWorkflow } = useWorkflowStore();
  const { currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { workflowExecutionRepository } = useDI();
  const { dynamicScreens, getDefinition } = useScreenDefinitions();
  const { stepCatalog, loadCatalog } = useStepCatalog();

  const workflow = useMemo(
    () => (isNew ? null : (workflows.find((w) => w.id === workflowId) ?? null)),
    [isNew, workflows, workflowId],
  );

  const cloneSource = useMemo(
    () => (cloneSourceId ? (workflows.find((w) => w.id === cloneSourceId) ?? null) : null),
    [workflows, cloneSourceId],
  );

  const [activeTab, setActiveTab] = useState<ViewWorkflowTab>(initialTab);
  const [formData, setFormDataState] = useState<WorkflowFormData>(() => buildForm(cloneSource));
  const [isSaving, setIsSaving] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [stepToDelete, setStepToDelete] = useState<WorkflowStep | null>(null);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);
  const [expandedExecutionOutputs, setExpandedExecutionOutputs] = useState<Set<string>>(new Set());
  const [expandedLogData, setExpandedLogData] = useState<Set<string>>(new Set());
  const [expandedStepResults, setExpandedStepResults] = useState<Set<string>>(new Set());
  const [pendingCondition, setPendingCondition] = useState<Condition>({ kind: 'AlwaysTrue' });
  const [conditionChanged, setConditionChanged] = useState(false);
  const [stepsViewMode, setStepsViewModeState] = useState<StepsViewMode>(loadStepsViewMode);
  const [conditionViewMode, setConditionViewModeState] = useState<ConditionViewMode>(loadConditionViewMode);
  const [conditionFocusPath, setConditionFocusPath] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState<{ id: string; parentKey: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ parentKey: string; index: number } | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);

  // Carrega o catálogo de steps uma vez (idempotente)
  useEffect(() => {
    void loadCatalog().catch((error) => console.error('[ViewWorkflow] loadCatalog:', error));
  }, [loadCatalog]);

  useEffect(() => {
    if (workflow) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário e condição com workflow carregado da store
      setFormDataState(buildForm(workflow));
      setPendingCondition(workflow.condition);
      setConditionChanged(false);
    }
  }, [workflow]);

  useEffect(() => {
    if (workflow) setTabTitle(tabKey, workflow.name || 'Automação');
  }, [workflow, tabKey, setTabTitle]);

  useEffect(() => {
    if (!currentTenant || isNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa erro anterior ao trocar de workflow/tenant
    setExecutionsError(null);
    return workflowExecutionRepository.subscribeToWorkflowExecutions(
      currentTenant.id,
      workflowId,
      (newExecutions) => {
        setExecutions(newExecutions);
        // Auto-expandir steps com erro
        setExpandedStepResults((prev) => {
          const next = new Set(prev);
          newExecutions.forEach((execution) => {
            execution.logs.forEach((log) => {
              if (log.stepId && log.level === 'ERROR') {
                next.add(`${execution.id}:${log.stepId}`);
              }
            });
          });
          return next;
        });
      },
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

  const sourceWorkflow = useMemo(() => {
    if (!workflow?.sourceWorkflowId) return null;
    return publicWorkflows.find((w) => w.id === workflow.sourceWorkflowId) ?? null;
  }, [workflow, publicWorkflows]);

  const isOutdated = useMemo(() => {
    if (!workflow?.sourceWorkflowId || !sourceWorkflow) return false;
    return workflow.sourceVersion !== sourceWorkflow.version;
  }, [workflow, sourceWorkflow]);

  const sourceWorkflowVersion = useMemo(() => {
    return sourceWorkflow?.version ?? null;
  }, [sourceWorkflow]);

  const getStepDefinition = useCallback(
    (stepDefinitionId: string) => stepCatalog.find((s) => s.id === stepDefinitionId),
    [stepCatalog],
  );

  const getStepIcon = useCallback(
    (stepDefinitionId: string): IconType => {
      const definition = stepCatalog.find((s) => s.id === stepDefinitionId);
      return getStepIconType(definition?.icon ?? '');
    },
    [stepCatalog],
  );

  const getStepIconForStep = useCallback(
    (step: WorkflowStep): IconType => (step.type === 'Condition' ? RiGitBranchLine : getStepIcon(step.stepDefinitionId)),
    [getStepIcon],
  );

  const flatSteps = useMemo(() => flattenSteps(workflow?.steps ?? []), [workflow]);

  const getStepById = useCallback(
    (id: string): WorkflowStep | undefined => flatSteps.find((s) => s.id === id),
    [flatSteps],
  );

  const dynamicEventFields = useMemo(() => {
    if (!workflow) return [];

    // Para custom_record, usa screenKey para buscar a definição de tela customizada
    if (isCustomRecordEventName(workflow.eventName) && workflow.screenKey) {
      const definition = getDefinition(workflow.screenKey);
      if (definition) {
        return sortFieldsByOrder(definition.fields).map((field) => ({
          path: field.key,
          label: field.label,
        }));
      }
    }

    // Para entidades built-in (case, person, contract, etc.), busca campos customizados
    const entityKey = eventNameToEntityKey(workflow.eventName);
    if (entityKey) {
      const customFields = getDefinition(entityKey);
      if (customFields) {
        return sortFieldsByOrder(customFields.fields).map((field) => ({
          path: field.key,
          label: field.label,
        }));
      }
    }

    return [];
  }, [workflow, getDefinition]);

  const eventFields = useMemo(() => {
    if (!workflow) return [];
    if (isCalledEventName(workflow.eventName)) return workflowParametersToFieldOptions(workflow.parameters);
    return getWorkflowEventFields(workflow.eventName, dynamicEventFields);
  }, [workflow, dynamicEventFields]);

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

  const isCalledEvent = useMemo(() => isCalledEventName(formData.eventName), [formData.eventName]);

  const parameterEntityOptions = useMemo(() => {
    const builtin = Object.values(ENTITY_REGISTRY)
      .filter((entity) => entity.referenceable)
      .map((entity) => ({ value: entity.collection, label: entity.labelPlural }));
    const custom = dynamicScreens.map((def) => ({ value: def.id, label: def.titlePlural }));
    return [...builtin, ...custom];
  }, [dynamicScreens]);

  const parameterErrors = useMemo<(string | undefined)[]>(
    () => (isCalledEvent ? siblingParameterErrors(formData.parameters) : []),
    [isCalledEvent, formData.parameters],
  );

  const hasParameterErrors = useMemo(
    () => isCalledEvent && hasParameterErrorsDeep(formData.parameters),
    [isCalledEvent, formData.parameters],
  );

  const addParameter = useCallback(() => {
    setFormDataState((prev) => ({
      ...prev,
      parameters: [...prev.parameters, { key: '', label: '', type: 'String' }],
    }));
  }, []);

  const updateParameter = useCallback((index: number, patch: Partial<WorkflowParameter>) => {
    setFormDataState((prev) => ({
      ...prev,
      parameters: prev.parameters.map((parameter, i) => (i === index ? { ...parameter, ...patch } : parameter)),
    }));
  }, []);

  const removeParameter = useCallback((index: number) => {
    setFormDataState((prev) => ({
      ...prev,
      parameters: prev.parameters.filter((_, i) => i !== index),
    }));
  }, []);

  const replaceParameters = useCallback((parameters: WorkflowParameter[]) => {
    setFormDataState((prev) => ({ ...prev, parameters }));
  }, []);

  const cloneParameter = useCallback((index: number) => {
    setFormDataState((prev) => ({ ...prev, parameters: cloneParameterInList(prev.parameters, index) }));
  }, []);

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
      const screenKey = isCustomRecordEvent && formData.screenKey ? formData.screenKey : undefined;
      const lookupCollection = isLookupEvent && formData.lookupCollection ? formData.lookupCollection : undefined;
      const parameters = isCalledEvent ? sanitizeParameters(formData.parameters) : undefined;

      if (isNew) {
        const createData: Record<string, unknown> = {
          name: formData.name,
          eventName: formData.eventName,
          enabled: true,
          version: 1,
          condition: { kind: 'AlwaysTrue' },
          steps: cloneSource ? cloneSource.steps.map((step) => ({ ...step, id: crypto.randomUUID() })) : [],
          isPublic: formData.isPublic,
        };
        if (formData.description) createData.description = formData.description;
        if (screenKey) createData.screenKey = screenKey;
        if (lookupCollection) createData.lookupCollection = lookupCollection;
        if (parameters) createData.parameters = parameters;

        const created = await createWorkflow(createData as Parameters<typeof createWorkflow>[0]);
        notify('Automação criada.', 'success');
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(`view-workflow:${created.id}`);
      } else if (workflow) {
        const updateData: Record<string, unknown> = {
          name: formData.name,
          eventName: formData.eventName,
          parameters: parameters ?? [],
          isPublic: formData.isPublic,
          version: formData.version,
        };
        if (formData.description) updateData.description = formData.description;
        if (screenKey) updateData.screenKey = screenKey;
        if (lookupCollection) updateData.lookupCollection = lookupCollection;

        await updateWorkflow(workflow.id, updateData as Parameters<typeof updateWorkflow>[1]);
        notify('Automação salva.', 'success');
      }
    } catch (error) {
      console.error('[ViewWorkflow] handleSaveGeneral:', error);
      notify('Erro ao salvar automação.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant, isNew, formData, isCustomRecordEvent, isLookupEvent, isCalledEvent, cloneSource, createWorkflow, updateWorkflow, workflow, notify, closeTab, tabKey, activePanelId, openTab]);

  const toggleEnabled = useCallback(() => {
    if (!workflow) return;
    const next = !workflow.enabled;
    updateWorkflow(workflow.id, { enabled: next })
      .then(() => notify(`Automação ${next ? 'ativada' : 'inativada'}.`, 'success'))
      .catch((error) => {
        console.error('[ViewWorkflow] toggleEnabled:', error);
        notify('Erro ao alterar status.', 'error');
      });
  }, [workflow, updateWorkflow, notify]);

  const handleConditionLocalChange = useCallback((condition: Condition) => {
    setPendingCondition(condition);
    setConditionChanged(true);
  }, []);

  const handleSaveCondition = useCallback(async () => {
    if (!workflow || !conditionChanged) return;
    setIsSaving(true);
    try {
      await updateWorkflow(workflow.id, { condition: pendingCondition });
      setConditionChanged(false);
      notify('Condição salva.', 'success');
    } catch (error) {
      console.error('[ViewWorkflow] handleSaveCondition:', error);
      notify('Erro ao salvar condição.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [workflow, conditionChanged, pendingCondition, updateWorkflow, notify]);

  const handleUpdateFromSource = useCallback(async () => {
    if (!workflow?.id) return;

    setIsUpdating(true);
    try {
      const result = await updateFromSourceWorkflow(workflow.id);
      notify(
        `Workflow atualizado! ${result.updatedScripts} script(s) e ${result.updatedSubWorkflows} sub-workflow(s) também foram atualizados. Nova versão: ${result.newVersion}`,
        'success',
      );
    } catch (err) {
      notify(
        `Erro ao atualizar workflow: ${err instanceof Error ? err.message : String(err)}`,
        'error',
      );
    } finally {
      setIsUpdating(false);
    }
  }, [workflow, updateFromSourceWorkflow, notify]);

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
    } catch (error) {
      console.error('[ViewWorkflow] confirmDeleteWorkflow:', error);
      notify('Erro ao excluir automação.', 'error');
    } finally {
      setWorkflowToDelete(null);
    }
  }, [workflowToDelete, deleteWorkflow, notify, closeTab, tabKey, activePanelId]);

  const cancelDeleteWorkflow = useCallback(() => setWorkflowToDelete(null), []);

  const toggleExecutionOutputs = useCallback((executionId: string) => {
    setExpandedExecutionOutputs((prev) => {
      const next = new Set(prev);
      if (next.has(executionId)) {
        next.delete(executionId);
      } else {
        next.add(executionId);
      }
      return next;
    });
  }, []);

  const isExecutionOutputsExpanded = useCallback((executionId: string) => {
    return expandedExecutionOutputs.has(executionId);
  }, [expandedExecutionOutputs]);

  const toggleLogData = useCallback((executionId: string, logIndex: number, type: 'inputs' | 'outputs' | 'contextInput') => {
    const key = `${executionId}:${logIndex}:${type}`;
    setExpandedLogData((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const isLogDataExpanded = useCallback((executionId: string, logIndex: number, type: 'inputs' | 'outputs' | 'contextInput') => {
    const key = `${executionId}:${logIndex}:${type}`;
    return expandedLogData.has(key);
  }, [expandedLogData]);

  const toggleStepResult = useCallback((executionId: string, stepId: string) => {
    const key = `${executionId}:${stepId}`;
    setExpandedStepResults((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const isStepResultExpanded = useCallback((executionId: string, stepId: string) => {
    const key = `${executionId}:${stepId}`;
    return expandedStepResults.has(key);
  }, [expandedStepResults]);

  const targetSuffix = useCallback((target?: InsertTarget): string => {
    if (!target || target.kind === 'root') return '';
    return `:add:${target.conditionId}:${target.branch}`;
  }, []);

  const openAddStep = useCallback((target?: InsertTarget) => {
    if (!workflow) return;
    openTab(`edit-workflow-step:${workflow.id}${targetSuffix(target)}`);
  }, [workflow, openTab, targetSuffix]);

  const openAddCondition = useCallback(async (target?: InsertTarget) => {
    if (!workflow) return;
    const conditionStep: WorkflowStep = {
      id: crypto.randomUUID(),
      stepDefinitionId: '',
      type: 'Condition',
      order: 0,
      configuration: {},
      enabled: true,
      condition: { kind: 'AlwaysTrue' },
      branches: { whenTrue: [], whenFalse: [] },
    };
    const nextSteps = insertStepInto(workflow.steps, target ?? { kind: 'root' }, conditionStep);
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] openAddCondition:', error);
      notify('Erro ao adicionar condição.', 'error');
    });
  }, [workflow, updateWorkflowSteps, notify]);

  const openEditStep = useCallback((step: WorkflowStep) => {
    if (!workflow) return;
    openTab(`edit-workflow-step:${workflow.id}:${step.id}`);
  }, [workflow, openTab]);

  const handleDeleteStep = useCallback((step: WorkflowStep) => setStepToDelete(step), []);
  const cancelDeleteStep = useCallback(() => setStepToDelete(null), []);

  const confirmDeleteStep = useCallback(async () => {
    if (!workflow || !stepToDelete) return;
    const nextSteps = removeStepFromTree(workflow.steps, stepToDelete.id);
    try {
      await updateWorkflowSteps(workflow.id, nextSteps);
      notify('Step excluído.', 'success');
    } catch (error) {
      console.error('[ViewWorkflow] confirmDeleteStep:', error);
      notify('Erro ao excluir step.', 'error');
    } finally {
      setStepToDelete(null);
    }
  }, [workflow, stepToDelete, updateWorkflowSteps, notify]);

  const moveStep = useCallback(async (step: WorkflowStep, direction: 'up' | 'down') => {
    if (!workflow) return;
    const nextSteps = moveStepWithinSiblings(workflow.steps, step.id, direction);
    if (nextSteps === workflow.steps) return;
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] moveStep:', error);
      notify('Erro ao reordenar steps.', 'error');
    });
  }, [workflow, updateWorkflowSteps, notify]);

  const toggleStepEnabled = useCallback(async (step: WorkflowStep) => {
    if (!workflow) return;
    const nextSteps = updateStepInTree(workflow.steps, step.id, (s) => ({ ...s, enabled: !s.enabled }));
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] toggleStepEnabled:', error);
      notify('Erro ao atualizar step.', 'error');
    });
  }, [workflow, updateWorkflowSteps, notify]);

  const setStepsViewMode = useCallback((mode: StepsViewMode) => {
    setStepsViewModeState(mode);
    saveStepsViewMode(mode);
  }, []);

  const setConditionViewMode = useCallback((mode: ConditionViewMode) => {
    setConditionViewModeState(mode);
    saveConditionViewMode(mode);
  }, []);

  const handleRequestConditionEdit = useCallback((path: number[]) => {
    setConditionFocusPath(path);
    setConditionViewMode('editor');
  }, [setConditionViewMode]);

  const clearConditionFocusPath = useCallback(() => setConditionFocusPath(null), []);

  const eventLabel = useMemo(() => {
    if (!workflow) return '';
    return WORKFLOW_EVENT_CATALOG.find((entry) => entry.name === workflow.eventName)?.label ?? workflow.eventName;
  }, [workflow]);

  const getStepTypeLabel = useCallback((step: WorkflowStep): string => {
    if (step.type === 'Condition') return 'Condição';
    const definition = getStepDefinition(step.stepDefinitionId);
    if (!definition) return step.stepDefinitionId;
    const categoryLabel = STEP_CATEGORY_LABELS[definition.category] ?? definition.category;
    return getStepDisplayName(step, definition) === definition.name
      ? categoryLabel
      : `${categoryLabel} · ${definition.name}`;
  }, [getStepDefinition]);

  const getConditionSummary = useCallback((step: WorkflowStep): string => describeCondition(step.condition), []);

  const handleStepDragStart = useCallback((event: DragEvent<HTMLElement>, stepId: string, parentKey: string) => {
    event.dataTransfer.setData('text/plain', stepId);
    event.dataTransfer.effectAllowed = 'move';
    setDragging({ id: stepId, parentKey });
  }, []);

  const handleStepDragEnd = useCallback(() => {
    setDragging(null);
    setDropTarget(null);
  }, []);

  const handleStepDragOverGap = useCallback((event: DragEvent<HTMLElement>, parentKey: string, gapIndex: number) => {
    event.preventDefault();
    setDropTarget({ parentKey, index: gapIndex });
  }, []);

  const handleStepDragOverNode = useCallback((event: DragEvent<HTMLElement>, parentKey: string, index: number) => {
    event.preventDefault();
    const rect = event.currentTarget.getBoundingClientRect();
    setDropTarget({ parentKey, index: event.clientY < rect.top + rect.height / 2 ? index : index + 1 });
  }, []);

  const handleStepDrop = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    const dragged = dragging;
    const target = dropTarget;
    setDragging(null);
    setDropTarget(null);
    // Reordenação só dentro do mesmo ramo (mesmo parentKey).
    if (!workflow || !dragged || !target || dragged.parentKey !== target.parentKey) return;
    const nextSteps = reorderSiblings(workflow.steps, dragged.id, target.index);
    if (nextSteps === workflow.steps) return;
    updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] handleStepDrop:', error);
      notify('Erro ao reordenar steps.', 'error');
    });
  }, [dragging, dropTarget, workflow, updateWorkflowSteps, notify]);

  const getStepLogStatus = useCallback((log: { level: string }): 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO' => {
    if (log.level === 'ERROR') return 'ERROR';
    if (log.level === 'SUCCESS') return 'SUCCESS';
    if (log.level === 'WARN') return 'WARN';
    return 'INFO';
  }, []);

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
    getStepIcon,
    getStepIconForStep,
    getStepById,
    openAddStep,
    openAddCondition,
    openEditStep,
    stepToDelete,
    handleDeleteStep,
    confirmDeleteStep,
    cancelDeleteStep,
    moveStep,
    toggleStepEnabled,
    stepsViewMode,
    setStepsViewMode,
    conditionViewMode,
    setConditionViewMode,
    conditionFocusPath,
    handleRequestConditionEdit,
    clearConditionFocusPath,
    eventLabel,
    getStepTypeLabel,
    getConditionSummary,
    draggingStepId: dragging?.id ?? null,
    dropTarget,
    handleStepDragStart,
    handleStepDragEnd,
    handleStepDragOverNode,
    handleStepDragOverGap,
    handleStepDrop,
    executions,
    executionsError,
    toggleExecutionOutputs,
    isExecutionOutputsExpanded,
    toggleLogData,
    isLogDataExpanded,
    toggleStepResult,
    isStepResultExpanded,
    eventFields,
    isEventNameRecognized,
    isCustomRecordEvent,
    screenOptions,
    isScreenKeyRecognized,
    isLookupEvent,
    isLookupCollectionRecognized,
    isCalledEvent,
    parameterEntityOptions,
    parameterErrors,
    hasParameterErrors,
    addParameter,
    updateParameter,
    removeParameter,
    cloneParameter,
    replaceParameters,
    headerIcon,
    copyLinkDone,
    handleCopyDeepLink,
    handleClone,
    handleDeleteWorkflow,
    getStepLogStatus,
    workflowToDelete,
    confirmDeleteWorkflow,
    cancelDeleteWorkflow,
    pendingCondition,
    conditionChanged,
    handleConditionLocalChange,
    handleSaveCondition,
    isOutdated,
    sourceWorkflowVersion,
    handleUpdateFromSource,
    isUpdating,
  };
};
