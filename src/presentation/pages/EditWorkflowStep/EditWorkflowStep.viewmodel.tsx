import { useState, useMemo, useCallback, useEffect } from 'react';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { syncWorkflowStepCatalog } from '../../../data/services/syncWorkflowStepCatalog';
import { getWorkflowEventFields } from '../../../domain/services/workflowEventCatalog';
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
  isDefinitionLocked: boolean;
  selectDefinition: (stepDefinitionId: string) => void;
  configuration: Record<string, InputMapping>;
  setMappingKind: (inputId: string, kind: InputMapping['kind']) => void;
  setMapping: (inputId: string, mapping: InputMapping) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  canSave: boolean;
  handleSave: () => Promise<void>;
  handleCancel: () => void;
  priorSteps: WorkflowStep[];
  stepCatalog: StepDefinitionSummary[];
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

  const stepOrder = useMemo(() => {
    if (editingStep) return editingStep.order + 1;
    return existingSteps.length + 1;
  }, [editingStep, existingSteps]);

  const workflowName = workflow?.name ?? 'Automação';

  const eventFields = useMemo<WorkflowEventFieldOption[]>(() => {
    if (!workflow) return [];
    return getWorkflowEventFields(workflow.eventName, workflow.screenKey, workflow.lookupCollection);
  }, [workflow]);

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

  const handleCancel = useCallback(() => {
    closeTab(tabKey);
  }, [closeTab, tabKey]);

  return {
    workflowName,
    stepOrder,
    selectedDefinitionId,
    selectedDefinition,
    isDefinitionLocked: !!editingStep,
    selectDefinition,
    configuration,
    setMappingKind,
    setMapping,
    enabled,
    setEnabled,
    canSave,
    handleSave,
    handleCancel,
    priorSteps,
    stepCatalog,
    eventFields,
    isSaving,
  };
};
