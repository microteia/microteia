import { useState, useCallback } from 'react';
import type { WorkflowParameter } from '../../../../../domain/entities/Workflow';
import { parametersToDsl, dslToParameters } from '../../../../../domain/schema/workflowParameters';
import type { WorkflowParametersEditorVariant } from '../WorkflowParametersEditor/WorkflowParametersEditor.viewmodel';

import { useT, useLabel, type TranslateFn } from '../../../../shared/i18n/useT';

export type AdvancedParametersMode = 'visual' | 'json';

export interface AdvancedParametersEditorProps {
  parameters: WorkflowParameter[];
  errors: (string | undefined)[];
  typeOptions: { value: WorkflowParameter['type']; label: string }[];
  entityOptions: { value: string; label: string }[];
  lookupOptions: { value: string; label: string }[];
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
  showReference: boolean;
  enterVisual: () => void;
  enterJson: () => void;
  setJsonText: (text: string) => void;
  applyJson: () => void;
  toggleReference: () => void;
  insertExample: () => void;
}

/**
 * O exemplo colável do editor JSON. É CONTEÚDO de demonstração, não interface: as chaves imitam um
 * cadastro que o autor reconheceria. Escrito no idioma-fonte como o resto do produto — quem traduzir
 * pode querer trocar os nomes de exemplo, e por isso ele também sai do catálogo.
 */
export const parametersJsonExample = (t: TranslateFn): string => t('parameter.json-example');

export const useAdvancedParametersEditorViewModel = (
  props: AdvancedParametersEditorProps,
): AdvancedParametersEditorViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const { parameters, onReplace } = props;
  const [mode, setMode] = useState<AdvancedParametersMode>('visual');
  const [jsonText, setJsonText] = useState('');
  const [jsonErrors, setJsonErrors] = useState<string[]>([]);
  const [showReference, setShowReference] = useState(false);

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
      setJsonErrors(result.errors.map(
        (issue) => `${issue.path}: ${label(issue.message, issue.messageParams)}`,
      ));
      return;
    }
    onReplace(result.params ?? []);
    setJsonErrors([]);
    setMode('visual');
  }, [jsonText, onReplace, label]);

  const toggleReference = useCallback(() => setShowReference((prev) => !prev), []);

  const insertExample = useCallback(() => {
    setJsonText(parametersJsonExample(t));
    setJsonErrors([]);
  }, [t]);

  return {
    mode,
    jsonText,
    jsonErrors,
    showReference,
    enterVisual,
    enterJson,
    setJsonText,
    applyJson,
    toggleReference,
    insertExample,
  };
};
