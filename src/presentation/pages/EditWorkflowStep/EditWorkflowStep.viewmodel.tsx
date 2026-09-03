import { useState, useMemo, useCallback, useEffect } from 'react';
import type { IconType } from 'react-icons';
import { useTenant } from '../../../stores/useTenant';
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
import { useStepCatalog } from '../../../stores/useStepCatalog';
import { getWorkflowEventFields, eventNameToRoot, WORKFLOW_CALLED_EVENT, workflowParametersToRoot, workflowParametersToFieldOptions } from '../../../domain/services/workflowEventCatalog';
import { workflowParameterToNativeField } from '../../../domain/schema/eventCatalog';
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
import type { Condition, InputMapping, WorkflowParameter, WorkflowStep } from '../../../domain/entities/Workflow';
import type {
  InputDefinition,
  InputPickerKind,
  StepDefinitionSummary,
} from '../../../domain/entities/WorkflowStepCatalog';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import type { StepOutputField, WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';

import { useT, useLabel, type TranslateFn } from '../../shared/i18n/useT';

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
  setMappingKind: (inputId: string, kind: InputMapping['kind']) => void;
  setMapping: (inputId: string, mapping: InputMapping) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  isConditionStep: boolean;
  isLoopStep: boolean;
  loopItemName: string;
  setLoopItemName: (name: string) => void;
  loopOutputName: string;
  setLoopOutputName: (name: string) => void;
  pendingCondition: Condition;
  setPendingCondition: (condition: Condition) => void;
  conditionViewMode: ConditionViewMode;
  setConditionViewMode: (mode: ConditionViewMode) => void;
  conditionFocusPath: number[] | null;
  handleRequestConditionEdit: (path: number[]) => void;
  clearConditionFocusPath: () => void;
  conditionEventName: string;
  conditionParameters?: WorkflowParameter[];
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
  const stepId = isBranchAdd || isLoopAdd ? null : (parts[1] ?? null);
  const insertTarget = useMemo<InsertTarget>(
    () => {
      if (isBranchAdd && parts[2] && parts[3]) return { kind: 'branch', conditionId: parts[2], branch: parts[3] as BranchKey };
      if (isLoopAdd && parts[2]) return { kind: 'loop', loopId: parts[2] };
      return { kind: 'root' };
    },
    [isBranchAdd, isLoopAdd, parts],
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

  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [stepIdentifier, setStepIdentifier] = useState('');
  const [identifierTouched, setIdentifierTouched] = useState(false);
  const [stepLabel, setStepLabel] = useState('');
  const [configuration, setConfiguration] = useState<Record<string, InputMapping>>({});
  const [enabled, setEnabled] = useState(true);
  const [pendingCondition, setPendingCondition] = useState<Condition>({ kind: 'AlwaysTrue' });
  const [loopItemName, setLoopItemName] = useState('item');
  const [loopOutputName, setLoopOutputName] = useState('itens');
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
  }, [editingStep]);

  const selectedDefinition = useMemo(
    () => stepCatalog.find((s) => s.id === selectedDefinitionId),
    [stepCatalog, selectedDefinitionId],
  );

  const selectedStepIcon = useMemo(
    () => (selectedDefinition ? getStepIcon(selectedDefinition.icon) : null),
    [selectedDefinition],
  );

  const stepCatalogOptions = useMemo(
    () => stepCatalog.map((s) => ({ value: s.id, label: s.name, icon: getStepIcon(s.icon) })),
    [stepCatalog],
  );

  const dynamicTargetKind = useMemo<'workflow' | 'script' | null>(() => {
    const kind = selectedDefinition?.dynamicInputs?.kind;
    if (kind === 'from-target-workflow-parameters') return 'workflow';
    if (kind === 'from-target-script-parameters') return 'script';
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

  const effectiveInputs = useMemo<InputDefinition[]>(() => {
    if (!selectedDefinition) return [];
    if (!dynamicInputsSourceId) return selectedDefinition.inputs;
    const source = dynamicTargetKind === 'script'
      ? (targetScript?.inputParams ?? [])
      : (targetWorkflow?.parameters ?? []);
    const paramInputs = source.flatMap(
      (parameter) => flattenParameterInputs(label, parameterForDisplay(label, parameter)),
    );
    return [...selectedDefinition.inputs, ...paramInputs];
  }, [selectedDefinition, dynamicInputsSourceId, dynamicTargetKind, targetWorkflow, targetScript, label]);

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
            : 'step.target.workflow',
      ),
    [t],
  );

  const setPickerValue = useCallback(
    (inputId: string, value: string) => {
      setConfiguration((prev) => {
        const next: Record<string, InputMapping> = {};
        for (const [key, mapping] of Object.entries(prev)) {
          // Trocar o alvo dos inputs DINÂMICOS invalida os `param.<chave>` do alvo anterior — e só
          // esse alvo: os outros seletores não geram input nenhum a limpar.
          if (key.startsWith('param.') && inputId === dynamicInputsSourceId) continue;
          next[key] = mapping;
        }
        next[inputId] = { kind: 'Literal', value };
        return next;
      });
    },
    [dynamicInputsSourceId],
  );

  const stepOrder = useMemo(() => {
    if (editingStep) return editingStep.order + 1;
    return existingSteps.length + 1;
  }, [editingStep, existingSteps]);

  const workflowName = label(workflow?.name) || t('workflow.fallback-name');

  const eventFields = useMemo<WorkflowEventFieldOption[]>(() => {
    if (!workflow) return [];
    if (workflow.eventName === WORKFLOW_CALLED_EVENT) {
      return workflowParametersToFieldOptions(workflow.parameters, schemaContext);
    }
    return getWorkflowEventFields(workflow.eventName, schemaContext);
  }, [workflow, schemaContext]);

  const pathRoot = useMemo(
    () =>
      workflow
        ? workflow.eventName === WORKFLOW_CALLED_EVENT
          ? workflowParametersToRoot(workflow.parameters)
          : eventNameToRoot(workflow.eventName, schemaContext)
        : null,
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

  const setMappingKind = useCallback((inputId: string, kind: InputMapping['kind']) => {
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

      definition.outputDefinitions.forEach((output) => {
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

  const canSave = useMemo(() => {
    if (isConditionStep) return true;
    if (isLoopStep) return !!configuration.source && !!loopItemName.trim() && !!loopOutputName.trim();
    if (!selectedDefinition) return false;
    if (stepIdentifierError) return false;
    return effectiveInputs
      .filter((input) => input.required)
      .every((input) => configuration[input.id] !== undefined);
  }, [isConditionStep, isLoopStep, configuration, loopItemName, loopOutputName, selectedDefinition, effectiveInputs, stepIdentifierError]);

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

    // Modo Loop: edita a configuração de repetição de um nó de controle já existente,
    // preservando o corpo (loop.body).
    if (isLoopStep && editingStep && editingStep.loop) {
      const source = configuration.source;
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
    isLoopStep,
    loopItemName,
    loopOutputName,
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
    setMappingKind,
    setMapping,
    enabled,
    setEnabled,
    isConditionStep: !!isConditionStep,
    isLoopStep: !!isLoopStep,
    loopItemName,
    setLoopItemName,
    loopOutputName,
    setLoopOutputName,
    pendingCondition,
    setPendingCondition,
    conditionViewMode,
    setConditionViewMode,
    conditionFocusPath,
    handleRequestConditionEdit,
    clearConditionFocusPath,
    conditionEventName: workflow?.eventName ?? '',
    conditionParameters: workflow?.parameters,
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
