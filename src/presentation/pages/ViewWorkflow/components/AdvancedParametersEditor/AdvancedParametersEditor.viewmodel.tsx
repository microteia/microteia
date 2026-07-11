import { useState, useCallback } from 'react';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';
import { parametersToDsl, dslToParameters } from '../../../../../domain/schema/workflowParameters';
import type { WorkflowParametersEditorVariant } from '../WorkflowParametersEditor/WorkflowParametersEditor.viewmodel';

export type AdvancedParametersMode = 'visual' | 'json';

export interface AdvancedParametersEditorProps {
  parameters: WorkflowParameter[];
  errors: (string | undefined)[];
  typeOptions: { value: WorkflowParameter['type']; label: string }[];
  entityOptions: { value: string; label: string }[];
  variant?: WorkflowParametersEditorVariant;
  onAdd: () => void;
  onUpdate: (index: number, patch: Partial<WorkflowParameter>) => void;
  onRemove: (index: number) => void;
  onClone: (index: number) => void;
  onReplace: (parameters: WorkflowParameter[]) => void;
}

export interface AdvancedParametersEditorViewModel {
  mode: AdvancedParametersMode;
  jsonText: string;
  jsonErrors: string[];
  enterVisual: () => void;
  enterJson: () => void;
  setJsonText: (text: string) => void;
  applyJson: () => void;
}

export const useAdvancedParametersEditorViewModel = (
  props: AdvancedParametersEditorProps,
): AdvancedParametersEditorViewModel => {
  const { parameters, onReplace } = props;
  const [mode, setMode] = useState<AdvancedParametersMode>('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);

  const enterJson = useCallback(() => {
    setJsonText(parametersToDsl(parameters));
    setJsonErrors([]);
    setMode('json');
  }, [parameters]);

  const enterVisual = useCallback(() => {
    setJsonErrors([]);
    setMode('visual');
  }, []);

  const applyJson = useCallback(() => {
    const result = dslToParameters(jsonText);
    if (result.errors) {
      setJsonErrors(result.errors);
      return;
    }
    onReplace(result.params ?? []);
    setJsonErrors([]);
    setMode('visual');
  }, [jsonText, onReplace]);

  return { mode, jsonText, jsonErrors, enterVisual, enterJson, setJsonText, applyJson };
};
