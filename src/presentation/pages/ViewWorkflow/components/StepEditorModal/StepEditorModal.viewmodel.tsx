import { useState, useMemo, useCallback, useEffect } from 'react';
import type { InputMapping, WorkflowStep } from '../../../../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../../../../domain/entities/WorkflowStepCatalog';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';

export interface StepEditorModalProps {
  isOpen: boolean;
  stepCatalog: StepDefinitionSummary[];
  existingSteps: WorkflowStep[];
  editingStep: WorkflowStep | null;
  eventFields: WorkflowEventFieldOption[];
  onSave: (step: WorkflowStep) => void;
  onDelete?: (stepId: string) => void;
  onClose: () => void;
}

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

export interface StepEditorModalViewModel {
  selectedDefinitionId: string;
  selectedDefinition: StepDefinitionSummary | undefined;
  isDefinitionLocked: boolean;
  isNew: boolean;
  selectDefinition: (stepDefinitionId: string) => void;
  configuration: Record<string, InputMapping>;
  setMappingKind: (inputId: string, kind: InputMapping['kind']) => void;
  setMapping: (inputId: string, mapping: InputMapping) => void;
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  canSave: boolean;
  handleSave: () => void;
  handleDelete: () => void;
  priorSteps: WorkflowStep[];
}

export const useStepEditorModalViewModel = ({
  stepCatalog,
  existingSteps,
  editingStep,
  onSave,
  onDelete,
  onClose,
}: StepEditorModalProps): StepEditorModalViewModel => {
  const [selectedDefinitionId, setSelectedDefinitionId] = useState('');
  const [configuration, setConfiguration] = useState<Record<string, InputMapping>>({});
  const [enabled, setEnabled] = useState(true);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reinicializa o form ao abrir o modal para um step diferente
    setSelectedDefinitionId(editingStep?.stepDefinitionId ?? '');
    setConfiguration(editingStep?.configuration ?? {});
    setEnabled(editingStep?.enabled ?? true);
  }, [editingStep]);

  const selectedDefinition = useMemo(
    () => stepCatalog.find((s) => s.id === selectedDefinitionId),
    [stepCatalog, selectedDefinitionId],
  );

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

  const isNew = useMemo(() => !editingStep, [editingStep]);

  const handleSave = useCallback(() => {
    if (!selectedDefinition) return;
    const step: WorkflowStep = {
      id: editingStep?.id ?? crypto.randomUUID(),
      stepDefinitionId: selectedDefinition.id,
      type: 'Action',
      order: editingStep?.order ?? 0,
      configuration,
      enabled,
    };
    onSave(step);
  }, [selectedDefinition, editingStep, configuration, enabled, onSave]);

  const handleDelete = useCallback(() => {
    if (!editingStep?.id) return;
    onDelete?.(editingStep.id);
    onClose();
  }, [editingStep, onDelete, onClose]);

  return {
    selectedDefinitionId,
    selectedDefinition,
    isDefinitionLocked: !!editingStep,
    isNew,
    selectDefinition,
    configuration,
    setMappingKind,
    setMapping,
    enabled,
    setEnabled,
    canSave,
    handleSave,
    handleDelete,
    priorSteps,
  };
};
