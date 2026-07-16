import { useState, useMemo, useCallback, useEffect } from 'react';
import type { IconType } from 'react-icons';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useScriptStore } from '../../../stores/useScriptStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useStepCatalog } from '../../../stores/useStepCatalog';
import { getWorkflowEventFields, eventNameToEntityKey, eventNameToRoot, WORKFLOW_CALLED_EVENT, workflowParametersToRoot, workflowParametersToFieldOptions } from '../../../domain/services/workflowEventCatalog';
import { workflowParameterToNativeField } from '../../../domain/schema/eventCatalog';
import type { PathRoot } from '../../../domain/schema/pathResolver';
import type { NativeFieldSpec } from '../../../domain/schema/entityRegistry';
import { getStepIcon } from '../../shared/stepIcons';
import {
  getStepDisplayName,
  findStepInTree,
  collectPriorSteps,
  collectPriorStepsForInsert,
  insertStepInto,
  replaceStepInTree,
  removeStepFromTree,
} from '../../shared/workflowHelpers';
import type { InsertTarget, BranchKey } from '../../shared/workflowHelpers';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import type { Condition, InputMapping, WorkflowParameter, WorkflowStep } from '../../../domain/entities/Workflow';
import type { InputDefinition, StepDefinitionSummary } from '../../../domain/entities/WorkflowStepCatalog';
import type { QuerySpec } from '../../../domain/schema/querySpec';
import type { MapStepConfig } from '../../../domain/schema/mapSpec';
import type { ValidateStepConfig } from '../../../domain/schema/validateSpec';
import type { StepOutputField, WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';

const queryProjectionOutputs = (
  step: WorkflowStep,
  definition: StepDefinitionSummary,
): { id: string; label: string }[] => {
  if (definition.dynamicOutputs?.kind !== 'from-query-projections') return [];
  const mapping = step.configuration[definition.dynamicOutputs.sourceInputId];
  if (!mapping || mapping.kind !== 'Literal' || !mapping.value || typeof mapping.value !== 'object') return [];
  return ((mapping.value as QuerySpec).projections ?? [])
    .filter((path) => path.trim())
    .map((path) => ({ id: `first.${path}`, label: `${path} (1º resultado)` }));
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

const parameterToInputDefinitions = (
  parameter: WorkflowParameter,
  idPrefix = 'param',
  labelPrefix = '',
): InputDefinition[] => {
  const id = `${idPrefix}.${parameter.key}`;
  const label = labelPrefix ? `${labelPrefix} › ${parameter.label}` : parameter.label;
  if (parameter.list) {
    return [{ id, label: `${label} (lista)`, required: parameter.required ?? false, type: 'String' }];
  }
  if (parameter.type === 'Object') {
    return (parameter.fields ?? []).flatMap((child) => parameterToInputDefinitions(child, id, label));
  }
  const base = { id, label, required: parameter.required ?? false, rules: parameter.rules };
  switch (parameter.type) {
    case 'EntityReference':
      return [{ ...base, type: 'EntityReference', entityType: parameter.entityType }];
    case 'select':
      return [{ ...base, type: 'String', options: { kind: 'Static', options: parameter.options ?? [] } }];
    case 'Number':
      return [{ ...base, type: 'Number' }];
    case 'Date':
      return [{ ...base, type: 'Date' }];
    case 'Boolean':
      return [{ ...base, type: 'Boolean' }];
    default:
      return [{ ...base, type: 'String' }];
  }
};

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

const CONDITION_VIEW_MODE_KEY = 'curatino:workflowConditionViewMode';

const loadConditionViewMode = (): ConditionViewMode => {
  try {
    return localStorage.getItem(CONDITION_VIEW_MODE_KEY) === 'diagram' ? 'diagram' : 'editor';
  } catch {
    return 'editor';
  }
};

export interface EditWorkflowStepViewModel {
  workflowName: string;
  stepOrder: number;
  selectedDefinitionId: string;
  selectedDefinition: StepDefinitionSummary | undefined;
  selectedStepIcon: IconType | null;
  isDefinitionLocked: boolean;
  selectDefinition: (stepDefinitionId: string) => void;
  signature: string;
  setSignature: (signature: string) => void;
  configuration: Record<string, InputMapping>;
  effectiveInputs: InputDefinition[];
  dynamicInputsSourceId: string | null;
  dynamicTargetKind: 'workflow' | 'script' | null;
  callableWorkflowOptions: { value: string; label: string }[];
  callableScriptOptions: { value: string; label: string }[];
  setTargetWorkflow: (sourceInputId: string, targetWorkflowId: string) => void;
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
  conditionScreenKey?: string;
  conditionParameters?: WorkflowParameter[];
  canSave: boolean;
  handleSave: () => Promise<void>;
  handleDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
  stepToDelete: WorkflowStep | null;
  priorSteps: WorkflowStep[];
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
  // Parse tabKey:
  //   "edit-workflow-step:{wfId}"                         → adicionar step na raiz
  //   "edit-workflow-step:{wfId}:{stepId}"                → editar step existente
  //   "edit-workflow-step:{wfId}:add:{condId}:{branch}"   → adicionar step num ramo de condição
  //   "edit-workflow-step:{wfId}:addloop:{loopId}"        → adicionar step no corpo de um Loop
  const parts = useMemo(() => tabKey.replace('edit-workflow-step:', '').split(':'), [tabKey]);
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
  const { closeTab, setTabTitle, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { getCustomFieldsFor } = useScreenDefinitions();
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
  const [signature, setSignature] = useState('');
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
    setSignature(editingStep?.signature ?? '');
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
    return workflows.find((w) => w.id === id && w.eventName === WORKFLOW_CALLED_EVENT) ?? null;
  }, [dynamicTargetKind, dynamicInputsSourceId, configuration, workflows]);

  const targetScript = useMemo(() => {
    if (dynamicTargetKind !== 'script' || !dynamicInputsSourceId) return null;
    const mapping = configuration[dynamicInputsSourceId];
    const id = mapping?.kind === 'Literal' ? String(mapping.value ?? '') : '';
    if (!id) return null;
    return scripts.find((s) => s.id === id) ?? null;
  }, [dynamicTargetKind, dynamicInputsSourceId, configuration, scripts]);

  const effectiveInputs = useMemo<InputDefinition[]>(() => {
    if (!selectedDefinition) return [];
    if (!dynamicInputsSourceId) return selectedDefinition.inputs;
    const source = dynamicTargetKind === 'script'
      ? (targetScript?.inputParams ?? [])
      : (targetWorkflow?.parameters ?? []);
    const paramInputs = source.flatMap((parameter) => parameterToInputDefinitions(parameter));
    return [...selectedDefinition.inputs, ...paramInputs];
  }, [selectedDefinition, dynamicInputsSourceId, dynamicTargetKind, targetWorkflow, targetScript]);

  const callableWorkflowOptions = useMemo(
    () =>
      workflows
        .filter((w) => w.eventName === WORKFLOW_CALLED_EVENT && w.id !== workflowId)
        .map((w) => ({ value: w.id, label: w.name })),
    [workflows, workflowId],
  );

  const callableScriptOptions = useMemo(
    () => scripts.map((s) => ({ value: s.id, label: s.name })),
    [scripts],
  );

  const setTargetWorkflow = useCallback((sourceInputId: string, targetWorkflowId: string) => {
    setConfiguration((prev) => {
      const next: Record<string, InputMapping> = {};
      for (const [key, mapping] of Object.entries(prev)) {
        if (!key.startsWith('param.')) next[key] = mapping;
      }
      next[sourceInputId] = { kind: 'Literal', value: targetWorkflowId };
      return next;
    });
  }, []);

  const stepOrder = useMemo(() => {
    if (editingStep) return editingStep.order + 1;
    return existingSteps.length + 1;
  }, [editingStep, existingSteps]);

  const workflowName = workflow?.name ?? 'Automação';

  const eventFields = useMemo<WorkflowEventFieldOption[]>(() => {
    if (!workflow) return [];

    if (workflow.eventName === WORKFLOW_CALLED_EVENT) return workflowParametersToFieldOptions(workflow.parameters);

    // Busca campos customizados da entidade, se houver
    const entityKey = eventNameToEntityKey(workflow.eventName);
    const customFields = entityKey ? getCustomFieldsFor(entityKey) : [];

    // Mapeia FieldDefinition[] para WorkflowEventFieldOption[]
    const dynamicFields: WorkflowEventFieldOption[] = customFields.map((field) => ({
      path: field.key,
      label: field.label,
    }));

    return getWorkflowEventFields(workflow.eventName, dynamicFields);
  }, [workflow, getCustomFieldsFor]);

  const pathRoot = useMemo(
    () =>
      workflow
        ? workflow.eventName === WORKFLOW_CALLED_EVENT
          ? workflowParametersToRoot(workflow.parameters)
          : eventNameToRoot(workflow.eventName, workflow.screenKey)
        : null,
    [workflow],
  );

  useEffect(() => {
    const stepTypeName = selectedDefinition?.name ?? 'Novo Step';
    const title = `${workflowName} • ${stepOrder} • ${stepTypeName}`;
    setTabTitle(tabKey, title);
  }, [workflowName, stepOrder, selectedDefinition, tabKey, setTabTitle]);

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
  }, [stepCatalog]);

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
      const script = scripts.find((s) => s.id === id);
      return (script?.outputParams ?? []).map((param) => ({ id: param.key, label: param.label || param.key }));
    },
    [scripts],
  );

  const stepOutputFields = useMemo(() => {
    const fields: StepOutputField[] = [];
    priorSteps.forEach((step) => {
      if (step.type === 'Loop' && step.loop) {
        fields.push({
          stepId: step.id,
          stepName: getStepDisplayName(step),
          outputId: step.loop.outputName,
          outputLabel: `${step.loop.outputName} (lista)`,
        });
        return;
      }
      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      if (!definition) return;

      const stepName = getStepDisplayName(step, definition);
      definition.outputDefinitions.forEach((output) => {
        fields.push({
          stepId: step.id,
          stepName,
          outputId: output.id,
          outputLabel: output.label,
        });
      });
      queryProjectionOutputs(step, definition).forEach((output) => {
        fields.push({ stepId: step.id, stepName, outputId: output.id, outputLabel: output.label });
      });
      scriptOutputsFor(step, definition).forEach((output) => {
        fields.push({ stepId: step.id, stepName, outputId: output.id, outputLabel: output.label });
      });
      const mapConfig = objectOutputConfigOf(step, definition);
      if (mapConfig) {
        mapOutputNames(mapConfig).forEach((name) => {
          fields.push({ stepId: step.id, stepName, outputId: name, outputLabel: name });
        });
      }
    });
    return fields;
  }, [priorSteps, stepCatalog, scriptOutputsFor]);

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
        const script = scripts.find((s) => s.id === id);
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

    if (step.type === 'Loop' && step.loop) {
      return [{ value: step.loop.outputName, label: `${step.loop.outputName} (lista)` }];
    }

    const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
    if (!definition) return [];

    const outputs: { value: string; label: string }[] = [];

    // Outputs estáticos
    definition.outputDefinitions.forEach((output) => {
      outputs.push({ value: output.id, label: output.label });
    });

    // Outputs dinâmicos
    if (definition.dynamicOutputs && definition.dynamicOutputs.kind === 'from-input-field') {
      const sourceIds = Array.isArray(definition.dynamicOutputs.sourceInputId)
        ? definition.dynamicOutputs.sourceInputId
        : [definition.dynamicOutputs.sourceInputId];

      sourceIds.forEach((sourceInputId) => {
        const mapping = step.configuration[sourceInputId];
        if (mapping && mapping.kind === 'Literal' && mapping.value) {
          const outputId = String(mapping.value);
          outputs.push({
            value: outputId,
            label: `${outputId} (dinâmico)`
          });
        }
      });
    }

    queryProjectionOutputs(step, definition).forEach((output) => {
      outputs.push({ value: output.id, label: output.label });
    });

    scriptOutputsFor(step, definition).forEach((output) => {
      outputs.push({ value: output.id, label: output.label });
    });

    const mapConfig = objectOutputConfigOf(step, definition);
    if (mapConfig) {
      const suffix = mapConfig.name?.trim() ? '(objeto)' : '(campo)';
      mapOutputNames(mapConfig).forEach((name) => {
        outputs.push({ value: name, label: `${name} ${suffix}` });
      });
    }

    return outputs;
  }, [priorSteps, stepCatalog, scriptOutputsFor]);

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
            const stepName = getStepDisplayName(step, definition);
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
  }, [priorSteps, stepCatalog]);

  const canSave = useMemo(() => {
    if (isConditionStep) return true;
    if (isLoopStep) return !!configuration.source && !!loopItemName.trim() && !!loopOutputName.trim();
    if (!selectedDefinition) return false;
    return effectiveInputs
      .filter((input) => input.required)
      .every((input) => configuration[input.id] !== undefined);
  }, [isConditionStep, isLoopStep, configuration, loopItemName, loopOutputName, selectedDefinition, effectiveInputs]);

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
          ...(signature.trim() ? { signature: signature.trim() } : {}),
          configuration: {},
          enabled,
          condition: pendingCondition,
          branches: editingStep.branches ?? { whenTrue: [], whenFalse: [] },
        };
        await updateWorkflowSteps(workflow.id, replaceStepInTree(existingSteps, updated));
        notify('Condição salva com sucesso.', 'success');
        closeTab(tabKey, activePanelId ?? 'main');
      } catch (error) {
        notify(`Erro ao salvar condição: ${String(error)}`, 'error');
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
          ...(signature.trim() ? { signature: signature.trim() } : {}),
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
        notify('Repetição salva com sucesso.', 'success');
        closeTab(tabKey, activePanelId ?? 'main');
      } catch (error) {
        notify(`Erro ao salvar repetição: ${String(error)}`, 'error');
      } finally {
        setIsSaving(false);
      }
      return;
    }

    if (!selectedDefinition) return;

    setIsSaving(true);
    try {
      const step: WorkflowStep = {
        id: editingStep?.id ?? crypto.randomUUID(),
        stepDefinitionId: selectedDefinition.id,
        type: selectedDefinition.type,
        order: editingStep?.order ?? 0,
        ...(signature.trim() ? { signature: signature.trim() } : {}),
        configuration,
        enabled,
      };

      const updatedSteps = editingStep
        ? replaceStepInTree(existingSteps, step)
        : insertStepInto(existingSteps, insertTarget, step);

      await updateWorkflowSteps(workflow.id, updatedSteps);
      notify('Step salvo com sucesso.', 'success');
      closeTab(tabKey, activePanelId ?? 'main');
    } catch (error) {
      notify(`Erro ao salvar step: ${String(error)}`, 'error');
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
    signature,
    configuration,
    enabled,
    pendingCondition,
    updateWorkflowSteps,
    notify,
    closeTab,
    tabKey,
    activePanelId,
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
      notify('Step excluído.', 'success');
      closeTab(tabKey, activePanelId ?? 'main');
    } catch (error) {
      console.error('[EditWorkflowStep] confirmDelete:', error);
      notify('Erro ao excluir step.', 'error');
    } finally {
      setStepToDelete(null);
    }
  }, [workflow, stepToDelete, existingSteps, updateWorkflowSteps, notify, closeTab, tabKey, activePanelId]);

  return {
    workflowName,
    stepOrder,
    selectedDefinitionId,
    selectedDefinition,
    selectedStepIcon,
    isDefinitionLocked: !!editingStep,
    selectDefinition,
    signature,
    setSignature,
    configuration,
    effectiveInputs,
    dynamicInputsSourceId,
    dynamicTargetKind,
    callableWorkflowOptions,
    callableScriptOptions,
    setTargetWorkflow,
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
    conditionScreenKey: workflow?.screenKey,
    conditionParameters: workflow?.parameters,
    canSave,
    handleSave,
    handleDelete,
    confirmDelete,
    cancelDelete,
    stepToDelete,
    priorSteps,
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
