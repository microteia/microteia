import { useState, useMemo, useCallback, useEffect } from 'react';
import type { IconType } from 'react-icons';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useStepCatalog } from '../../../stores/useStepCatalog';
import { getWorkflowEventFields, eventNameToEntityKey, eventNameToRoot } from '../../../domain/services/workflowEventCatalog';
import type { PathRoot } from '../../../domain/schema/pathResolver';
import { getStepIcon } from '../../shared/stepIcons';
import { getStepDisplayName } from '../../shared/workflowHelpers';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import type { InputMapping, WorkflowStep } from '../../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../../domain/entities/WorkflowStepCatalog';
import type { QuerySpec } from '../../../domain/schema/querySpec';
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
  setMappingKind: (inputId: string, kind: InputMapping['kind']) => void;
  setMapping: (inputId: string, mapping: InputMapping) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
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
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  isSaving: boolean;
  getStepOutputs: (stepId: string) => { value: string; label: string }[];
}

export const useEditWorkflowStepViewModel = (tabKey: string): EditWorkflowStepViewModel => {
  // Parse tabKey: "edit-workflow-step:workflowId" ou "edit-workflow-step:workflowId:stepId"
  const parts = tabKey.replace('edit-workflow-step:', '').split(':');
  const workflowId = parts[0] ?? '';
  const stepId = parts[1] ?? null;

  const { workflows, updateWorkflowSteps } = useWorkflowStore();
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
    () => stepId ? existingSteps.find((s) => s.id === stepId) ?? null : null,
    [stepId, existingSteps],
  );

  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [signature, setSignature] = useState('');
  const [configuration, setConfiguration] = useState<Record<string, InputMapping>>({});
  const [enabled, setEnabled] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<WorkflowStep | null>(null);

  // Carrega o catálogo de steps uma vez (idempotente)
  useEffect(() => {
    void loadCatalog().catch((error) => console.error('[EditWorkflowStep] loadCatalog:', error));
  }, [loadCatalog]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicializa o form ao montar ou mudar de step
    setSelectedDefinitionId(editingStep?.stepDefinitionId ?? '');
    setSignature(editingStep?.signature ?? '');
    setConfiguration(editingStep?.configuration ?? {});
    setEnabled(editingStep?.enabled ?? true);
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

  const stepOrder = useMemo(() => {
    if (editingStep) return editingStep.order + 1;
    return existingSteps.length + 1;
  }, [editingStep, existingSteps]);

  const workflowName = workflow?.name ?? 'Automação';

  const eventFields = useMemo<WorkflowEventFieldOption[]>(() => {
    if (!workflow) return [];

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
    () => (workflow ? eventNameToRoot(workflow.eventName, workflow.screenKey) : null),
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
    () => existingSteps.filter((s) => s.order < (editingStep?.order ?? Infinity)),
    [existingSteps, editingStep],
  );

  const stepOutputFields = useMemo(() => {
    const fields: StepOutputField[] = [];
    priorSteps.forEach((step) => {
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
    });
    return fields;
  }, [priorSteps, stepCatalog]);

  const getStepOutputs = useCallback((stepId: string) => {
    const step = priorSteps.find((s) => s.id === stepId);
    if (!step) return [];

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

    return outputs;
  }, [priorSteps, stepCatalog]);

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
    if (!selectedDefinition) return false;
    return selectedDefinition.inputs
      .filter((input) => input.required)
      .every((input) => configuration[input.id] !== undefined);
  }, [selectedDefinition, configuration]);

  const handleSave = useCallback(async () => {
    if (!selectedDefinition || !workflow) return;

    setIsSaving(true);
    try {
      const step: WorkflowStep = {
        id: editingStep?.id ?? crypto.randomUUID(),
        stepDefinitionId: selectedDefinition.id,
        type: 'Action',
        order: editingStep?.order ?? existingSteps.length,
        ...(signature.trim() ? { signature: signature.trim() } : {}),
        configuration,
        enabled,
      };

      const updatedSteps = editingStep
        ? existingSteps.map((s) => (s.id === step.id ? step : s))
        : [...existingSteps, step];

      await updateWorkflowSteps(workflow.id, updatedSteps);
      notify('Step salvo com sucesso.', 'success');
      closeTab(tabKey, activePanelId ?? 'main');
    } catch (error) {
      notify(`Erro ao salvar step: ${String(error)}`, 'error');
    } finally {
      setIsSaving(false);
    }
  }, [
    selectedDefinition,
    workflow,
    editingStep,
    existingSteps,
    signature,
    configuration,
    enabled,
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
    const nextSteps = existingSteps
      .filter((s) => s.id !== stepToDelete.id)
      .sort((a, b) => a.order - b.order)
      .map((s, index) => ({ ...s, order: index }));
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
    setMappingKind,
    setMapping,
    enabled,
    setEnabled,
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
    stepOutputFields,
    workflowVariables,
    isSaving,
    getStepOutputs,
  };
};
