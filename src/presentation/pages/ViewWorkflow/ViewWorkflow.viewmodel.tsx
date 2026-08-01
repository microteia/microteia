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
import { WORKFLOW_CALLED_EVENT, buildWorkflowEventCatalog, getWorkflowEventFields, eventNameToEntityKey, workflowParametersToFieldOptions } from '../../../domain/services/workflowEventCatalog';
import type { SchemaContext } from '../../../domain/schema/pathResolver';
import { useSchemaContext } from '../../shared/useSchemaContext';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import { WORKFLOW_LOOKUP_COLLECTIONS } from '../../../domain/services/workflowLookupCatalog';
import { ENTITY_REGISTRY } from '../../../domain/schema/entityRegistry';
import { siblingParameterErrors, hasParameterErrorsDeep, sanitizeWorkflowParameters, cloneParameterInList } from '../../../domain/schema/workflowParameters';
import { getWorkflowEventIcon, getWorkflowLookupGroupIcon } from '../../shared/workflowEventIcons';
import { getScreenIconType } from '../../shared/screenIcons';
import { getStepIcon as getStepIconType } from '../../shared/stepIcons';
import { RiGitBranchLine, RiLoopLeftLine } from 'react-icons/ri';
import { generateDeepLink } from '../../../infrastructure/deeplink/deepLinkUtils';
import {
  getStepDisplayName,
  describeCondition,
  flattenSteps,
  removeStepFromTree,
  updateStepInTree,
  insertStepInto,
  insertStepAtIndex,
  moveStepWithinSiblings,
  reorderSiblings,
  moveStepToLocation,
  parseParentKey,
} from '../../shared/workflowHelpers';
import type { InsertTarget } from '../../shared/workflowHelpers';
import type { WorkflowDefinition, WorkflowExecution, WorkflowStep, Condition, WorkflowParameter } from '../../../domain/entities/Workflow';
import type { RunModalResult } from '../../components/ui/RunModal';
import type { StepDefinitionSummary, StepCategory } from '../../../domain/entities/WorkflowStepCatalog';
import { deriveWorkflowId, workflowIdIssue } from '../../../domain/services/workflowIdentity';

export type ViewWorkflowTab = 'general' | 'conditions' | 'steps' | 'executions';

export type StepsViewMode = 'flow' | 'list';
export type ConditionViewMode = 'editor' | 'diagram';

const STEPS_VIEW_MODE_KEY = 'microteia:workflowStepsViewMode';
const CONDITION_VIEW_MODE_KEY = 'microteia:workflowConditionViewMode';

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
  /** Identificador escolhido na criação. Em branco, é derivado do nome ao salvar. */
  workflowId: string;
  name: string;
  description: string;
  eventName: string;
  lookupCollection: string;
  parameters: WorkflowParameter[];
}

const sanitizeParameters = sanitizeWorkflowParameters;

const buildForm = (w: WorkflowDefinition | null): WorkflowFormData => ({
  workflowId: '',
  name: w?.name ?? '',
  description: w?.description ?? '',
  eventName: w?.eventName ?? '',
  lookupCollection: w?.lookupCollection ?? '',
  parameters: w?.parameters ?? [],
});

/**
 * Opções de gatilho do tenant: os eventos fixos mais um par por tela do Form Design ou de extensão.
 * Depende do contexto de schema porque as telas do tenant são DADO, não código.
 */
