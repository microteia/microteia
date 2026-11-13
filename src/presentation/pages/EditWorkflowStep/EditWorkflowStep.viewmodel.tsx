import { useState, useMemo, useCallback, useEffect } from 'react';
import { PAGED_LOOP_DEFAULT_PAGE_SIZE, PAGED_LOOP_MAX_PAGE_SIZE, pagedLoopPageSize } from '../../../domain/schema/workflowLoopQuery';
import type { IconType } from 'react-icons';
import { useTenant } from '../../../stores/useTenant';
import { useAuthorization } from '../../../stores/useAuthorization';
import { useDI } from '../../../infrastructure/di/useDI';
import { makeGetAIConnectionsUseCase } from '../../../domain/usecases/aiconnections/GetAIConnectionsUseCase';
import { findByArtifactRef } from '../../../domain/services/artifactLookup';
import type { ArtifactRefOwner } from '../../../domain/services/artifactLookup';
import { artifactRefTarget } from '../../shared/artifactRefTarget';
import type { AIConnection } from '../../../domain/entities';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useScriptStore } from '../../../stores/useScriptStore';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useSchemaContext } from '../../shared/useSchemaContext';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { screenDataCollection } from '../../../domain/schema/tenantCollections';
import { useStepCatalog } from '../../../stores/useStepCatalog';
import { getWorkflowEventFields, WORKFLOW_CALLED_EVENT, workflowEventRoot, workflowParametersToFieldOptions } from '../../../domain/services/workflowEventCatalog';
import { buildWorkflowEventCatalog, isParameterRootedEvent, resolveEventCatalogLabel, workflowParameterToNativeField } from '../../../domain/schema/eventCatalog';
import type { PathRoot } from '../../../domain/schema/pathResolver';
import type { NativeFieldSpec } from '../../../domain/schema/entityRegistry';
import { getStepIcon } from '../../shared/stepIcons';
import { flattenParameterInputs, parameterForDisplay } from '../../shared/parameterInputs';
import {
  getStepDisplayName,
  findStepInTree,
  collectPriorSteps,
  collectPriorStepsForInsert,
  insertStepInto,
  insertStepAtIndex,
  replaceStepInTree,
  removeStepFromTree,
  returningStepsOf,
  isReferenceableStepId,
  suggestStepIdentifier,
  stepIdentifierIssue,
} from '../../shared/workflowHelpers';
import type { InsertTarget, BranchKey } from '../../shared/workflowHelpers';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import type {
  Condition,
  InputMapping,
  WorkflowParameter,
  WorkflowStep,
  WorkflowStepErrorPolicy,
  WorkflowSwitchCase,
  WorkflowParallelBranch,
} from '../../../domain/entities/Workflow';
import { MAX_STEP_RETRIES } from '../../../domain/entities/Workflow';
import { nextSwitchCaseId } from '../../shared/workflowHelpers';
import { MAX_LOOP_CONCURRENCY, MAX_PARALLEL_BRANCHES, MIN_PARALLEL_BRANCHES, loopConcurrencyOf, nextParallelBranchId } from '../../../domain/schema/workflowParallel';
import type {
  InputDefinition,
  InputPickerKind,
  StepDefinitionSummary,
} from '../../../domain/entities/WorkflowStepCatalog';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import {
  HTTP_CALLBACK_RESPONSE_PARAM,
  httpSampleFields,
  httpSamplePaths,
  isAsyncHttpSpec,
  isHttpOutputOfMode,
} from '../../../domain/schema/httpRequestSpec';
import type { HttpRequestSpec, HttpSampleField } from '../../../domain/schema/httpRequestSpec';
import type { StepOutputField, WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';

import { useT, useLabel, type TranslateFn } from '../../shared/i18n/useT';
import { isPausingStepDefinition, isStepExcludedFromTrigger, inputsForTemplateSource } from '../../../domain/schema/workflowStepCatalog';
import { useResolvedDocumentTemplates } from '../../shared/documents/useResolvedDocumentTemplates';
import { useReportDefinitions } from '../../../stores/useReportDefinitions';
import { reportPromptParameters } from '../../../domain/schema/report/reportStep';
import { isRecordEventName } from '../../../domain/schema/workflowWait';
import { isPayloadTemplate, isSingleRecordParameter } from '../../../domain/schema/document/documentTemplate';

const queryProjectionOutputs = (
  t: TranslateFn,
  step: WorkflowStep,
  definition: StepDefinitionSummary,
): { id: string; label: string }[] => {
  if (definition.dynamicOutputs?.kind !== 'from-query-projections') return [];
  const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
  if (!mapping || mapping.kind !== 'Literal' || !mapping.value || typeof mapping.value !== 'object') return [];
  return ((mapping.value as QuerySpec).projections ?? [])
    .filter((path) => path.trim())
    .map((path) => ({
      id: `first.${path}`,
      label: t('output.first-result', { path }),
    }));
};

const httpSpecOf = (step: WorkflowStep, definition: StepDefinitionSummary): HttpRequestSpec | null => {
  if (definition.dynamicOutputs?.kind !== 'from-http-request') return null;
  const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
  if (!mapping || mapping.kind !== 'Literal' || !mapping.value || typeof mapping.value !== 'object') return null;
  return mapping.value as HttpRequestSpec;
};

/**
 * Os caminhos `body.<campo>` que o EXEMPLO de resposta descreve. Sem exemplo, o passo continua expondo
 * o `body` inteiro (saída fixa) — o exemplo só acrescenta o que dá para sugerir.
 */
const httpSampleOutputs = (
  t: TranslateFn,
  step: WorkflowStep,
  definition: StepDefinitionSummary,
): { id: string; label: string }[] => {
  const spec = httpSpecOf(step, definition);
  // No assíncrono a resposta não volta para este fluxo: não há `body` para sugerir.
  if (isAsyncHttpSpec(spec)) return [];
  return httpSamplePaths(httpSampleFields(spec?.responseSample ?? undefined)).map((path) => ({
    id: path,
    label: t('step.http.output.body-path', { path: path.slice('body.'.length) }),
  }));
};

/** O exemplo como forma de schema, para `input.body.` navegar como `event.` navega. */
const sampleNativeFields = (fields: readonly HttpSampleField[]): NativeFieldSpec[] =>
  fields.map((field): NativeFieldSpec => {
    if (field.type === 'list') {
      return field.fields && field.fields.length > 0
        ? { key: field.key, label: field.key, type: 'object', list: true, objectFields: sampleNativeFields(field.fields) }
        : { key: field.key, label: field.key, type: 'stringArray' };
    }
    if (field.type === 'object') {
      return { key: field.key, label: field.key, type: 'object', objectFields: sampleNativeFields(field.fields ?? []) };
    }
    return { key: field.key, label: field.key, type: field.type };
  });

/**
 * As saídas `params.<chave>` de um passo que extrai os parâmetros de um workflow-alvo. O rótulo é o
 * que o escritório digitou no parâmetro — dado do tenant, que não se traduz —, e só o sufixo de
 * lista é texto nosso.
 */
const parameterOutputs = (
  t: TranslateFn,
  parameter: WorkflowParameter,
  idPrefix: string,
  labelPrefix = '',
): { id: string; label: string }[] => {
  const id = `${idPrefix}.${parameter.key}`;
  const label = labelPrefix ? `${labelPrefix} › ${parameter.label}` : parameter.label;
  if (parameter.list) return [{ id, label: t('output.list', { name: label }) }];
  if (parameter.type === 'Object') {
    return (parameter.fields ?? []).flatMap((child) => parameterOutputs(t, child, id, label));
  }
  return [{ id, label }];
};

const mapConfigOf = (
  step: WorkflowStep,
  definition: StepDefinitionSummary,
): MapStepConfig | null => {
  if (definition.dynamicOutputs?.kind !== 'from-map-config') return null;
  const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
  if (!mapping || mapping.kind !== 'Literal' || !mapping.value || typeof mapping.value !== 'object') return null;
  const config = mapping.value as MapStepConfig;
  if (!Array.isArray(config.fields)) return null;
  const hasNamedField = config.fields.some((field) => field?.name?.trim());
  return config.name?.trim() || hasNamedField ? config : null;
};

// Nomes de saída expostos por um MapStepConfig: o nome do objeto no modo nomeado;
// cada campo nomeado no modo sem-nome (os campos ficam espalhados na raiz da saída).
const mapOutputNames = (config: MapStepConfig): string[] => {
  const name = config.name?.trim();
  if (name) return [name];
  return (config.fields ?? [])
    .map((field) => field.name?.trim())
    .filter((fieldName): fieldName is string => !!fieldName);
};

// O Step "Validar Objeto" tem a mesma forma de saída do "Montar Objeto" (um objeto nomeado, com
// tipo opcional), então é normalizado para MapStepConfig e reusa o mesmo caminho de IntelliSense.
const validateConfigOf = (
  step: WorkflowStep,
  definition: StepDefinitionSummary,
): MapStepConfig | null => {
  if (definition.dynamicOutputs?.kind !== 'from-validate-config') return null;
  const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
  if (!mapping || mapping.kind !== 'Literal' || !mapping.value || typeof mapping.value !== 'object') return null;
  const config = mapping.value as ValidateStepConfig;
  if (!config.outputName?.trim()) return null;
  return {
    name: config.outputName,
    type: config.entityType,
    fields: (config.parameters ?? [])
      .filter((parameter) => parameter.key?.trim())
      .map((parameter) => ({ name: parameter.key, value: { kind: 'Literal', value: '' } })),
  };
};

const objectOutputConfigOf = (
  step: WorkflowStep,
  definition: StepDefinitionSummary,
): MapStepConfig | null => mapConfigOf(step, definition) ?? validateConfigOf(step, definition);

const emptyMappingFor = (kind: InputMapping['kind']): InputMapping => {
  switch (kind) {
    case 'Literal': return { kind: 'Literal', value: '' };
    case 'Event': return { kind: 'Event', path: '' };
    case 'Expression': return { kind: 'Expression', expression: '' };
    case 'Output': return { kind: 'Output', stepId: '', outputId: '' };
    case 'Variable': return { kind: 'Variable', name: '' };
    default: return { kind: 'Literal', value: '' };
  }
};

export type ConditionViewMode = 'editor' | 'diagram';

const CONDITION_VIEW_MODE_KEY = 'microteia:workflowConditionViewMode';

const loadConditionViewMode = (): ConditionViewMode => {
  try {
    return localStorage.getItem(CONDITION_VIEW_MODE_KEY) === 'diagram' ? 'diagram' : 'editor';
  } catch {
    return 'editor';
  }
};

/** O que o seletor de um input que aponta um artefato precisa para desenhar o valor gravado. */
export interface PickerDisplay {
  options: { value: string; label: string }[];
  /** A frase da ausência, quando a referência gravada não resolve e há um motivo a dizer. */
  orphanMessage?: string;
}

export interface EditWorkflowStepViewModel {
  workflowName: string;
  stepOrder: number;
  selectedDefinitionId: string;
  selectedDefinition: StepDefinitionSummary | undefined;
  selectedStepIcon: IconType | null;
  isDefinitionLocked: boolean;
  selectDefinition: (stepDefinitionId: string) => void;
  stepIdentifier: string;
  setStepIdentifier: (identifier: string) => void;
  stepIdentifierHint: string;
  stepIdentifierError: string | null;
  isStepIdentifierLocked: boolean;
  /**
   * O rótulo livre do passo — `signature`, o que o cartão do fluxo mostra. Vazio faz o cartão cair
   * no identificador, que é o comportamento de um passo que nunca recebeu rótulo.
   */
  stepLabel: string;
  setStepLabel: (label: string) => void;
  configuration: Record<string, InputMapping>;
  effectiveInputs: InputDefinition[];
  /** O seletor que este input pede, ou `null` quando ele é preenchido por mapeamento comum. */
  pickerFor: (input: InputDefinition) => InputPickerKind | null;
  /**
   * A lista do seletor e, quando o alvo gravado não é achado, a frase que diz por quê. As duas saem
   * da mesma resolução, e por isso saem juntas: perguntá-las em separado repetiria a busca e abriria
   * espaço para uma responder o que a outra desmente.
   */
  pickerDisplay: (kind: InputPickerKind, stored: string) => PickerDisplay;
  pickerPlaceholder: (kind: InputPickerKind) => string;
  setPickerValue: (inputId: string, value: string) => void;
  /** O valor `Literal` de um input `list: true`, como lista — o gravado antes da lista vira um item. */
  literalList: (value: unknown) => string[];
  setMappingKind: (inputId: string, kind: InputMapping['kind'] | '') => void;
  setMapping: (inputId: string, mapping: InputMapping) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  isConditionStep: boolean;
  isLoopStep: boolean;
  isSwitchStep: boolean;
  /** Os caminhos de um `Switch`, na ordem em que são avaliados. */
  switchCases: (WorkflowSwitchCase & { canMoveUp: boolean; canMoveDown: boolean; canRemove: boolean })[];
  addSwitchCase: () => void;
  removeSwitchCase: (id: string) => void;
  moveSwitchCase: (id: string, direction: -1 | 1) => void;
  setSwitchCaseLabel: (id: string, label: string) => void;
  setSwitchCaseCondition: (id: string, condition: Condition) => void;
  isParallelStep: boolean;
  /** Os ramos de um `Parallel`, na ordem declarada — a ordem da junção das saídas e das variáveis. */
  parallelBranches: (WorkflowParallelBranch & { canMoveUp: boolean; canMoveDown: boolean; canRemove: boolean })[];
  canAddParallelBranch: boolean;
  addParallelBranch: () => void;
  removeParallelBranch: (id: string) => void;
  moveParallelBranch: (id: string, direction: -1 | 1) => void;
  setParallelBranchLabel: (id: string, label: string) => void;
  /** Itens do laço ao mesmo tempo, como texto do campo; 1 é em sequência. Não vale no laço paginado. */
  loopConcurrency: string;
  setLoopConcurrency: (value: string) => void;
  loopConcurrencyMax: number;
  /** A política de falha de um passo do catálogo. Ver `WorkflowStepErrorPolicy`. */
  errorAction: 'fail' | 'continue';
  setErrorAction: (action: 'fail' | 'continue') => void;
  errorRetries: number;
  setErrorRetries: (retries: number) => void;
  errorActionOptions: { value: string; label: string }[];
  errorRetryOptions: { value: string; label: string }[];
  loopItemName: string;
  setLoopItemName: (name: string) => void;
  loopOutputName: string;
  setLoopOutputName: (name: string) => void;
  /** De onde o laço tira os itens: uma lista (`source`) ou uma consulta lida em páginas (`query`). */
  loopMode: 'list' | 'query';
  setLoopMode: (mode: string) => void;
  loopModeOptions: { value: string; label: string }[];
  loopQuery: QuerySpec | undefined;
  setLoopQuery: (spec: QuerySpec) => void;
  loopPageSize: string;
  setLoopPageSize: (value: string) => void;
  loopPageSizeHint: string;
  /** O laço paginado PAUSA entre páginas: fora do nível principal, ele não pode ser salvo. */
  loopModeError: string | null;
  pendingCondition: Condition;
  setPendingCondition: (condition: Condition) => void;
  conditionViewMode: ConditionViewMode;
  setConditionViewMode: (mode: ConditionViewMode) => void;
  conditionFocusPath: number[] | null;
  handleRequestConditionEdit: (path: number[]) => void;
  clearConditionFocusPath: () => void;
  conditionEventName: string;
  conditionParameters?: WorkflowParameter[];
  /** O passo escolhido pausa, e o lugar dele não é o nível principal. */
  placementError: string | null;
  canSave: boolean;
  handleSave: () => Promise<void>;
  handleDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  stepToDelete: WorkflowStep | null;
  priorSteps: WorkflowStep[];
  priorStepOptions: { value: string; label: string }[];
  stepCatalog: StepDefinitionSummary[];
  stepCatalogOptions: { value: string; label: string; icon: IconType }[];
  eventFields: WorkflowEventFieldOption[];
  pathRoot: PathRoot | null;
  inputRoot: PathRoot;
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  isSaving: boolean;
  getStepOutputs: (stepId: string) => { value: string; label: string }[];
}

export const useEditWorkflowStepViewModel = (tabKey: string): EditWorkflowStepViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const { currentTenant } = useTenant();
  const { aiConnectionRepository } = useDI();
  const [aiConnections, setAiConnections] = useState<AIConnection[]>([]);
  // Parse tabKey:
  //   "edit-workflow-step:{wfId}"                         → adicionar step na raiz
  //   "edit-workflow-step:{wfId}:{stepId}"                → editar step existente
  //   "edit-workflow-step:{wfId}:add:{condId}:{branch}"   → adicionar step num ramo de condição
  //   "edit-workflow-step:{wfId}:addloop:{loopId}"        → adicionar step no corpo de um Loop
  // Sufixo opcional ":at:{index}" (sempre no fim) fixa a posição de inserção; sem ele, insere no fim.
  const rawParts = useMemo(() => tabKey.replace('edit-workflow-step:', '').split(':'), [tabKey]);
  const insertIndex = useMemo<number | null>(
    () => (rawParts[rawParts.length - 2] === 'at' ? Number(rawParts[rawParts.length - 1]) : null),
    [rawParts],
  );
  const parts = useMemo(
    () => (insertIndex !== null ? rawParts.slice(0, rawParts.length - 2) : rawParts),
    [rawParts, insertIndex],
  );
  const workflowId = parts[0] ?? '';
  const isBranchAdd = parts[1] === 'add';
  const isLoopAdd = parts[1] === 'addloop';
  //   "edit-workflow-step:{wfId}:addcase:{switchId}:{caseKey}" → adicionar step num caminho de Switch
  const isCaseAdd = parts[1] === 'addcase';
  //   "edit-workflow-step:{wfId}:addlane:{parallelId}:{laneKey}" → adicionar step num ramo de Parallel
  const isLaneAdd = parts[1] === 'addlane';
  const stepId = isBranchAdd || isLoopAdd || isCaseAdd || isLaneAdd ? null : (parts[1] ?? null);
  const insertTarget = useMemo<InsertTarget>(
    () => {
      if (isBranchAdd && parts[2] && parts[3]) return { kind: 'branch', conditionId: parts[2], branch: parts[3] as BranchKey };
      if (isLoopAdd && parts[2]) return { kind: 'loop', loopId: parts[2] };
      if (isCaseAdd && parts[2] && parts[3]) return { kind: 'case', switchId: parts[2], caseKey: parts[3] };
      if (isLaneAdd && parts[2] && parts[3]) return { kind: 'lane', parallelId: parts[2], laneKey: parts[3] };
      return { kind: 'root' };
    },
    [isBranchAdd, isLoopAdd, isCaseAdd, isLaneAdd, parts],
  );

  const { workflows, updateWorkflowSteps } = useWorkflowStore();
  const { scripts } = useScriptStore();
  const { installed } = useInstalledExtensions();
  const { closeTab, setTabTitle, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const schemaContext = useSchemaContext();
  const { stepCatalog, loadCatalog } = useStepCatalog();

  const workflow = useMemo(
    () => workflows.find((w) => w.id === workflowId) ?? null,
    [workflows, workflowId],
  );

  const existingSteps = useMemo(
    () => workflow?.steps ?? [],
    [workflow],
  );

  const editingStep = useMemo(
    () => stepId ? findStepInTree(existingSteps, stepId) : null,
    [stepId, existingSteps],
  );

  const isConditionStep = editingStep?.type === 'Condition';
  const isLoopStep = editingStep?.type === 'Loop';
  const isSwitchStep = editingStep?.type === 'Switch';
  const isParallelStep = editingStep?.type === 'Parallel';

  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [stepIdentifier, setStepIdentifier] = useState('');
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [stepLabel, setStepLabel] = useState('');
  const [configuration, setConfiguration] = useState<Record<string, InputMapping>>({});
  const [enabled, setEnabled] = useState(true);
  const [pendingCondition, setPendingCondition] = useState<Condition>({ kind: 'AlwaysTrue' });
  const [loopItemName, setLoopItemName] = useState('item');
  const [loopOutputName, setLoopOutputName] = useState('itens');
  const [loopMode, setLoopModeState] = useState<'list' | 'query'>('list');
  const [loopQuery, setLoopQuery] = useState<QuerySpec | undefined>(undefined);
  const [loopPageSize, setLoopPageSize] = useState(String(PAGED_LOOP_DEFAULT_PAGE_SIZE));
  const [switchCases, setSwitchCases] = useState<WorkflowSwitchCase[]>([]);
  const [parallelBranches, setParallelBranches] = useState<WorkflowParallelBranch[]>([]);
  const [loopConcurrency, setLoopConcurrency] = useState('1');
  const [errorAction, setErrorAction] = useState<'fail' | 'continue'>('fail');
  const [errorRetries, setErrorRetries] = useState(0);
  const [conditionViewMode, setConditionViewModeState] = useState<ConditionViewMode>(loadConditionViewMode);
  const [conditionFocusPath, setConditionFocusPath] = useState<number[] | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<WorkflowStep | null>(null);

  const setConditionViewMode = useCallback((mode: ConditionViewMode) => {
    setConditionViewModeState(mode);
    try {
      localStorage.setItem(CONDITION_VIEW_MODE_KEY, mode);
    } catch {
      // ignore
    }
  }, []);

  const handleRequestConditionEdit = useCallback((path: number[]) => {
    setConditionFocusPath(path);
    setConditionViewMode('editor');
  }, [setConditionViewMode]);

  const clearConditionFocusPath = useCallback(() => setConditionFocusPath(null), []);

  // Carrega o catálogo de steps uma vez (idempotente)
  useEffect(() => {
    void loadCatalog().catch((error) => console.error('[EditWorkflowStep] loadCatalog:', error));
  }, [loadCatalog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicializa o form ao montar ou mudar de step
    setSelectedDefinitionId(editingStep?.stepDefinitionId ?? '');
    setStepIdentifier(editingStep?.id ?? '');
    setIdentifierTouched(false);
    setStepLabel(editingStep?.signature ?? '');
    // Nó Loop guarda a origem da lista em `loop.source`; expõe-a como configuration['source']
    // para reusar os mesmos controles de mapeamento de qualquer outro input.
    setConfiguration(
      editingStep?.type === 'Loop' && editingStep.loop
        ? { source: editingStep.loop.source }
        : (editingStep?.configuration ?? {}),
    );
    setEnabled(editingStep?.enabled ?? true);
    setPendingCondition(editingStep?.condition ?? { kind: 'AlwaysTrue' });
    setLoopItemName(editingStep?.loop?.itemName ?? 'item');
    setLoopOutputName(editingStep?.loop?.outputName ?? 'itens');
    setLoopModeState(editingStep?.loop?.query ? 'query' : 'list');
    setLoopQuery(editingStep?.loop?.query?.spec);
    setLoopPageSize(String(editingStep?.loop?.query?.pageSize ?? PAGED_LOOP_DEFAULT_PAGE_SIZE));
    setSwitchCases(editingStep?.switch?.cases ?? []);
    setParallelBranches(editingStep?.parallel?.branches ?? []);
    setLoopConcurrency(String(loopConcurrencyOf(editingStep?.loop?.concurrency)));
    setErrorAction(editingStep?.onError?.action === 'continue' ? 'continue' : 'fail');
    setErrorRetries(editingStep?.onError?.retries ?? 0);
  }, [editingStep]);

  const addParallelBranch = useCallback(() => {
    setParallelBranches((current) => (current.length >= MAX_PARALLEL_BRANCHES
      ? current
      : [...current, { id: nextParallelBranchId(current.map((one) => one.id)), steps: [] }]));
  }, []);

  // Só o ramo VAZIO sai: o ramo com passos levaria os passos junto, e a tela não apaga passo sem perguntar.
  const removeParallelBranch = useCallback((id: string) => {
    setParallelBranches((current) => (current.length <= MIN_PARALLEL_BRANCHES
      ? current
      : current.filter((one) => one.id !== id || one.steps.length > 0)));
  }, []);

  const moveParallelBranch = useCallback((id: string, direction: -1 | 1) => {
    setParallelBranches((current) => {
      const index = current.findIndex((one) => one.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const setParallelBranchLabel = useCallback((id: string, value: string) => {
    setParallelBranches((current) => current.map((one) => {
      if (one.id !== id) return one;
      const rest: WorkflowParallelBranch = { id: one.id, steps: one.steps };
      return value.trim() ? { ...rest, label: value } : rest;
    }));
  }, []);

  const addSwitchCase = useCallback(() => {
    setSwitchCases((current) => [
      ...current,
      {
        id: nextSwitchCaseId({ ...(editingStep as WorkflowStep), switch: { cases: current, otherwise: [] } }),
        condition: { kind: 'AlwaysTrue' },
        steps: [],
      },
    ]);
  }, [editingStep]);

  // Só o caminho VAZIO sai por aqui: um caminho com passos levaria os passos junto, e quem os quer
  // apagar faz isso nos passos, onde a confirmação diz o que vai embora.
  const removeSwitchCase = useCallback((id: string) => {
    setSwitchCases((current) => current.filter((one) => one.id !== id || one.steps.length > 0));
  }, []);

  const moveSwitchCase = useCallback((id: string, direction: -1 | 1) => {
    setSwitchCases((current) => {
      const index = current.findIndex((one) => one.id === id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= current.length) return current;
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }, []);

  const setSwitchCaseLabel = useCallback((id: string, value: string) => {
    setSwitchCases((current) => current.map((one) => {
      if (one.id !== id) return one;
      const next = { ...one };
      delete next.label;
      return value.trim() ? { ...next, label: value } : next;
    }));
  }, []);

  const setSwitchCaseCondition = useCallback((id: string, condition: Condition) => {
    setSwitchCases((current) => current.map((one) => (one.id === id ? { ...one, condition } : one)));
  }, []);

  /** A política de falha como ela vai para o passo: AUSENTE no padrão, para o `.json` não carregar ruído. */
  const errorPolicy = useMemo<WorkflowStepErrorPolicy | null>(() => {
    const retries = Math.max(0, Math.min(MAX_STEP_RETRIES, errorRetries));
    if (errorAction === 'fail' && retries === 0) return null;
    return {
      ...(errorAction === 'continue' ? { action: 'continue' as const } : {}),
      ...(retries > 0 ? { retries } : {}),
    };
  }, [errorAction, errorRetries]);

  const selectedDefinition = useMemo(
    () => stepCatalog.find((s) => s.id === selectedDefinitionId),
    [stepCatalog, selectedDefinitionId],
  );

  const selectedStepIcon = useMemo(
    () => (selectedDefinition ? getStepIcon(selectedDefinition.icon) : null),
    [selectedDefinition],
  );

  // Dentro de um ramo de condição ou de uma repetição o passo que PAUSA não é oferecido: o motor só
  // retoma no nível principal. O já gravado ali (vindo de importação) continua na lista, com o aviso.
  const atTopLevel = stepId ? existingSteps.some((step) => step.id === stepId) : insertTarget.kind === 'root';
  // O passo que o catálogo declara incompatível com o gatilho também não é oferecido — pela mesma regra.
  const triggerEventName = workflow?.eventName ?? '';
  const stepCatalogOptions = useMemo(
    () => stepCatalog
      .filter((s) => atTopLevel || !isPausingStepDefinition(s.id) || s.id === editingStep?.stepDefinitionId)
      .filter((s) => !isStepExcludedFromTrigger(s, triggerEventName) || s.id === editingStep?.stepDefinitionId)
      .map((s) => ({ value: s.id, label: s.name, icon: getStepIcon(s.icon) })),
    [stepCatalog, atTopLevel, editingStep, triggerEventName],
  );

  const placementError = useMemo(() => {
    if (!atTopLevel && isPausingStepDefinition(selectedDefinitionId)) return t('step.delay.top-level-only');
    if (isStepExcludedFromTrigger(selectedDefinition, triggerEventName)) {
      return t('step.excluded-trigger', { event: triggerEventName });
    }
    return null;
  }, [atTopLevel, selectedDefinitionId, selectedDefinition, triggerEventName, t]);

  const dynamicTargetKind = useMemo<'workflow' | 'script' | 'document-template' | 'report' | null>(() => {
    const kind = selectedDefinition?.dynamicInputs?.kind;
    if (kind === 'from-target-workflow-parameters') return 'workflow';
    if (kind === 'from-target-script-parameters') return 'script';
    if (kind === 'from-target-document-template-parameters') return 'document-template';
    if (kind === 'from-target-report-prompts') return 'report';
    return null;
  }, [selectedDefinition]);

  const dynamicInputsSourceId = useMemo(
    () => (dynamicTargetKind ? selectedDefinition?.dynamicInputs?.sourceInputId ?? null : null),
    [dynamicTargetKind, selectedDefinition],
  );

  const targetWorkflow = useMemo(() => {
    if (dynamicTargetKind !== 'workflow' || !dynamicInputsSourceId) return null;
    const mapping = configuration[dynamicInputsSourceId];
    const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
    if (!id) return null;
    const found = findByArtifactRef(workflows, id);
    return found?.eventName === WORKFLOW_CALLED_EVENT ? found : null;
  }, [dynamicTargetKind, dynamicInputsSourceId, configuration, workflows]);

  const targetScript = useMemo(() => {
    if (dynamicTargetKind !== 'script' || !dynamicInputsSourceId) return null;
    const mapping = configuration[dynamicInputsSourceId];
    const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
    if (!id) return null;
    return findByArtifactRef(scripts, id) ?? null;
  }, [dynamicTargetKind, dynamicInputsSourceId, configuration, scripts]);

  /**
   * Os modelos que VALEM no escritório — os de pacote sobrepostos pelos dele —, com a tela de cada
   * um ao lado (ou a marca de que o modelo é de dados): é o que o seletor do passo lista.
   */
  const documentTemplates = useResolvedDocumentTemplates();

  /** O modelo escolhido no passo "Gerar documento" — o que decide quais inputs servem. */
  const chosenTemplate = useMemo(() => {
    if (dynamicTargetKind !== 'document-template' || !dynamicInputsSourceId) return null;
    const mapping = configuration[dynamicInputsSourceId];
    const key = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
    return documentTemplates.find((one) => one.key === key) ?? null;
  }, [dynamicTargetKind, dynamicInputsSourceId, configuration, documentTemplates]);

  const { reports } = useReportDefinitions();

  /** O relatório do passo "Executar relatório": os FILTROS dele viram `param.<chave>`. */
  const targetReport = useMemo(() => {
    if (dynamicTargetKind !== 'report' || !dynamicInputsSourceId) return null;
    const mapping = configuration[dynamicInputsSourceId];
    const key = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
    return key ? reports.find((report) => !report.ownerId && (report.key === key || report.id === key)) ?? null : null;
  }, [dynamicTargetKind, dynamicInputsSourceId, configuration, reports]);

  const reportOptions = useMemo(
    // Só os do escritório: o servidor não acha um pessoal, e um relatório privado numa automação
    // vazaria pela notificação de quem ela avisa.
    () => reports.filter((report) => !report.ownerId).map((report) => ({ value: report.key, label: label(report.title) })),
    [reports, label],
  );

  /** Os eventos que um `wait-for` pode esperar: os de REGISTRO — só eles têm um registro a correlacionar. */
  const recordEventOptions = useMemo(
    () => buildWorkflowEventCatalog(schemaContext)
      .filter((entry) => isRecordEventName(entry.name))
      .map((entry) => ({ value: entry.name, label: resolveEventCatalogLabel(label, entry), meta: entry.name })),
    [schemaContext, label],
  );

  /** O modelo `payload` escolhido: os parâmetros dele viram `param.<chave>`. */
  const targetTemplate = chosenTemplate && isPayloadTemplate(chosenTemplate) ? chosenTemplate : null;

  /**
   * Os inputs que só valem para uma origem de modelo (`templateSource`): fora da origem escolhida
   * somem — um modelo de dados não tem registro a pedir —, e na origem escolhida podem passar a ser
   * obrigatórios. Sem modelo escolhido, todos aparecem e nenhum é cobrado.
   */
  const inputsForTemplate = useCallback(
    (inputs: InputDefinition[]): InputDefinition[] =>
      inputsForTemplateSource(inputs, chosenTemplate ? (isPayloadTemplate(chosenTemplate) ? 'payload' : 'record') : null),
    [chosenTemplate],
  );

  const effectiveInputs = useMemo<InputDefinition[]>(() => {
    if (!selectedDefinition) return [];
    if (!dynamicInputsSourceId) return selectedDefinition.inputs;
    const declared = dynamicTargetKind === 'document-template'
      ? inputsForTemplate(selectedDefinition.inputs)
      : selectedDefinition.inputs;
    const source = dynamicTargetKind === 'script'
      ? (targetScript?.inputParams ?? [])
      : dynamicTargetKind === 'document-template'
        ? (targetTemplate?.parameters ?? [])
        : dynamicTargetKind === 'report'
          ? (targetReport ? reportPromptParameters(targetReport.spec) : [])
          : (targetWorkflow?.parameters ?? []);
    // No callback do passo HTTP, `response` é preenchido pela fila com o resultado — e sobreposto se
    // alguém o preenchesse aqui. Mostrá-lo seria pedir um valor que nunca chega; obrigatório, travaria o Salvar.
    const fromHttp = selectedDefinition.dynamicOutputs?.kind === 'from-http-request';
    const paramInputs = source
      .filter((parameter) => !fromHttp || parameter.key !== HTTP_CALLBACK_RESPONSE_PARAM)
      .flatMap(
      (parameter) => flattenParameterInputs(label, parameterForDisplay(label, parameter)),
    );
    return [...declared, ...paramInputs];
  }, [selectedDefinition, dynamicInputsSourceId, dynamicTargetKind, targetWorkflow, targetScript, targetTemplate, targetReport, inputsForTemplate, label]);

  /**
   * As automações que este passo pode chamar: as CHAMÁVEIS, ativas, menos ela mesma.
   *
   * O filtro por `enabled` não é cosmético — quem executa recusa um alvo desativado exatamente como
   * recusa um alvo inexistente, então oferecer uma automação inativa é oferecer uma escolha que só
   * falha na hora em que alguém depender dela.
   */
  const callableWorkflowOptions = useMemo(
    () =>
      workflows
        .filter((w) => w.eventName === WORKFLOW_CALLED_EVENT && w.enabled && w.id !== workflowId)
        .map((w) => ({ value: w.id, label: label(w.name) })),
    [workflows, workflowId, label],
  );

  const callableScriptOptions = useMemo(
    () => scripts.map((s) => ({ value: s.id, label: label(s.name) })),
    [scripts, label],
  );

  /**
   * As extensões do escritório reduzidas ao que o diagnóstico de uma referência usa. Todo membro lê
   * `installed_extensions`, e o store já as assina — nada é carregado por causa desta tela.
   */
  const refOwners = useMemo<ArtifactRefOwner[]>(
    () => installed.map((one) => ({
      id: one.id,
      active: one.active,
      exports: one.package.manifest.exports,
    })),
    [installed],
  );

  const needsAIConnections = useMemo(
    () => (selectedDefinition?.inputs ?? []).some((input) => input.picker === 'ai-connection'),
    [selectedDefinition],
  );

  const getAIConnectionsUC = useMemo(
    () => makeGetAIConnectionsUseCase(aiConnectionRepository),
    [aiConnectionRepository],
  );

  // Só carrega quando algum input pede o seletor de conexão. Ler `ai.manage` é permissão de outra
  // tela: quem não a tem recebe lista vazia, vê só a opção "padrão do escritório" — que é
  // exatamente o que vai acontecer em runtime — e o editor não quebra por isso.
  useEffect(() => {
    if (!needsAIConnections || !currentTenant) return;
    let cancelled = false;
    getAIConnectionsUC
      .execute(currentTenant.id)
      .then((result) => {
        if (!cancelled) setAiConnections(result);
      })
      .catch(() => {
        if (!cancelled) setAiConnections([]);
      });
    return () => {
      cancelled = true;
    };
  }, [needsAIConnections, currentTenant, getAIConnectionsUC]);

  const { catalog: permissionCatalog } = useAuthorization();

  /**
   * As permissões do escritório para o seletor de `picker: 'permission'`, com o nome QUALIFICADO —
   * "Editar — Prazos", e não só "Editar" — pela mesma razão da tela de Perfis: a ação sozinha não diz
   * do quê.
   */
  const permissionOptions = useMemo(
    () => permissionCatalog.list.map((permission) => {
      const resource = permissionCatalog.resourceLabels.get(permission.resource);
      return {
        value: permission.id,
        label: label('@core.access/role.qualified-name', {
          action: label(permission.name),
          resource: resource ? label(resource.name, resource.nameParams) : permission.resource,
        }),
      };
    }),
    [permissionCatalog, label],
  );

  const documentTemplateOptions = useMemo(
    () => documentTemplates.map((template) => ({
      value: template.key,
      label: label(template.title),
      meta: isPayloadTemplate(template) ? t('step.render-document.meta.payload') : template.collection,
    })),
    [documentTemplates, label, t],
  );

  /** As referências únicas do modelo de dados escolhido: os registros a que o documento pode pertencer. */
  const templateReferenceOptions = useMemo(
    () => (targetTemplate?.parameters ?? [])
      .filter(isSingleRecordParameter)
      .map((parameter) => ({ value: parameter.key, label: label(parameter.label) || parameter.key, meta: parameter.entityType })),
    [targetTemplate, label],
  );

  /** As telas cujo registro tem a aba Documentos — as únicas de onde se compartilha documento. */
  const documentsCollectionOptions = useMemo(
    () => [...schemaContext.screens.entries()]
      .filter(([, screen]) => screen.hasDocuments === true)
      .map(([collection, screen]) => ({ value: collection, label: label(screen.titlePlural ?? screen.titleSingular), meta: collection })),
    [schemaContext, label],
  );

  /**
   * As telas-SUJEITO do portal — as que recebem convidados —, pela coleção, que é o que o passo grava.
   * Para convidar, só as que abriram a porta à automação (`portal.invites.automation`): escolher outra
   * reprovaria em toda execução.
   */
  const { definitions: screenDefinitions } = useScreenDefinitions();
  const portalSubjectScreens = useMemo(
    () => screenDefinitions.filter((screen) => screen.portal?.subject === 'self'),
    [screenDefinitions],
  );
  const portalSubjectOptions = useMemo(
    () => portalSubjectScreens.map((screen) => ({
      value: screenDataCollection(screen),
      label: label(screen.titlePlural || screen.titleSingular),
      meta: screenDataCollection(screen),
    })),
    [portalSubjectScreens, label],
  );
  const portalInviteSubjectOptions = useMemo(
    () => portalSubjectOptions.filter((option) =>
      portalSubjectScreens.some((screen) => screenDataCollection(screen) === option.value && screen.portal?.invites?.automation === true)),
    [portalSubjectOptions, portalSubjectScreens],
  );

  const aiConnectionOptions = useMemo(
    () => [
      { value: '', label: t('step.ai-connection.default') },
      ...aiConnections.map((connection) => ({
        value: connection.id,
        label: `${connection.name} — ${connection.provider}/${connection.model}`,
      })),
    ],
    [aiConnections, t],
  );

  /**
   * O seletor aparece quando o input DECLARA um, e enquanto o valor dele for um `Literal`. Um alvo
   * que só se conhece em runtime — a saída do passo que detectou a automação — não tem lista a
   * mostrar em design-time, e ali o input volta a ser um mapeamento como qualquer outro.
   */
  const pickerFor = useCallback(
    (input: InputDefinition): InputPickerKind | null => {
      if (!input.picker) return null;
      if (input.allowedMappingKinds && !input.allowedMappingKinds.includes('Literal')) return null;
      const current = configuration[input.id];
      if (current && current.kind !== 'Literal') return null;
      return input.picker;
    },
    [configuration],
  );

  /**
   * O que o passo GUARDA e o que a lista MOSTRA não são a mesma coisa quando o alvo é de outra
   * extensão: ali o valor gravado é `<extensão>/<source-id>`, resolvido por dono e `sourceId` em
   * tempo de execução, e a lista é de ids de documento. Sem casar um com o outro, o seletor não
   * achava a linha e desenhava o alvo — que existe e roda — como "Registro não encontrado".
   *
   * A linha que representa o gravado recebe o GRAVADO como valor, e não o id do documento achado:
   * reescolher o mesmo alvo não pode trocar a referência qualificada pelo id local. A referência tem
   * de continuar viajando literal — é ela que sobrevive à extensão dona ser atualizada ou
   * reinstalada.
   *
   * A lista traz também o que já está escolhido quando ele não estaria nela — uma automação
   * desativada DEPOIS de escolhida. Escondê-la não a desconfigura: só faz o passo parecer vazio
   * quando ele aponta para algo. O filtro decide o que se pode escolher, nunca o que se pode ver.
   */
  const pickerDisplay = useCallback(
    (kind: InputPickerKind, stored: string): PickerDisplay => {
      if (kind === 'ai-connection') return { options: aiConnectionOptions };
      if (kind === 'record-event') {
        return !stored || recordEventOptions.some((option) => option.value === stored)
          ? { options: recordEventOptions }
          : { options: recordEventOptions, orphanMessage: t('step.target.record-event.missing', { key: stored }) };
      }
      if (kind === 'report') {
        return !stored || reportOptions.some((option) => option.value === stored)
          ? { options: reportOptions }
          : { options: reportOptions, orphanMessage: t('step.target.report.missing', { key: stored }) };
      }
      if (kind === 'document-template') {
        return !stored || documentTemplateOptions.some((option) => option.value === stored)
          ? { options: documentTemplateOptions }
          : { options: documentTemplateOptions, orphanMessage: t('step.target.document-template.missing', { key: stored }) };
      }
      if (kind === 'document-template-reference') {
        return !stored || templateReferenceOptions.some((option) => option.value === stored)
          ? { options: templateReferenceOptions }
          : {
            options: templateReferenceOptions,
            orphanMessage: t('step.target.document-template-reference.missing', { key: stored }),
          };
      }
      if (kind === 'documents-collection') {
        return !stored || documentsCollectionOptions.some((option) => option.value === stored)
          ? { options: documentsCollectionOptions }
          : { options: documentsCollectionOptions, orphanMessage: t('step.target.documents-collection.missing', { key: stored }) };
      }
      if (kind === 'portal-subject') {
        return !stored || portalSubjectOptions.some((option) => option.value === stored)
          ? { options: portalSubjectOptions }
          : { options: portalSubjectOptions, orphanMessage: t('step.target.portal-subject.missing', { key: stored }) };
      }
      if (kind === 'portal-invite-subject') {
        return !stored || portalInviteSubjectOptions.some((option) => option.value === stored)
          ? { options: portalInviteSubjectOptions }
          : { options: portalInviteSubjectOptions, orphanMessage: t('step.target.portal-invite-subject.missing', { key: stored }) };
      }
      if (kind === 'permission') {
        return !stored || permissionOptions.some((option) => option.value === stored)
          ? { options: permissionOptions }
          : { options: [...permissionOptions, { value: stored, label: stored }] };
      }
      const options = kind === 'script' ? callableScriptOptions : callableWorkflowOptions;
      if (!stored) return { options };

      const target = artifactRefTarget(label, kind === 'script' ? scripts : workflows, stored, refOwners);
      if (!target.option) {
        return { options, ...(target.reason ? { orphanMessage: target.reason } : {}) };
      }
      const { option: line, localId } = target;
      return {
        options: options.some((option) => option.value === localId)
          ? options.map((option) => (option.value === localId ? line : option))
          : [...options, line],
      };
    },
    [
      aiConnectionOptions,
      reportOptions,
      recordEventOptions,
      documentTemplateOptions,
      templateReferenceOptions,
      documentsCollectionOptions,
      portalSubjectOptions,
      portalInviteSubjectOptions,
      t,
      permissionOptions,
      callableScriptOptions,
      callableWorkflowOptions,
      scripts,
      workflows,
      refOwners,
      label,
    ],
  );

  const pickerPlaceholder = useCallback(
    (kind: InputPickerKind): string =>
      t(
        kind === 'script'
          ? 'step.target.script'
          : kind === 'ai-connection'
            ? 'step.target.ai-connection'
            : kind === 'permission'
              ? 'step.target.permission'
              : kind === 'document-template'
                ? 'step.target.document-template'
                : kind === 'document-template-reference'
                  ? 'step.target.document-template-reference'
                  : kind === 'documents-collection'
                    ? 'step.target.documents-collection'
                    : kind === 'portal-subject'
                      ? 'step.target.portal-subject'
                      : kind === 'portal-invite-subject'
                        ? 'step.target.portal-invite-subject'
                        : kind === 'report'
                          ? 'step.target.report'
                          : kind === 'record-event'
                            ? 'step.target.record-event'
                            : 'step.target.workflow',
      ),
    [t],
  );

  const literalList = useCallback((value: unknown): string[] => {
    if (Array.isArray(value)) return value.filter((item): item is string => typeof item === 'string');
    return typeof value === 'string' && value !== '' ? [value] : [];
  }, []);

  const setPickerValue = useCallback(
    (inputId: string, value: string) => {
      // Trocar o modelo do passo "Gerar documento" pode trocar a ORIGEM: o input que só valia para a
      // outra (o registro, num modelo de dados) sai junto, em vez de ficar gravado e escondido.
      const picked = dynamicTargetKind === 'document-template' && inputId === dynamicInputsSourceId
        ? documentTemplates.find((one) => one.key === value)
        : undefined;
      const pickedSource = picked ? (isPayloadTemplate(picked) ? 'payload' : 'record') : null;
      const foreign = new Set(
        (selectedDefinition?.inputs ?? [])
          .filter((input) => pickedSource && input.templateSource && input.templateSource.is !== pickedSource)
          .map((input) => input.id),
      );
      setConfiguration((prev) => {
        const next: Record<string, InputMapping> = {};
        for (const [key, mapping] of Object.entries(prev)) {
          // Trocar o alvo dos inputs DINÂMICOS invalida os `param.<chave>` do alvo anterior — e só
          // esse alvo: os outros seletores não geram input nenhum a limpar.
          if (key.startsWith('param.') && inputId === dynamicInputsSourceId) continue;
          if (foreign.has(key)) continue;
          next[key] = mapping;
        }
        next[inputId] = { kind: 'Literal', value };
        return next;
      });
    },
    [dynamicInputsSourceId, dynamicTargetKind, documentTemplates, selectedDefinition],
  );

  const stepOrder = useMemo(() => {
    if (editingStep) return editingStep.order + 1;
    return existingSteps.length + 1;
  }, [editingStep, existingSteps]);

  const workflowName = label(workflow?.name) || t('workflow.fallback-name');

  const eventFields = useMemo<WorkflowEventFieldOption[]>(() => {
    if (!workflow) return [];
    if (isParameterRootedEvent(workflow.eventName)) {
      return workflowParametersToFieldOptions(workflow.parameters, schemaContext);
    }
    return getWorkflowEventFields(workflow.eventName, schemaContext);
  }, [workflow, schemaContext]);

  const pathRoot = useMemo(
    () => (workflow ? workflowEventRoot(workflow.eventName, workflow.parameters, schemaContext) : null),
    [workflow, schemaContext],
  );

  useEffect(() => {
    const stepTypeName = selectedDefinition?.name ?? t('step.new');
    const title = `${workflowName} • ${stepOrder} • ${stepTypeName}`;
    setTabTitle(tabKey, title);
  }, [workflowName, stepOrder, selectedDefinition, tabKey, setTabTitle, t]);

  const selectDefinition = useCallback((stepDefinitionId: string) => {
    setSelectedDefinitionId(stepDefinitionId);
    
    const definition = stepCatalog.find((s) => s.id === stepDefinitionId);
    if (definition) {
      const initialConfig: Record<string, InputMapping> = {};
      definition.inputs.forEach((input) => {
        if (input.allowedMappingKinds && input.allowedMappingKinds.length === 1) {
          initialConfig[input.id] = emptyMappingFor(input.allowedMappingKinds[0]);
        }
      });
      // O passo de EXTENSÃO já sabe o próprio corpo: semeá-lo na entrada do alvo é o que faz as entradas
      // e as saídas do corpo aparecerem pelo caminho de "Chamar automação" e "Script". A automação-corpo
      // é sempre esperada — o passo devolve o que ela devolve.
      const sourceInputId = definition.dynamicInputs?.sourceInputId;
      if (definition.fixedTarget && sourceInputId) {
        initialConfig[sourceInputId] = { kind: 'Literal', value: definition.fixedTarget };
        if (definition.type === 'SubWorkflow') initialConfig.waitForResult = { kind: 'Literal', value: true };
      }
      setConfiguration(initialConfig);
    } else {
      setConfiguration({});
    }

    // O identificador nasce do tipo (`query1`, `callWorkflow2`) e acompanha a troca de tipo enquanto
    // o usuário não tiver escrito o dele — depois disso, o que ele escolheu manda.
    if (!editingStep && !identifierTouched) {
      setStepIdentifier(stepDefinitionId ? suggestStepIdentifier(existingSteps, stepDefinitionId) : '');
    }
  }, [stepCatalog, editingStep, identifierTouched, existingSteps]);

  const updateStepIdentifier = useCallback((identifier: string) => {
    setIdentifierTouched(true);
    setStepIdentifier(identifier);
  }, []);

  // Só faz sentido validar o que ainda pode ser escolhido: depois de criado, o identificador é a
  // identidade do Step — renomeá-lo quebraria os mapeamentos "Saída de outro step" que o apontam.
  const stepIdentifierError = useMemo(
    () => (editingStep ? undefined : stepIdentifierIssue(t, stepIdentifier, existingSteps)),
    [editingStep, stepIdentifier, existingSteps, t],
  );

  // O formulário abre com o campo vazio, porque o identificador sugerido só nasce quando o tipo é
  // escolhido — reclamar antes disso seria abrir a tela em vermelho sem o usuário ter feito nada.
  const visibleStepIdentifierError = identifierTouched || stepIdentifier ? stepIdentifierError : undefined;

  const stepIdentifierHint = useMemo(() => {
    if (!editingStep) return t('step.identifier.hint.new');
    if (isConditionStep) return t('step.identifier.hint.condition');
    if (isReferenceableStepId(editingStep.id)) return t('step.identifier.hint.readable', { id: editingStep.id });
    return t('step.identifier.hint.generated');
  }, [editingStep, isConditionStep, t]);

  const setMapping = useCallback((inputId: string, mapping: InputMapping) => {
    setConfiguration((prev) => ({ ...prev, [inputId]: mapping }));
  }, []);

  const setMappingKind = useCallback((inputId: string, kind: InputMapping['kind'] | '') => {
    if (!kind) {
      setConfiguration((prev) => {
        const next = { ...prev };
        delete next[inputId];
        return next;
      });
      return;
    }
    setMapping(inputId, emptyMappingFor(kind));
  }, [setMapping]);

  const priorSteps = useMemo(
    () => (editingStep
      ? collectPriorSteps(existingSteps, editingStep.id)
      : collectPriorStepsForInsert(existingSteps, insertTarget)),
    [existingSteps, editingStep, insertTarget],
  );

  const scriptOutputsFor = useCallback(
    (step: WorkflowStep, definition: StepDefinitionSummary): { id: string; label: string }[] => {
      if (definition.dynamicOutputs?.kind !== 'from-target-script-outputs') return [];
      const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
      const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
      if (!id) return [];
      const script = findByArtifactRef(scripts, id);
      return (script?.outputParams ?? []).map((param) => ({ id: param.key, label: label(param.label) || param.key }));
    },
    [scripts, label],
  );

  // Saídas de um Step desconsiderando chamadas a outro workflow. É a base compartilhada entre
  // resolveStepOutputs e a leitura das saídas de um workflow-alvo — separá-las impede recursão
  // infinita quando um workflow chama outro que também chama workflow.
  const localStepOutputs = useCallback(
    (step: WorkflowStep): { id: string; label: string }[] => {
      if (step.type === 'Loop' && step.loop) {
        return [{
      id: step.loop.outputName,
      label: t('output.list', { name: step.loop.outputName }),
    }];
      }

      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      if (!definition) return [];

      const outputs: { id: string; label: string }[] = [];

      // O passo HTTP publica saídas diferentes em cada modo; oferecer as do outro é sugerir um caminho
      // que resolve vazio em toda execução.
      const httpSpec = httpSpecOf(step, definition);
      definition.outputDefinitions.forEach((output) => {
        if (definition.dynamicOutputs?.kind === 'from-http-request' && !isHttpOutputOfMode(httpSpec, output.id)) return;
        outputs.push({ id: output.id, label: output.label });
      });

      if (definition.dynamicOutputs?.kind === 'from-input-field') {
        const sourceIds = Array.isArray(definition.dynamicOutputs.sourceInputId)
          ? definition.dynamicOutputs.sourceInputId
          : [definition.dynamicOutputs.sourceInputId];
        sourceIds.forEach((sourceInputId) => {
          const mapping = step.configuration[sourceInputId];
          if (mapping && mapping.kind === 'Literal' && mapping.value) {
            const outputId = String(mapping.value);
            outputs.push({ id: outputId, label: t('step.output.dynamic', { id: outputId }) });
          }
        });
      }

      queryProjectionOutputs(t, step, definition).forEach((output) => {
        outputs.push({ id: output.id, label: output.label });
      });
      httpSampleOutputs(t, step, definition).forEach((output) => {
        outputs.push({ id: output.id, label: output.label });
      });
      scriptOutputsFor(step, definition).forEach((output) => {
        outputs.push({ id: output.id, label: output.label });
      });

      const mapConfig = objectOutputConfigOf(step, definition);
      if (mapConfig) {
        const suffix = mapConfig.name?.trim() ? t('map.output.object') : t('map.output.field');
        mapOutputNames(mapConfig).forEach((name) => {
          outputs.push({ id: name, label: `${name} ${suffix}` });
        });
      }

      return outputs;
    },
    [stepCatalog, scriptOutputsFor, t],
  );

  const workflowOutputsFor = useCallback(
    (step: WorkflowStep, definition: StepDefinitionSummary): { id: string; label: string }[] => {
      if (definition.dynamicOutputs?.kind !== 'from-target-workflow-outputs') return [];
      const waitMapping = step.configuration.waitForResult;
      if (!(waitMapping?.kind === 'Literal' && waitMapping.value === true)) return [];
      const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
      const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
      if (!id) return [];
      const target = findByArtifactRef(workflows, id);
      if (!target) return [];

      const labelsByOutputId = new Map<string, string>();
      returningStepsOf(target.steps).forEach((returningStep) => {
        localStepOutputs(returningStep).forEach((output) => {
          if (!labelsByOutputId.has(output.id)) labelsByOutputId.set(output.id, output.label);
        });
      });
      return Array.from(labelsByOutputId, ([outputId, label]) => ({ id: outputId, label }));
    },
    [workflows, localStepOutputs],
  );

  /**
   * As saídas `params.<chave>` de um passo que extrai os parâmetros de um workflow-alvo — o mesmo
   * gesto das projeções de uma consulta. Só existem quando o alvo é escolhido em design-time: com o
   * alvo vindo de um passo anterior, o que se sabe aqui é só o objeto `params` inteiro.
   */
  const workflowParameterOutputsFor = useCallback(
    (step: WorkflowStep, definition: StepDefinitionSummary): { id: string; label: string }[] => {
      if (definition.dynamicOutputs?.kind !== 'from-target-workflow-parameters') return [];
      const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
      const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
      if (!id) return [];
      const target = findByArtifactRef(workflows, id);
      if (!target) return [];
      return (target.parameters ?? []).flatMap((parameter) =>
        parameterOutputs(t, parameterForDisplay(label, parameter), 'params'),
      );
    },
    [workflows, t, label],
  );

  // Fonte única de verdade das saídas selecionáveis de um step (estáticas, dinâmicas,
  // projeções de query, saídas de Script/Workflow-alvo e objetos montados). Consumida tanto
  // pelo autocomplete (`stepOutputFields`/`input.`) quanto pelo seletor visual (`getStepOutputs`)
  // e pela lista de steps candidatos (`priorStepOptions`), garantindo que os três coincidam.
  const resolveStepOutputs = useCallback(
    (step: WorkflowStep): { id: string; label: string }[] => {
      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      const outputs = localStepOutputs(step);
      if (!definition) return outputs;

      workflowOutputsFor(step, definition).forEach((output) => {
        outputs.push({ id: output.id, label: output.label });
      });
      workflowParameterOutputsFor(step, definition).forEach((output) => {
        outputs.push({ id: output.id, label: output.label });
      });

      return outputs;
    },
    [stepCatalog, localStepOutputs, workflowOutputsFor, workflowParameterOutputsFor],
  );

  const stepOutputFields = useMemo(() => {
    const fields: StepOutputField[] = [];
    priorSteps.forEach((step) => {
      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      const stepName = getStepDisplayName(t, step, definition);
      resolveStepOutputs(step).forEach((output) => {
        fields.push({ stepId: step.id, stepName, outputId: output.id, outputLabel: output.label });
      });
    });
    return fields;
  }, [priorSteps, stepCatalog, resolveStepOutputs, t]);

  // Descreve a "forma" do `input` (saídas dos steps anteriores) como um PathRoot de schema, para
  // que o autocomplete de `input.<saída>.` navegue nas propriedades de saídas do tipo
  // EntityReference — exatamente como `event.<campo>.` faz. Reusa workflowParameterToNativeField
  // (ScriptOutputParam tem o mesmo formato de WorkflowParameter: key/label/type/entityType).
  const inputRoot = useMemo<PathRoot>(() => {
    const fields: NativeFieldSpec[] = [];
    priorSteps.forEach((step) => {
      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      if (!definition) return;

      if (definition.dynamicOutputs?.kind === 'from-target-script-outputs') {
        const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
        const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
        if (!id) return;
        const script = findByArtifactRef(scripts, id);
        (script?.outputParams ?? []).forEach((param) => {
          fields.push(workflowParameterToNativeField(param as WorkflowParameter));
        });
        return;
      }

      const httpSpec = httpSpecOf(step, definition);
      if (httpSpec) {
        const sample = isAsyncHttpSpec(httpSpec) ? [] : httpSampleFields(httpSpec.responseSample);
        if (sample.length > 0) {
          fields.push({ key: 'body', label: 'body', type: 'object', objectFields: sampleNativeFields(sample) });
        }
        return;
      }

      const mapConfig = objectOutputConfigOf(step, definition);
      if (mapConfig) {
        const name = mapConfig.name?.trim();
        if (name) {
          fields.push(
            mapConfig.type
              ? workflowParameterToNativeField({
                  key: name,
                  label: name,
                  type: 'EntityReference',
                  entityType: mapConfig.type,
                } as WorkflowParameter)
              : {
                  key: name,
                  label: name,
                  type: 'object',
                  objectFields: mapConfig.fields
                    .filter((field) => field.name?.trim())
                    .map((field) => ({ key: field.name, label: field.name, type: 'string' as const })),
                },
          );
        } else {
          mapConfig.fields
            .filter((field) => field.name?.trim())
            .forEach((field) => {
              fields.push({ key: field.name, label: field.name, type: 'string' as const });
            });
        }
      }
    });
    return { kind: 'fields', fields, hasOld: false };
  }, [priorSteps, stepCatalog, scripts]);

  const getStepOutputs = useCallback((stepId: string) => {
    const step = priorSteps.find((s) => s.id === stepId);
    if (!step) return [];
    return resolveStepOutputs(step).map((output) => ({ value: output.id, label: output.label }));
  }, [priorSteps, resolveStepOutputs]);

  // Steps anteriores oferecíveis em "Saída de outro step": apenas os que expõem ao menos uma
  // saída selecionável. Um "Chamar Workflow" sem "Aguardar retorno", por exemplo, não devolve
  // saídas ao chamador, então some da lista em vez de aparecer com um seletor de saída vazio.
  const priorStepOptions = useMemo(
    () =>
      priorSteps
        .filter((step) => resolveStepOutputs(step).length > 0)
        .map((step) => ({
          value: step.id,
          label: getStepDisplayName(t, step, stepCatalog.find((d) => d.id === step.stepDefinitionId)),
        })),
    [priorSteps, stepCatalog, resolveStepOutputs, t],
  );

  const workflowVariables = useMemo(() => {
    const variables: WorkflowVariable[] = [];
    
    priorSteps.forEach((step) => {
      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      
      if (!definition || !definition.dynamicOutputs) {
        return;
      }

      const { dynamicOutputs } = definition;
      
      // Só processa 'from-input-field' por enquanto
      if (dynamicOutputs.kind === 'from-input-field') {
        const sourceIds = Array.isArray(dynamicOutputs.sourceInputId) 
          ? dynamicOutputs.sourceInputId 
          : [dynamicOutputs.sourceInputId];

        sourceIds.forEach((sourceInputId) => {
          const mapping = step.configuration[sourceInputId];
          
          if (mapping && mapping.kind === 'Literal' && mapping.value) {
            const stepName = getStepDisplayName(t, step, definition);
            const variable = {
              name: String(mapping.value),
              definedBy: stepName,
            };
            variables.push(variable);
          }
        });
      }
    });
    
    return variables;
  }, [priorSteps, stepCatalog, t]);

  const loopModeOptions = useMemo(
    () => [
      { value: 'list', label: t('loop.mode.list') },
      { value: 'query', label: t('loop.mode.query') },
    ],
    [t],
  );
  // A consulta paginada pausa entre páginas, e só o nível principal retoma — a regra dos passos que pausam.
  const loopModeError = isLoopStep && loopMode === 'query' && !atTopLevel ? t('loop.mode.query.top-level-only') : null;

  const canSave = useMemo(() => {
    if (isConditionStep) return true;
    if (isSwitchStep) return switchCases.length > 0;
    if (isParallelStep) return parallelBranches.length >= MIN_PARALLEL_BRANCHES;
    if (isLoopStep) {
      const hasSource = loopMode === 'query' ? !!loopQuery?.table && loopModeError === null : !!configuration.source;
      return hasSource && !!loopItemName.trim() && !!loopOutputName.trim();
    }
    if (!selectedDefinition) return false;
    if (stepIdentifierError) return false;
    if (placementError) return false;
    return effectiveInputs
      .filter((input) => input.required)
      .every((input) => configuration[input.id] !== undefined);
  }, [isConditionStep, isSwitchStep, switchCases, isParallelStep, parallelBranches, isLoopStep, configuration, loopItemName, loopOutputName, loopMode, loopQuery, loopModeError, selectedDefinition, effectiveInputs, stepIdentifierError, placementError]);

  const handleSave = useCallback(async () => {
    if (!workflow) return;

    // Modo Condição: edita step.condition de um nó de controle já existente.
    if (isConditionStep && editingStep) {
      setIsSaving(true);
      try {
        const updated: WorkflowStep = {
          id: editingStep.id,
          stepDefinitionId: '',
          type: 'Condition',
          order: editingStep.order,
          ...(stepLabel.trim() ? { signature: stepLabel.trim() } : {}),
          configuration: {},
          enabled,
          condition: pendingCondition,
          branches: editingStep.branches ?? { whenTrue: [], whenFalse: [] },
        };
        await updateWorkflowSteps(workflow.id, replaceStepInTree(existingSteps, updated));
        notify(t('condition.saved'), 'success');
        closeTab(tabKey, activePanelId ?? 'main');
      } catch (error) {
        notify(t('condition.save-failed', { detail: String(error) }), 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Modo Switch: edita os caminhos (nome, condição, ordem) preservando os passos de cada um e o "senão".
    if (isSwitchStep && editingStep && editingStep.switch) {
      setIsSaving(true);
      try {
        const updated: WorkflowStep = {
          id: editingStep.id,
          stepDefinitionId: '',
          type: 'Switch',
          order: editingStep.order,
          ...(stepLabel.trim() ? { signature: stepLabel.trim() } : {}),
          configuration: {},
          enabled,
          switch: { cases: switchCases, otherwise: editingStep.switch.otherwise },
        };
        await updateWorkflowSteps(workflow.id, replaceStepInTree(existingSteps, updated));
        notify(t('switch.saved'), 'success');
        closeTab(tabKey, activePanelId ?? 'main');
      } catch (error) {
        notify(t('switch.save-failed', { detail: String(error) }), 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Modo Parallel: edita os ramos (nome, ordem, quantos) preservando os passos de cada um.
    if (isParallelStep && editingStep && editingStep.parallel) {
      setIsSaving(true);
      try {
        const updated: WorkflowStep = {
          id: editingStep.id,
          stepDefinitionId: '',
          type: 'Parallel',
          order: editingStep.order,
          ...(stepLabel.trim() ? { signature: stepLabel.trim() } : {}),
          configuration: {},
          enabled,
          parallel: { branches: parallelBranches },
        };
        await updateWorkflowSteps(workflow.id, replaceStepInTree(existingSteps, updated));
        notify(t('parallel.saved'), 'success');
        closeTab(tabKey, activePanelId ?? 'main');
      } catch (error) {
        notify(t('parallel.save-failed', { detail: String(error) }), 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    // Modo Loop: edita a configuração de repetição de um nó de controle já existente,
    // preservando o corpo (loop.body).
    if (isLoopStep && editingStep && editingStep.loop) {
      const paged = loopMode === 'query' && loopQuery ? { spec: loopQuery, pageSize: pagedLoopPageSize(loopPageSize) } : null;
      // O laço paginado não lê `source`; ela continua gravada (uma lista vazia) para o kernel anterior,
      // que não conhece `query`, ter o que ler em vez de quebrar.
      const source = paged ? (configuration.source ?? { kind: 'Literal' as const, value: [] }) : configuration.source;
      if (!source) return;
      setIsSaving(true);
      try {
        const updated: WorkflowStep = {
          id: editingStep.id,
          stepDefinitionId: '',
          type: 'Loop',
          order: editingStep.order,
          ...(stepLabel.trim() ? { signature: stepLabel.trim() } : {}),
          configuration: {},
          enabled,
          loop: {
            source,
            itemName: loopItemName.trim(),
            outputName: loopOutputName.trim(),
            body: editingStep.loop.body,
            ...(paged ? { query: paged } : {}),
            // A concorrência não vale no laço paginado; 1 é o padrão e não é gravado.
            ...(!paged && loopConcurrencyOf(Number(loopConcurrency)) > 1 ? { concurrency: loopConcurrencyOf(Number(loopConcurrency)) } : {}),
          },
        };
        await updateWorkflowSteps(workflow.id, replaceStepInTree(existingSteps, updated));
        notify(t('loop.saved'), 'success');
        closeTab(tabKey, activePanelId ?? 'main');
      } catch (error) {
        notify(t('loop.save-failed', { detail: String(error) }), 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!selectedDefinition) return;

    setIsSaving(true);
    try {
      const step: WorkflowStep = {
        id: editingStep?.id ?? stepIdentifier.trim(),
        stepDefinitionId: selectedDefinition.id,
        type: selectedDefinition.type,
        order: editingStep?.order ?? 0,
        ...(stepLabel.trim() ? { signature: stepLabel.trim() } : {}),
        configuration,
        enabled,
        ...(errorPolicy ? { onError: errorPolicy } : {}),
      };

      const updatedSteps = editingStep
        ? replaceStepInTree(existingSteps, step)
        : insertIndex !== null
          ? insertStepAtIndex(existingSteps, insertTarget, step, insertIndex)
          : insertStepInto(existingSteps, insertTarget, step);

      await updateWorkflowSteps(workflow.id, updatedSteps);
      notify(t('step.saved'), 'success');
      closeTab(tabKey, activePanelId ?? 'main');
    } catch (error) {
      notify(t('step.save-failed', { detail: String(error) }), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    isConditionStep,
    isSwitchStep,
    switchCases,
    isParallelStep,
    parallelBranches,
    loopConcurrency,
    errorPolicy,
    isLoopStep,
    loopItemName,
    loopOutputName,
    loopMode,
    loopQuery,
    loopPageSize,
    selectedDefinition,
    workflow,
    editingStep,
    existingSteps,
    insertTarget,
    insertIndex,
    stepIdentifier,
    stepLabel,
    configuration,
    enabled,
    pendingCondition,
    updateWorkflowSteps,
    notify,
    closeTab,
    tabKey,
    activePanelId,
    t,
  ]);

  const handleDelete = useCallback(() => {
    if (editingStep) setStepToDelete(editingStep);
  }, [editingStep]);

  const cancelDelete = useCallback(() => setStepToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!workflow || !stepToDelete) return;
    const nextSteps = removeStepFromTree(existingSteps, stepToDelete.id);
    try {
      await updateWorkflowSteps(workflow.id, nextSteps);
      notify(t('step.deleted'), 'success');
      closeTab(tabKey, activePanelId ?? 'main');
    } catch (error) {
      console.error('[EditWorkflowStep] confirmDelete:', error);
      notify(t('step.delete-failed'), 'error');
    } finally {
      setStepToDelete(null);
    }
  }, [workflow, stepToDelete, existingSteps, updateWorkflowSteps, notify, closeTab, tabKey, activePanelId, t]);

  return {
    workflowName,
    stepOrder,
    selectedDefinitionId,
    selectedDefinition,
    selectedStepIcon,
    isDefinitionLocked: !!editingStep,
    selectDefinition,
    stepIdentifier,
    setStepIdentifier: updateStepIdentifier,
    stepIdentifierHint,
    stepIdentifierError: visibleStepIdentifierError ?? null,
    isStepIdentifierLocked: !!editingStep,
    stepLabel,
    setStepLabel,
    configuration,
    effectiveInputs,
    pickerFor,
    pickerDisplay,
    pickerPlaceholder,
    setPickerValue,
    literalList,
    setMappingKind,
    setMapping,
    enabled,
    setEnabled,
    isConditionStep: !!isConditionStep,
    isLoopStep: !!isLoopStep,
    isSwitchStep: !!isSwitchStep,
    switchCases: switchCases.map((one, index) => ({
      ...one,
      canMoveUp: index > 0,
      canMoveDown: index < switchCases.length - 1,
      canRemove: one.steps.length === 0,
    })),
    addSwitchCase,
    removeSwitchCase,
    moveSwitchCase,
    setSwitchCaseLabel,
    setSwitchCaseCondition,
    isParallelStep: !!isParallelStep,
    parallelBranches: parallelBranches.map((one, index) => ({
      ...one,
      canMoveUp: index > 0,
      canMoveDown: index < parallelBranches.length - 1,
      canRemove: one.steps.length === 0 && parallelBranches.length > MIN_PARALLEL_BRANCHES,
    })),
    canAddParallelBranch: parallelBranches.length < MAX_PARALLEL_BRANCHES,
    addParallelBranch,
    removeParallelBranch,
    moveParallelBranch,
    setParallelBranchLabel,
    loopConcurrency,
    setLoopConcurrency,
    loopConcurrencyMax: MAX_LOOP_CONCURRENCY,
    errorAction,
    setErrorAction,
    errorRetries,
    setErrorRetries,
    errorActionOptions: [
      { value: 'fail', label: t('step.on-error.fail') },
      { value: 'continue', label: t('step.on-error.continue') },
    ],
    errorRetryOptions: Array.from({ length: MAX_STEP_RETRIES + 1 }, (_, retries) => ({
      value: String(retries),
      label: retries === 0 ? t('step.on-error.no-retry') : t('step.on-error.retries', { count: String(retries) }),
    })),
    loopItemName,
    setLoopItemName,
    loopOutputName,
    setLoopOutputName,
    loopMode,
    setLoopMode: (mode) => setLoopModeState(mode === 'query' ? 'query' : 'list'),
    loopModeOptions,
    loopQuery,
    setLoopQuery,
    loopPageSize,
    setLoopPageSize,
    loopPageSizeHint: t('loop.page-size.hint', { max: String(PAGED_LOOP_MAX_PAGE_SIZE) }),
    loopModeError,
    pendingCondition,
    setPendingCondition,
    conditionViewMode,
    setConditionViewMode,
    conditionFocusPath,
    handleRequestConditionEdit,
    clearConditionFocusPath,
    conditionEventName: workflow?.eventName ?? '',
    conditionParameters: workflow?.parameters,
    placementError,
    canSave,
    handleSave,
    handleDelete,
    confirmDelete,
    cancelDelete,
    stepToDelete,
    priorSteps,
    priorStepOptions,
    stepCatalog,
    stepCatalogOptions,
    eventFields,
    pathRoot,
    inputRoot,
    stepOutputFields,
    workflowVariables,
    isSaving,
    getStepOutputs,
  };
};
