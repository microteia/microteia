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
import { WORKFLOW_CALLED_EVENT, buildWorkflowEventCatalog, getWorkflowEventFields, eventNameToEntityKey, resolveEventCatalogLabel, workflowParametersToFieldOptions } from '../../../domain/services/workflowEventCatalog';
import type { SchemaContext } from '../../../domain/schema/pathResolver';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useT, useLabel } from '../../shared/i18n/useT';
import { useOptionalLocale } from '../../../stores/useLocale';
import { formatDateFor } from '../../../domain/schema/i18n/localeFormat';
import { useEntityReferenceOptions, useLookupCollectionOptions } from '../../shared/useParameterOptions';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import { WORKFLOW_LOOKUP_COLLECTIONS } from '../../../domain/services/workflowLookupCatalog';
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
  canPlaceStep,
  findStepInTree,
  suggestStepIdentifier,
} from '../../shared/workflowHelpers';
import type { InsertTarget } from '../../shared/workflowHelpers';
import type { WorkflowDefinition, WorkflowExecution, WorkflowStep, Condition, WorkflowParameter } from '../../../domain/entities/Workflow';
import type { RunModalFollow, RunModalResult } from '../../components/ui/RunModal';
import { followWorkflowExecution } from '../../shared/followWorkflowExecution';
import type { StepDefinitionSummary, StepCategory } from '../../../domain/entities/WorkflowStepCatalog';
import { artifactIdIssue, deriveArtifactIdUnderPrefix } from '../../../domain/services/artifactIdentity';
import { withArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';
import { useArtifactPrefix } from '../../shared/settings/useArtifactPrefix';
import {
  DEFAULT_DATE_REACHED_AT,
  WORKFLOW_SCHEDULE_EVENT,
  dateReachedCron,
  dateReachedIssues,
  dateReachedPrefix,
  nextCronOccurrence,
  nextCronOccurrences,
  parseCron,
  parseOffsetDays,
  scheduleIssues,
  scheduleTimeZone,
} from '../../../domain/schema/workflowClock';
import type { WorkflowClockStatus, WorkflowDateReached, WorkflowSchedule } from '../../../domain/schema/workflowClock';
import { buildWorkflowClockInfo } from '../../shared/workflowClockInfo';
import { entityDateFieldKeys, eventEntity } from '../../../domain/schema/eventCatalog';
import { isStepExcludedFromTrigger } from '../../../domain/schema/workflowStepCatalog';
import { resolveOfficeTimeZone, timeZoneOptions } from '../../../domain/schema/i18n/timeZone';
import { useSettings } from '../../../stores/useSettings';

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

/** A categoria vira CHAVE: o mapa é de módulo e quem renderiza é que traduz. */
const STEP_CATEGORY_KEYS: Record<StepCategory, string> = {
  Action: 'step.category.action',
  Data: 'step.category.data',
  Notification: 'step.category.notification',
  Integration: 'step.category.integration',
};

const isLookupEventName = (eventName: string): boolean => eventName.startsWith('lookup.');
const isCalledEventName = (eventName: string): boolean => eventName === WORKFLOW_CALLED_EVENT;
const isScheduleEventName = (eventName: string): boolean => eventName === WORKFLOW_SCHEDULE_EVENT;

const SCHEDULE_PREVIEW_COUNT = 3;

export const PARAMETER_TYPE_OPTIONS: { value: WorkflowParameter['type']; labelKey: string }[] = [
  { value: 'String', labelKey: 'parameter.type.string' },
  { value: 'Number', labelKey: 'parameter.type.number' },
  { value: 'Date', labelKey: 'parameter.type.date' },
  { value: 'Boolean', labelKey: 'parameter.type.boolean' },
  { value: 'select', labelKey: 'parameter.type.select' },
  { value: 'lookup', labelKey: 'parameter.type.lookup' },
  { value: 'EntityReference', labelKey: 'parameter.type.entity-reference' },
  { value: 'Object', labelKey: 'parameter.type.object' },
];

export interface WorkflowFormData {
  /** Identificador escolhido na criação. Em branco, é derivado do nome ao salvar. */
  workflowId: string;
  name: string;
  description: string;
  eventName: string;
  lookupCollection: string;
  parameters: WorkflowParameter[];
  scheduleCron: string;
  /** Vazio = o fuso do escritório. */
  scheduleTimeZone: string;
  dateField: string;
  /** Dias em relação à data, como o campo numérico os guarda: `-3`, `0`, `1`. */
  dateOffsetDays: string;
  dateAt: string;
}

const sanitizeParameters = sanitizeWorkflowParameters;

const buildForm = (w: WorkflowDefinition | null): WorkflowFormData => ({
  workflowId: '',
  name: w?.name ?? '',
  description: w?.description ?? '',
  eventName: w?.eventName ?? '',
  lookupCollection: w?.lookupCollection ?? '',
  parameters: w?.parameters ?? [],
  scheduleCron: w?.schedule?.cron ?? '',
  scheduleTimeZone: w?.schedule?.timeZone ?? '',
  dateField: w?.dateReached?.field ?? '',
  dateOffsetDays: String(parseOffsetDays(w?.dateReached?.offset) ?? 0),
  dateAt: w?.dateReached?.at ?? DEFAULT_DATE_REACHED_AT,
});

/** `-3` → `-3d`, `0` → `0d`, `1` → `+1d`. O que não é inteiro sai como veio, para a validação recusar. */
const offsetOf = (days: string): string => {
  const trimmed = days.trim();
  if (!/^[+-]?\d+$/.test(trimmed)) return trimmed;
  const value = Number(trimmed);
  return value > 0 ? `+${value}d` : `${value}d`;
};

const dateReachedOf = (formData: WorkflowFormData): WorkflowDateReached => ({
  field: formData.dateField,
  offset: offsetOf(formData.dateOffsetDays),
  at: formData.dateAt || DEFAULT_DATE_REACHED_AT,
});

const scheduleOf = (formData: WorkflowFormData): WorkflowSchedule => ({
  cron: formData.scheduleCron.trim(),
  ...(formData.scheduleTimeZone ? { timeZone: formData.scheduleTimeZone } : {}),
});

/**
 * Opções de gatilho do tenant: os eventos fixos mais um par por tela do Form Design ou de extensão.
 * Depende do contexto de schema porque as telas do tenant são DADO, não código.
 */
export const buildEventNameOptions = (
  label: (value: string, params?: Record<string, unknown>) => string,
  ctx: SchemaContext,
) =>
  buildWorkflowEventCatalog(ctx).map((entry) => ({
    value: entry.name,
    label: resolveEventCatalogLabel(label, entry),
    icon: getWorkflowEventIcon(entry.name),
  }));

/**
 * Era uma const de MÓDULO, e por isso o rótulo tinha de ser texto pronto — não há hook fora do
 * componente. Passou a ser função do resolvedor, e a tela a memoriza: é o que permite a lista do
 * kernel ter rótulo composto por referência como qualquer outra.
 */
export const buildLookupCollectionOptions = (
  label: (value: string, params?: Record<string, string>) => string,
) =>
  WORKFLOW_LOOKUP_COLLECTIONS.map((entry) => ({
    value: entry.collection,
    label: label('@core.data/lookup.qualified', { screen: entry.screenLabel, entity: entry.entityLabel }),
    icon: getWorkflowLookupGroupIcon(entry.group),
  }));

export interface ViewWorkflowViewModel {
  isNew: boolean;
  /** Identificador da automação já criada — o que as Ações guardam. */
  workflowIdValue: string;
  /** O prefixo do escritório, fixo à frente do id na criação; `null` sem prefixo. */
  artifactPrefix: string | null;
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
  lookupCollectionOptions: { value: string; label: string; icon: IconType }[];
  isLookupEvent: boolean;
  isLookupCollectionRecognized: boolean;
  isCalledEvent: boolean;
  isScheduleEvent: boolean;
  /** O que está errado no horário, já no idioma de quem lê — `null` quando ele está bom. */
  scheduleError: string | null;
  /** As próximas execuções que o horário pede, no fuso em que ele roda. */
  schedulePreview: string[];
  scheduleTimeZoneOptions: { value: string; label: string }[];
  /**
   * O relógio do SERVIDOR para esta automação: o próximo disparo gravado, o último (ou o motivo de ter
   * sido pulado) e o aviso quando ele discorda da declaração salva. `null` fora dos gatilhos temporais.
   */
  clockInfo: { warning: string | null; lines: string[]; lastRunEventId: string | null } | null;
  /** Abre, na aba de execuções, a execução que nasceu do último disparo do relógio. */
  openLastClockRun: () => void;
  isDateReachedEvent: boolean;
  /** Os campos de data da tela do gatilho. */
  dateFieldOptions: { value: string; label: string }[];
  dateReachedError: string | null;
  /** Passos já presentes que o gatilho escolhido não aceita. Bloqueia o salvar. */
  triggerStepsError: string | null;
  parameterEntityOptions: { value: string; label: string }[];
  parameterLookupOptions: { value: string; label: string }[];
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
  nameOf: (workflow: WorkflowDefinition | null) => string;
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
  runWorkflowForModal: (providedParams: Record<string, unknown>, follow: RunModalFollow) => Promise<RunModalResult>;
  openRunExecution: (eventId: string) => void;
}

const RUN_EXECUTION_WAIT_MS = 60000;

/** Esta é a execução que acabou de rodar, ainda não passada pela resolução da assinatura. */
const mapExecutionToRunResult = (
  exec: WorkflowExecution,
  resolve: (message: string, params?: Record<string, string>) => string,
): RunModalResult => {
  const lastError = [...exec.logs].reverse().find((entry) => entry.level === 'ERROR');
  return {
    status: exec.status === 'RUNNING' ? null : exec.status,
    outputs: exec.outputs ?? null,
    logs: exec.logs.map((entry) => ({
      level: entry.level,
      message: resolve(entry.message, entry.messageParams),
    })),
    error: exec.status === 'SUCCESS'
      ? null
      : lastError
        ? resolve(lastError.message, lastError.messageParams)
        : null,
  };
}

const CLONE_PREFIX = 'new-workflow:clone:';

const CLOCK_REFRESH_MS = 30_000;

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
  const { workflowExecutionRepository, workflowClockRepository, dataProcessorRepository } = useDI();
  const { getDefinition } = useScreenDefinitions();
  const ctx = useSchemaContext();
  const tUi = useT('core.ui');
  const label = useLabel();
  const t = useT('core.automation');
  const { locale } = useOptionalLocale();
  const { stepCatalog, loadCatalog } = useStepCatalog();

  const nameOf = useCallback(
    (candidate: WorkflowDefinition | null) => label(candidate?.name),
    [label],
  );

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
    if (workflow) setTabTitle(tabKey, label(workflow.name) || t('workflow.untitled'));
  }, [workflow, tabKey, setTabTitle, t, label]);

  useEffect(() => {
    if (!currentTenant || isNew) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- limpa erro anterior ao trocar de workflow/tenant
    setExecutionsError(null);
    return workflowExecutionRepository.subscribeToWorkflowExecutions(
      currentTenant.id,
      workflowId,
      (newExecutions) => {
        // A mensagem de cada log vem do motor como REFERÊNCIA. Resolver na chegada, e não em cada
        // ponto que exibe, deixa a aba inteira lendo texto pronto.
        setExecutions(newExecutions.map((execution) => ({
          ...execution,
          logs: execution.logs.map((entry) => ({
            ...entry,
            message: label(entry.message, entry.messageParams),
          })),
        })));
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
  }, [currentTenant, isNew, workflowId, workflowExecutionRepository, label]);

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
  const eventNameOptions = useMemo(() => buildEventNameOptions(label, ctx), [ctx, label]);
  const lookupCollectionOptions = useMemo(() => buildLookupCollectionOptions(label), [label]);

  const isEventNameRecognized = useMemo(
    () => !workflow || eventNameOptions.some((option) => option.value === workflow.eventName),
    [workflow, eventNameOptions],
  );

  /**
   * O identificador que a automação terá. Só é editável na criação: as Ações e os pacotes guardam
   * esse nome, e trocá-lo depois faria todos deixarem de encontrá-la.
   */
  const takenWorkflowIds = useMemo(() => new Set(workflows.map((w) => w.id)), [workflows]);

  const artifactPrefix = useArtifactPrefix();

  const suggestedWorkflowId = useMemo(
    () => (formData.name.trim() ? deriveArtifactIdUnderPrefix(artifactPrefix, formData.name, takenWorkflowIds) : ''),
    [formData.name, takenWorkflowIds, artifactPrefix],
  );

  const workflowIdError = useMemo(
    () => (isNew && formData.workflowId.trim()
      ? artifactIdIssue(t, withArtifactPrefix(artifactPrefix, 'artifact', formData.workflowId), takenWorkflowIds)
      : undefined),
    [isNew, formData.workflowId, takenWorkflowIds, t, artifactPrefix],
  );

  const isLookupEvent = useMemo(() => isLookupEventName(formData.eventName), [formData.eventName]);

  // Mesma ideia de isScreenKeyRecognized, mas para a lista de lookup escolhida.
  const isLookupCollectionRecognized = useMemo(
    () => !isLookupEvent || !formData.lookupCollection || WORKFLOW_LOOKUP_COLLECTIONS.some((entry) => entry.collection === formData.lookupCollection),
    [isLookupEvent, formData.lookupCollection],
  );

  const isCalledEvent = useMemo(() => isCalledEventName(formData.eventName), [formData.eventName]);
  const isScheduleEvent = useMemo(() => isScheduleEventName(formData.eventName), [formData.eventName]);

  const { values: settingsValues } = useSettings();
  const officeTimeZone = useMemo(() => resolveOfficeTimeZone(settingsValues.tenant), [settingsValues.tenant]);

  const scheduleError = useMemo(() => {
    if (!isScheduleEvent) return null;
    const [issue] = scheduleIssues(scheduleOf(formData));
    return issue ? label(issue.message, issue.messageParams) : null;
  }, [isScheduleEvent, formData, label]);

  const schedulePreview = useMemo(() => {
    if (!isScheduleEvent || scheduleError) return [];
    const parsed = parseCron(formData.scheduleCron);
    if (!parsed) return [];
    const timeZone = scheduleTimeZone(scheduleOf(formData), officeTimeZone);
    return nextCronOccurrences(parsed, new Date(), timeZone, SCHEDULE_PREVIEW_COUNT).map((occurrence) =>
      t('workflow.schedule.preview-item', {
        when: formatDateFor(locale, occurrence, { dateStyle: 'full', timeStyle: 'short', timeZone }),
        zone: timeZone,
      }),
    );
  }, [isScheduleEvent, scheduleError, formData, officeTimeZone, locale, t]);

  const isDateReachedEvent = useMemo(() => dateReachedPrefix(formData.eventName) !== null, [formData.eventName]);

  // O gatilho que um passo já presente declara incompatível não pode ser escolhido: a troca deixaria
  // gravada uma automação que o motor recusa no primeiro passo proibido.
  const triggerStepsError = useMemo(() => {
    const steps = flattenSteps(workflow?.steps ?? cloneSource?.steps ?? []);
    const excluded = steps
      .map((step) => stepCatalog.find((definition) => definition.id === step.stepDefinitionId))
      .filter((definition): definition is StepDefinitionSummary => isStepExcludedFromTrigger(definition, formData.eventName));
    if (excluded.length === 0) return null;
    const names = [...new Set(excluded.map((definition) => label(definition.name)))];
    return t('workflow.event.excluded-steps', { steps: names.join(', ') });
  }, [workflow, cloneSource, stepCatalog, formData.eventName, label, t]);

  const dateEntity = useMemo(
    () => (isDateReachedEvent ? eventEntity(formData.eventName, ctx) : undefined),
    [isDateReachedEvent, formData.eventName, ctx],
  );

  const dateFieldOptions = useMemo(() => {
    if (!dateEntity) return [];
    const keys = entityDateFieldKeys(dateEntity);
    return dateEntity.fields
      .filter((field) => keys.includes(field.key))
      .map((field) => ({ value: field.key, label: label(field.label) }));
  }, [dateEntity, label]);

  const dateReachedError = useMemo(() => {
    if (!isDateReachedEvent) return null;
    const known = dateEntity ? entityDateFieldKeys(dateEntity) : null;
    const [issue] = dateReachedIssues(dateReachedOf(formData), known);
    return issue ? label(issue.message, issue.messageParams) : null;
  }, [isDateReachedEvent, dateEntity, formData, label]);

  const savedClockKind = useMemo<'schedule' | 'dateReached' | null>(() => {
    if (!workflow) return null;
    if (isScheduleEventName(workflow.eventName)) return 'schedule';
    return dateReachedPrefix(workflow.eventName) !== null ? 'dateReached' : null;
  }, [workflow]);

  const [clockState, setClockState] = useState<{ definitionId: string; status: WorkflowClockStatus | null } | null>(null);
  const [clockNow, setClockNow] = useState(() => new Date());

  useEffect(() => {
    if (!currentTenant || isNew || !savedClockKind) return;
    return workflowClockRepository.subscribeToClockStatus(currentTenant.id, workflowId, (status) => {
      setClockState({ definitionId: workflowId, status });
      setClockNow(new Date());
    });
  }, [currentTenant, isNew, savedClockKind, workflowId, workflowClockRepository]);

  useEffect(() => {
    if (!savedClockKind) return;
    const timer = setInterval(() => setClockNow(new Date()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, [savedClockKind]);

  const clockInfo = useMemo(() => {
    if (!workflow || !savedClockKind) return null;
    const saved = buildForm(workflow);
    const triggerPending = formData.eventName !== workflow.eventName
      || (savedClockKind === 'schedule' && JSON.stringify(scheduleOf(formData)) !== JSON.stringify(scheduleOf(saved)))
      || (savedClockKind === 'dateReached' && JSON.stringify(dateReachedOf(formData)) !== JSON.stringify(dateReachedOf(saved)));

    const expectedZone = savedClockKind === 'schedule' ? scheduleTimeZone(scheduleOf(saved), officeTimeZone) : officeTimeZone;
    const expectedCron = savedClockKind === 'schedule' ? parseCron(scheduleOf(saved).cron) : parseCron(dateReachedCron(dateReachedOf(saved)));
    const expectedAt = expectedCron ? nextCronOccurrence(expectedCron, clockNow, expectedZone) : null;

    const info = buildWorkflowClockInfo({
      kind: savedClockKind,
      enabled: workflow.enabled,
      loaded: clockState?.definitionId === workflow.id,
      status: clockState?.definitionId === workflow.id ? clockState.status : null,
      triggerPending,
      savedAt: workflow.updatedAt,
      now: clockNow,
      expected: expectedAt ? { at: expectedAt, timeZone: expectedZone } : null,
      format: (instant, zone) => t('workflow.schedule.preview-item', {
        when: formatDateFor(locale, instant, { dateStyle: 'full', timeStyle: 'medium', timeZone: zone }),
        zone,
      }),
    });
    if (!info) return null;
    return {
      warning: info.warning ? label(info.warning.message, info.warning.messageParams) : null,
      lines: info.lines.map((line) => label(line.message, line.messageParams)),
      lastRunEventId: info.lastRunEventId,
    };
  }, [workflow, savedClockKind, formData, officeTimeZone, clockState, clockNow, locale, t, label]);

  const scheduleTimeZoneOptions = useMemo(
    () => [
      { value: '', label: t('workflow.schedule.time-zone.office', { zone: officeTimeZone }) },
      ...timeZoneOptions().map((zone) => ({ value: zone, label: zone })),
    ],
    [officeTimeZone, t],
  );

  const parameterEntityOptions = useEntityReferenceOptions();
  const parameterLookupOptions = useLookupCollectionOptions();

  const parameterErrors = useMemo<(string | undefined)[]>(
    () => (isCalledEvent ? siblingParameterErrors(formData.parameters).map((issue) => (issue ? label(issue.message, issue.messageParams) : undefined)) : []),
    [isCalledEvent, formData.parameters, label],
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
      const schedule = isScheduleEvent ? scheduleOf(formData) : undefined;
      const dateReached = isDateReachedEvent ? dateReachedOf(formData) : undefined;

      if (isNew) {
        const createData: Record<string, unknown> = {
          name: formData.name,
          eventName: formData.eventName,
          enabled: true,
          version: 1,
          condition: { kind: 'AlwaysTrue' },
          // O id do Step é único DENTRO da automação, e é o nome pelo qual as expressões o chamam
          // (`output.buscarProcesso`). Reidentificar na cópia apagava justamente esse vínculo — e só
          // reidentificava os Steps de topo, deixando os de dentro de uma Condição apontando para
          // ids que não existiam mais. A cópia preserva os ids.
          steps: cloneSource ? cloneSource.steps : [],
        };
        if (formData.description) createData.description = formData.description;
        if (lookupCollection) createData.lookupCollection = lookupCollection;
        if (parameters) createData.parameters = parameters;
        if (schedule) createData.schedule = schedule;
        if (dateReached) createData.dateReached = dateReached;

        const chosenId = withArtifactPrefix(
          artifactPrefix,
          'artifact',
          formData.workflowId.trim() || deriveArtifactIdUnderPrefix(artifactPrefix, formData.name, takenWorkflowIds),
        );
        const created = await createWorkflow(createData as Parameters<typeof createWorkflow>[0], chosenId);
        notify(t('workflow.created'), 'success');
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
        if (schedule) updateData.schedule = schedule;
        if (dateReached) updateData.dateReached = dateReached;

        await updateWorkflow(workflow.id, updateData as Parameters<typeof updateWorkflow>[1]);
        notify(t('workflow.saved'), 'success');
      }
    } catch (error) {
      console.error('[ViewWorkflow] handleSaveGeneral:', error);
      notify(t('workflow.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [takenWorkflowIds, artifactPrefix, currentTenant, isNew, formData, isLookupEvent, isCalledEvent, isScheduleEvent, isDateReachedEvent, cloneSource, createWorkflow, updateWorkflow, workflow, notify, closeTab, tabKey, activePanelId, openTab, t]);

  const toggleEnabled = useCallback(() => {
    if (!workflow) return;
    const next = !workflow.enabled;
    updateWorkflow(workflow.id, { enabled: next })
      .then(() => notify(t(next ? 'workflow.activated' : 'workflow.deactivated'), 'success'))
      .catch((error) => {
        console.error('[ViewWorkflow] toggleEnabled:', error);
        notify(t('workflow.status-change-failed'), 'error');
      });
  }, [workflow, updateWorkflow, notify, t]);

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
      notify(t('condition.saved'), 'success');
    } catch (error) {
      console.error('[ViewWorkflow] handleSaveCondition:', error);
      notify(t('condition.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [workflow, conditionChanged, pendingCondition, updateWorkflow, notify, t]);

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
      notify(t('workflow.deleted'), 'success');
      closeTab(tabKey, activePanelId);
    } catch (error) {
      console.error('[ViewWorkflow] confirmDeleteWorkflow:', error);
      notify(t('workflow.delete-failed'), 'error');
    } finally {
      setWorkflowToDelete(null);
    }
  }, [workflowToDelete, deleteWorkflow, notify, closeTab, tabKey, activePanelId, t]);

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
      id: suggestStepIdentifier(workflow.steps, 'condicao'),
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
      notify(t('condition.add-failed'), 'error');
    });
  }, [workflow, updateWorkflowSteps, notify, t]);

  const openAddLoop = useCallback(async (target?: InsertTarget, index?: number) => {
    if (!workflow) return;
    const loopStep: WorkflowStep = {
      id: suggestStepIdentifier(workflow.steps, 'repeticao'),
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
      notify(t('loop.add-failed'), 'error');
    });
  }, [workflow, updateWorkflowSteps, notify, t]);

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
      notify(t('step.deleted'), 'success');
    } catch (error) {
      console.error('[ViewWorkflow] confirmDeleteStep:', error);
      notify(t('step.delete-failed'), 'error');
    } finally {
      setStepToDelete(null);
    }
  }, [workflow, stepToDelete, updateWorkflowSteps, notify, t]);

  const moveStep = useCallback(async (step: WorkflowStep, direction: 'up' | 'down') => {
    if (!workflow) return;
    const nextSteps = moveStepWithinSiblings(workflow.steps, step.id, direction);
    if (nextSteps === workflow.steps) return;
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] moveStep:', error);
      notify(t('step.reorder-failed'), 'error');
    });
  }, [workflow, updateWorkflowSteps, notify, t]);

  const toggleStepEnabled = useCallback(async (step: WorkflowStep) => {
    if (!workflow) return;
    const nextSteps = updateStepInTree(workflow.steps, step.id, (s) => ({ ...s, enabled: !s.enabled }));
    await updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] toggleStepEnabled:', error);
      notify(t('step.update-failed'), 'error');
    });
  }, [workflow, updateWorkflowSteps, notify, t]);

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
    if (step.type === 'Condition') return t('step.type.condition');
    if (step.type === 'Loop') return t('step.type.loop');
    const definition = getStepDefinition(step.stepDefinitionId);
    if (!definition) return step.stepDefinitionId;
    const categoryLabel = t(STEP_CATEGORY_KEYS[definition.category] ?? definition.category);
    return getStepDisplayName(t, step, definition) === definition.name
      ? categoryLabel
      : `${categoryLabel} · ${definition.name}`;
  }, [getStepDefinition, t]);

  const getConditionSummary = useCallback((step: WorkflowStep): string => describeCondition(tUi, step.condition), [tUi]);

  const getLoopSummary = useCallback((step: WorkflowStep): string => {
    if (!step.loop) return t('loop.summary');
    return t('loop.summary.named', { output: step.loop.outputName });
  }, [t]);

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
    const moving = findStepInTree(workflow.steps, dragged.id);
    if (moving && !canPlaceStep(moving, parseParentKey(target.parentKey))) {
      notify(t('step.delay.top-level-only'), 'warning');
      return;
    }
    // Mesmo nível → reordena; nível diferente → move para dentro do Loop/Condição (ou de volta à raiz).
    const nextSteps = dragged.parentKey === target.parentKey
      ? reorderSiblings(workflow.steps, dragged.id, target.index)
      : moveStepToLocation(workflow.steps, dragged.id, parseParentKey(target.parentKey), target.index);
    if (nextSteps === workflow.steps) return;
    updateWorkflowSteps(workflow.id, nextSteps).catch((error) => {
      console.error('[ViewWorkflow] handleStepDrop:', error);
      notify(t('step.move-failed'), 'error');
    });
  }, [dragging, dropTarget, workflow, updateWorkflowSteps, notify, t]);

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
    if (!workflow) return t('workflow.run.save-first');
    if (!isCalledEventName(workflow.eventName)) {
      return t('workflow.run.only-callable');
    }
    return null;
  }, [workflow, t]);

  const runModalParameters = useMemo(() => workflow?.parameters ?? [], [workflow]);

  const openRunModal = useCallback(() => setRunModalOpen(true), []);
  const closeRunModal = useCallback(() => setRunModalOpen(false), []);

  const openRunExecution = useCallback((eventId: string) => {
    setRunModalOpen(false);
    setActiveTab('executions');
    const target = executions.find((execution) => execution.eventId === eventId);
    if (target) setExpandedExecutionOutputs((prev) => new Set(prev).add(target.id));
  }, [executions]);

  const openLastClockRun = useCallback(() => {
    if (clockInfo?.lastRunEventId) openRunExecution(clockInfo.lastRunEventId);
  }, [clockInfo, openRunExecution]);

  const runWorkflowForModal = useCallback(
    async (providedParams: Record<string, unknown>, follow: RunModalFollow): Promise<RunModalResult> => {
      if (!currentTenant || !workflow) {
        return { status: 'FAILED', outputs: null, logs: [], error: t('workflow.not-found') };
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
        let answered = false;
        const deliver = (result: RunModalResult): void => {
          if (answered) {
            follow.update(result);
            return;
          }
          answered = true;
          resolve(result);
        };
        const stop = followWorkflowExecution(
          (onUpdate, onError) => workflowExecutionRepository.subscribeToWorkflowExecutions(
            tenantId,
            targetWorkflowId,
            onUpdate,
            onError,
          ),
          eventId,
          RUN_EXECUTION_WAIT_MS,
          (event) => {
            if (event.kind === 'finished') {
              deliver({ ...mapExecutionToRunResult(event.execution, label), executionId: eventId });
            } else if (event.kind === 'still-running') {
              deliver({
                status: 'WAITING',
                outputs: null,
                logs: [],
                error: null,
                notice: t('workflow.run.still-running'),
                executionId: eventId,
              });
            } else {
              deliver({
                status: 'UNTRACKED',
                outputs: null,
                logs: [],
                error: null,
                notice: t('workflow.run.watch-failed', { detail: event.error.message }),
                executionId: eventId,
              });
            }
          },
        );
        if (follow.signal.aborted) stop();
        else follow.signal.addEventListener('abort', stop, { once: true });
      });
    },
    [currentTenant, workflow, dataProcessorRepository, workflowExecutionRepository, t, label],
  );

  return {
    isNew,
    workflowIdValue: workflowId,
    artifactPrefix,
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
    lookupCollectionOptions,
    isLookupEvent,
    isLookupCollectionRecognized,
    isCalledEvent,
    isScheduleEvent,
    scheduleError,
    schedulePreview,
    scheduleTimeZoneOptions,
    clockInfo,
    openLastClockRun,
    isDateReachedEvent,
    dateFieldOptions,
    dateReachedError,
    triggerStepsError,
    parameterEntityOptions,
    parameterLookupOptions,
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
    nameOf,
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
    openRunExecution,
    closeRunModal,
    runWorkflowForModal,
  };
};