export const buildEventNameOptions = (ctx: SchemaContext) =>
  buildWorkflowEventCatalog(ctx).map((entry) => ({
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
  /** Identificador da automação já criada — o que as Ações guardam. */
  workflowIdValue: string;
  suggestedWorkflowId: string;
  workflowIdError: string | undefined;
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
  openAddStep: (target?: InsertTarget, index?: number) => void;
  openAddCondition: (target?: InsertTarget, index?: number) => Promise<void>;
  openAddLoop: (target?: InsertTarget, index?: number) => Promise<void>;
  toggleLoopCollapsed: (loopId: string) => void;
  isLoopCollapsed: (loopId: string) => boolean;
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
  getLoopSummary: (step: WorkflowStep) => string;
  draggingStepId: string | null;
  dropTarget: { parentKey: string; index: number } | null;
  handleStepDragStart: (event: DragEvent<HTMLElement>, stepId: string, parentKey: string) => void;
  handleStepDragEnd: () => void;
  handleStepDragOverNode: (event: DragEvent<HTMLElement>, parentKey: string, index: number) => void;
  handleStepDragOverGap: (event: DragEvent<HTMLElement>, parentKey: string, gapIndex: number) => void;
  handleContainerDragOver: (event: DragEvent<HTMLElement>, parentKey: string, endIndex: number) => void;
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
  eventNameOptions: { value: string; label: string; icon: IconType }[];
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
  canRunWorkflow: boolean;
  runWorkflowDisabledReason: string | null;
  runModalOpen: boolean;
  runModalParameters: WorkflowParameter[];
  openRunModal: () => void;
  closeRunModal: () => void;
  runWorkflowForModal: (providedParams: Record<string, unknown>) => Promise<RunModalResult>;
}

const RUN_EXECUTION_TIMEOUT_MS = 60000;

const mapExecutionToRunResult = (exec: WorkflowExecution): RunModalResult => {
  const lastError = [...exec.logs].reverse().find((entry) => entry.level === 'ERROR');
  return {
    status: exec.status === 'RUNNING' ? null : exec.status,
    outputs: exec.outputs ?? null,
    logs: exec.logs.map((entry) => ({ level: entry.level, message: entry.message })),
    error: exec.status === 'SUCCESS' ? null : (lastError?.message ?? null),
  };
}

const CLONE_PREFIX = 'new-workflow:clone:';

export const useViewWorkflowViewModel = (tabKey: string): ViewWorkflowViewModel => {
  const cloneSourceId = tabKey.startsWith(CLONE_PREFIX) ? tabKey.slice(CLONE_PREFIX.length) : null;
  const isNew = tabKey === 'new-workflow' || cloneSourceId !== null;
  const [workflowIdRaw, initialTabRaw] = isNew ? ['', undefined] : tabKey.replace('view-workflow:', '').split('::');
  const workflowId = workflowIdRaw;
  const initialTab: ViewWorkflowTab = initialTabRaw === 'executions' ? 'executions' : 'general';

  const { workflows, createWorkflow, updateWorkflow, updateWorkflowSteps, deleteWorkflow } = useWorkflowStore();
  const { currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { workflowExecutionRepository, dataProcessorRepository } = useDI();
  const { dynamicScreens, getDefinition } = useScreenDefinitions();
  const ctx = useSchemaContext();
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
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [executions, setExecutions] = useState<WorkflowExecution[]>([]);
  const [executionsError, setExecutionsError] = useState<string | null>(null);
  const [stepToDelete, setStepToDelete] = useState<WorkflowStep | null>(null);
  const [copyLinkDone, setCopyLinkDone] = useState(false);
  const [workflowToDelete, setWorkflowToDelete] = useState<WorkflowDefinition | null>(null);
  const [expandedExecutionOutputs, setExpandedExecutionOutputs] = useState<Set<string>>(new Set());
  const [expandedLogData, setExpandedLogData] = useState<Set<string>>(new Set());
  const [expandedStepResults, setExpandedStepResults] = useState<Set<string>>(new Set());
  const [collapsedLoopIds, setCollapsedLoopIds] = useState<Set<string>>(new Set());
  const [pendingCondition, setPendingCondition] = useState<Condition>({ kind: 'AlwaysTrue' });
  const [conditionChanged, setConditionChanged] = useState(false);
  const [stepsViewMode, setStepsViewModeState] = useState<StepsViewMode>(loadStepsViewMode);
  const [conditionViewMode, setConditionViewModeState] = useState<ConditionViewMode>(loadConditionViewMode);
  const [conditionFocusPath, setConditionFocusPath] = useState<number[] | null>(null);
  const [dragging, setDragging] = useState<{ id: string; parentKey: string } | null>(null);
  const [dropTarget, setDropTarget] = useState<{ parentKey: string; index: number } | null>(null);

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
    (step: WorkflowStep): IconType => {
      if (step.type === 'Condition') return RiGitBranchLine;
      if (step.type === 'Loop') return RiLoopLeftLine;
      return getStepIcon(step.stepDefinitionId);
    },
    [getStepIcon],
  );

  const flatSteps = useMemo(() => flattenSteps(workflow?.steps ?? []), [workflow]);

  const getStepById = useCallback(
    (id: string): WorkflowStep | undefined => flatSteps.find((s) => s.id === id),
    [flatSteps],
  );

  // Os campos declarados pelo tenant já vêm na entidade resolvida — não há lista dinâmica à parte.
  const eventFields = useMemo(() => {
    if (!workflow) return [];
    if (isCalledEventName(workflow.eventName)) return workflowParametersToFieldOptions(workflow.parameters, ctx);
    return getWorkflowEventFields(workflow.eventName, ctx);
  }, [workflow, ctx]);

  // Se o eventName gravado não corresponde a nenhum evento do catálogo atual (ex: automação
  // criada antes de uma renomeação de evento), os pickers de "Do evento" não têm o que listar
  // e caem para texto livre — este flag avisa o usuário na aba Geral para escolher de novo.
  const eventNameOptions = useMemo(() => buildEventNameOptions(ctx), [ctx]);

  const isEventNameRecognized = useMemo(
    () => !workflow || eventNameOptions.some((option) => option.value === workflow.eventName),
    [workflow, eventNameOptions],
  );

  /**
   * O identificador que a automação terá. Só é editável na criação: as Ações e os pacotes guardam
   * esse nome, e trocá-lo depois faria todos deixarem de encontrá-la.
   */
  const takenWorkflowIds = useMemo(() => new Set(workflows.map((w) => w.id)), [workflows]);

  const suggestedWorkflowId = useMemo(
    () => (formData.name.trim() ? deriveWorkflowId(formData.name, takenWorkflowIds) : ''),
    [formData.name, takenWorkflowIds],
  );

  const workflowIdError = useMemo(
    () => (isNew && formData.workflowId.trim()
      ? workflowIdIssue(formData.workflowId, takenWorkflowIds)
      : undefined),
    [isNew, formData.workflowId, takenWorkflowIds],
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
    const eventCollection = eventNameToEntityKey(formData.eventName, ctx);
    const eventScreen = eventCollection ? getDefinition(eventCollection) : undefined;
    if (eventScreen) return getScreenIconType(eventScreen.icon);
    if (isLookupEvent && formData.lookupCollection) {
      const entry = WORKFLOW_LOOKUP_COLLECTIONS.find((e) => e.collection === formData.lookupCollection);
      if (entry) return getWorkflowLookupGroupIcon(entry.group);
    }
    return getWorkflowEventIcon(formData.eventName);
  }, [formData.eventName, formData.lookupCollection, isLookupEvent, getDefinition, ctx]);

  const handleSaveGeneral = useCallback(async () => {
    if (!currentTenant) return;
    setIsSaving(true);
    try {
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
        };
        if (formData.description) createData.description = formData.description;
        if (lookupCollection) createData.lookupCollection = lookupCollection;
        if (parameters) createData.parameters = parameters;

        const chosenId = formData.workflowId.trim() || deriveWorkflowId(formData.name, takenWorkflowIds);
        const created = await createWorkflow(createData as Parameters<typeof createWorkflow>[0], chosenId);
        notify('Automação criada.', 'success');
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(`view-workflow:${created.id}`);
      } else if (workflow) {
        const updateData: Record<string, unknown> = {
          name: formData.name,
          eventName: formData.eventName,
          parameters: parameters ?? [],
        };
        if (formData.description) updateData.description = formData.description;
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
  }, [takenWorkflowIds, currentTenant, isNew, formData, isLookupEvent, isCalledEvent, cloneSource, createWorkflow, updateWorkflow, workflow, notify, closeTab, tabKey, activePanelId, openTab]);

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
    if (target.kind === 'loop') return `:addloop:${target.loopId}`;
    return `:add:${target.conditionId}:${target.branch}`;
  }, []);

  const openAddStep = useCallback((target?: InsertTarget, index?: number) => {
    if (!workflow) return;
    const at = index !== undefined ? `:at:${index}` : '';
    openTab(`edit-workflow-step:${workflow.id}${targetSuffix(target)}${at}`);
  }, [workflow, openTab, targetSuffix]);

  const openAddCondition = useCallback(async (target?: InsertTarget, index?: number) => {
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
    const location = target ?? { kind: 'root' };
    const nextSteps = index !== undefined
      ? insertStepAtIndex(workflow.steps, location, conditionStep, index)
      : insertStepInto(workflow.steps, location, conditionStep);
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] openAddCondition:', error);
      notify('Erro ao adicionar condição.', 'error');
    });
  }, [workflow, updateWorkflowSteps, notify]);

  const openAddLoop = useCallback(async (target?: InsertTarget, index?: number) => {
    if (!workflow) return;
    const loopStep: WorkflowStep = {
      id: crypto.randomUUID(),
      stepDefinitionId: '',
      type: 'Loop',
      order: 0,
      configuration: {},
      enabled: true,
      loop: {
        source: { kind: 'Expression', expression: '' },
        itemName: 'item',
        outputName: 'itens',
        body: [],
      },
    };
    const location = target ?? { kind: 'root' };
    const nextSteps = index !== undefined
      ? insertStepAtIndex(workflow.steps, location, loopStep, index)
      : insertStepInto(workflow.steps, location, loopStep);
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] openAddLoop:', error);
      notify('Erro ao adicionar repetição.', 'error');
    });
  }, [workflow, updateWorkflowSteps, notify]);

  const toggleLoopCollapsed = useCallback((loopId: string) => {
    setCollapsedLoopIds((prev) => {
      const next = new Set(prev);
      if (next.has(loopId)) next.delete(loopId);
      else next.add(loopId);
      return next;
    });
  }, []);

  const isLoopCollapsed = useCallback((loopId: string) => collapsedLoopIds.has(loopId), [collapsedLoopIds]);

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
    return eventNameOptions.find((option) => option.value === workflow.eventName)?.label ?? workflow.eventName;
  }, [workflow, eventNameOptions]);

  const getStepTypeLabel = useCallback((step: WorkflowStep): string => {
    if (step.type === 'Condition') return 'Condição';
    if (step.type === 'Loop') return 'Repetição';
    const definition = getStepDefinition(step.stepDefinitionId);
    if (!definition) return step.stepDefinitionId;
    const categoryLabel = STEP_CATEGORY_LABELS[definition.category] ?? definition.category;
    return getStepDisplayName(step, definition) === definition.name
      ? categoryLabel
      : `${categoryLabel} · ${definition.name}`;
  }, [getStepDefinition]);

  const getConditionSummary = useCallback((step: WorkflowStep): string => describeCondition(step.condition), []);

  const getLoopSummary = useCallback((step: WorkflowStep): string => {
    if (!step.loop) return 'Para cada item';
    return `Para cada item → ${step.loop.outputName}`;
  }, []);

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
    event.stopPropagation();
    setDropTarget({ parentKey, index: gapIndex });
  }, []);

  const handleStepDragOverNode = useCallback((event: DragEvent<HTMLElement>, parentKey: string, index: number) => {
    event.preventDefault();
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setDropTarget({ parentKey, index: event.clientY < rect.top + rect.height / 2 ? index : index + 1 });
  }, []);

  const handleContainerDragOver = useCallback((event: DragEvent<HTMLElement>, parentKey: string, endIndex: number) => {
    event.preventDefault();
    event.stopPropagation();
    setDropTarget({ parentKey, index: endIndex });
  }, []);

  const handleStepDrop = useCallback((event: DragEvent<HTMLElement>) => {
    event.preventDefault();
    event.stopPropagation();
    const dragged = dragging;
    const target = dropTarget;
    setDragging(null);
    setDropTarget(null);
    if (!workflow || !dragged || !target) return;
    // Mesmo nível → reordena; nível diferente → move para dentro do Loop/Condição (ou de volta à raiz).
    const nextSteps = dragged.parentKey === target.parentKey
      ? reorderSiblings(workflow.steps, dragged.id, target.index)
      : moveStepToLocation(workflow.steps, dragged.id, parseParentKey(target.parentKey), target.index);
    if (nextSteps === workflow.steps) return;
    updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] handleStepDrop:', error);
      notify('Erro ao mover step.', 'error');
    });
  }, [dragging, dropTarget, workflow, updateWorkflowSteps, notify]);

  const getStepLogStatus = useCallback((log: { level: string }): 'SUCCESS' | 'ERROR' | 'WARN' | 'INFO' => {
    if (log.level === 'ERROR') return 'ERROR';
    if (log.level === 'SUCCESS') return 'SUCCESS';
    if (log.level === 'WARN') return 'WARN';
    return 'INFO';
  }, []);

  const canRunWorkflow = useMemo(
    () => !!workflow && isCalledEventName(workflow.eventName),
    [workflow],
  );

  const runWorkflowDisabledReason = useMemo(() => {
    if (!workflow) return 'Salve a automação antes de executar.';
    if (!isCalledEventName(workflow.eventName)) {
      return 'Só automações do tipo "Chamada por outro workflow" podem ser executadas aqui.';
    }
    return null;
  }, [workflow]);

  const runModalParameters = useMemo(() => workflow?.parameters ?? [], [workflow]);

  const openRunModal = useCallback(() => setRunModalOpen(true), []);
  const closeRunModal = useCallback(() => setRunModalOpen(false), []);

  const runWorkflowForModal = useCallback(
    async (providedParams: Record<string, unknown>): Promise<RunModalResult> => {
      if (!currentTenant || !workflow) {
        return { status: 'FAILED', outputs: null, logs: [], error: 'Automação não encontrada.' };
      }
      const tenantId = currentTenant.id;
      const targetWorkflowId = workflow.id;

      let eventId: string;
      try {
        const res = await dataProcessorRepository.runWorkflow({ tenantId, targetWorkflowId, providedParams });
        eventId = res.eventId;
      } catch (error) {
        return {
          status: 'FAILED',
          outputs: null,
          logs: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }

      return new Promise<RunModalResult>((resolve) => {
        let settled = false;
        let unsub: (() => void) | null = null;
        let timer: ReturnType<typeof setTimeout> | null = null;
        const finish = (result: RunModalResult): void => {
          if (settled) return;
          settled = true;
          if (timer) clearTimeout(timer);
          if (unsub) unsub();
          resolve(result);
        };
        unsub = workflowExecutionRepository.subscribeToWorkflowExecutions(
          tenantId,
          targetWorkflowId,
          (execs) => {
            const exec = execs.find((e) => e.eventId === eventId);
            if (!exec || exec.status === 'RUNNING') return;
            finish(mapExecutionToRunResult(exec));
          },
          (error) =>
            finish({
              status: 'FAILED',
              outputs: null,
              logs: [],
              error: `Não foi possível acompanhar a execução: ${error.message}`,
            }),
        );
        timer = setTimeout(
          () =>
            finish({
              status: 'FAILED',
              outputs: null,
              logs: [],
              error: 'Tempo esgotado ao aguardar a execução. Confira na aba Execuções.',
            }),
          RUN_EXECUTION_TIMEOUT_MS,
        );
      });
    },
    [currentTenant, workflow, dataProcessorRepository, workflowExecutionRepository],
  );

  return {
    isNew,
    workflowIdValue: workflowId,
    suggestedWorkflowId,
    workflowIdError,
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
    openAddLoop,
    toggleLoopCollapsed,
    isLoopCollapsed,
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
    getLoopSummary,
    draggingStepId: dragging?.id ?? null,
    dropTarget,
    handleStepDragStart,
    handleStepDragEnd,
    handleStepDragOverNode,
    handleStepDragOverGap,
    handleContainerDragOver,
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
    eventNameOptions,
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
    canRunWorkflow,
    runWorkflowDisabledReason,
    runModalOpen,
    runModalParameters,
    openRunModal,
    closeRunModal,
    runWorkflowForModal,
  };
};
