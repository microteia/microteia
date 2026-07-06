import { useState, useMemo, useCallback, useEffect } from 'react';
import type { IconType } from 'react-icons';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { useDI } from '../../../infrastructure/di/useDI';
import { syncWorkflowStepCatalog } from '../../../data/services/syncWorkflowStepCatalog';
import { getWorkflowEventFields, eventNameToEntityKey } from '../../../domain/services/workflowEventCatalog';
import { getStepIcon } from '../../shared/stepIcons';
import type { WorkflowEventFieldOption } from '../../../domain/services/workflowEventCatalog';
import type { InputMapping, WorkflowStep } from '../../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../../domain/entities/WorkflowStepCatalog';

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
  isSaving: boolean;
}

export const useEditWorkflowStepViewModel = (tabKey: string): EditWorkflowStepViewModel => {
  // Parse tabKey: "edit-workflow-step:workflowId" ou "edit-workflow-step:workflowId:stepId"
  const parts = tabKey.replace('edit-workflow-step:', '').split(':');
  const workflowId = parts[0] ?? '';
  const stepId = parts[1] ?? null;

  const { workflows, updateWorkflowSteps } = useWorkflowStore();
  const { closeTab, setTabTitle } = useWorkspace();
  const { notify } = useNotification();
  const { getCustomFieldsFor } = useScreenDefinitions();
  const { stepCatalogRepository } = useDI();

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
  const [configuration, setConfiguration] = useState<Record<string, InputMapping>>({});
  const [enabled, setEnabled] = useState(true);
  const [stepCatalog, setStepCatalog] = useState<StepDefinitionSummary[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [stepToDelete, setStepToDelete] = useState<WorkflowStep | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicializa o form ao montar ou mudar de step
    setSelectedDefinitionId(editingStep?.stepDefinitionId ?? '');
    setConfiguration(editingStep?.configuration ?? {});
    setEnabled(editingStep?.enabled ?? true);
  }, [editingStep]);

  useEffect(() => {
    void syncWorkflowStepCatalog().catch((error) => console.error('[EditWorkflowStep] syncWorkflowStepCatalog:', error));
  }, []);

  useEffect(() => stepCatalogRepository.subscribeToStepCatalog(setStepCatalog), [stepCatalogRepository]);

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

  useEffect(() => {
    const stepTypeName = selectedDefinition?.name ?? 'Novo Step';
    const title = `${workflowName} • ${stepOrder} • ${stepTypeName}`;
    setTabTitle(tabKey, title);
  }, [workflowName, stepOrder, selectedDefinition, tabKey, setTabTitle]);

  const selectDefinition = useCallback((stepDefinitionId: string) => {
    setSelectedDefinitionId(stepDefinitionId);
    setConfiguration({});
  }, []);

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
        configuration,
        enabled,
      };

      const updatedSteps = editingStep
        ? existingSteps.map((s) => (s.id === step.id ? step : s))
        : [...existingSteps, step];

      await updateWorkflowSteps(workflow.id, updatedSteps);
      notify('Step salvo com sucesso.', 'success');
      closeTab(tabKey);
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
    configuration,
    enabled,
    updateWorkflowSteps,
    notify,
    closeTab,
    tabKey,
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
      closeTab(tabKey);
    } catch (error) {
      console.error('[EditWorkflowStep] confirmDelete:', error);
      notify('Erro ao excluir step.', 'error');
    } finally {
      setStepToDelete(null);
    }
  }, [workflow, stepToDelete, existingSteps, updateWorkflowSteps, notify, closeTab, tabKey]);

  return {
    workflowName,
    stepOrder,
    selectedDefinitionId,
    selectedDefinition,
    selectedStepIcon,
    isDefinitionLocked: !!editingStep,
    selectDefinition,
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
    isSaving,
  };
};
