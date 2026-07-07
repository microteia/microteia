import { useState, useMemo, useCallback, useEffect } from 'react';
import type { InputMapping, WorkflowStep } from '../../../../../domain/entities/Workflow';
import type { StepDefinitionSummary } from '../../../../../domain/entities/WorkflowStepCatalog';
import type { WorkflowEventFieldOption } from '../../../../../domain/services/workflowEventCatalog';
import type { StepOutputField, WorkflowVariable } from '../../../../components/ui/ExpressionEditor/autocompleteHelpers';

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
  stepOutputFields: StepOutputField[];
  workflowVariables: WorkflowVariable[];
  getStepOutputs: (stepId: string) => { value: string; label: string }[];
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

      const stepName = step.name ?? definition.name;
      definition.outputDefinitions.forEach((output) => {
        fields.push({
          stepId: step.id,
          stepName,
          outputId: output.id,
          outputLabel: output.label,
        });
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

    return outputs;
  }, [priorSteps, stepCatalog]);

  const workflowVariables = useMemo(() => {
    const variables: WorkflowVariable[] = [];
    
    priorSteps.forEach((step) => {
      const definition = stepCatalog.find((d) => d.id === step.stepDefinitionId);
      if (!definition || !definition.dynamicOutputs) return;

      const { dynamicOutputs } = definition;
      
      // Só processa 'from-input-field' por enquanto
      if (dynamicOutputs.kind === 'from-input-field') {
        const sourceIds = Array.isArray(dynamicOutputs.sourceInputId) 
          ? dynamicOutputs.sourceInputId 
          : [dynamicOutputs.sourceInputId];

        sourceIds.forEach((sourceInputId) => {
          const mapping = step.configuration[sourceInputId];
          if (mapping && mapping.kind === 'Literal' && mapping.value) {
            const stepName = step.name ?? definition.name;
            variables.push({
              name: String(mapping.value),
              definedBy: stepName,
            });
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
    stepOutputFields,
    workflowVariables,
    getStepOutputs,
  };
};
