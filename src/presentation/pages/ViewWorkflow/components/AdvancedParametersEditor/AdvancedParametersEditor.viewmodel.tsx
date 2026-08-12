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

export const PARAMETERS_JSON_EXAMPLE = `{
  "titulo": "String",
  "valor": { "type": "Number", "label": "Valor", "required": true, "default": 0 },
  "vencimento": { "type": "Date", "label": "Vencimento" },
  "ativo": { "type": "Boolean", "label": "Ativo", "default": true },
  "prioridade": {
    "type": "select",
    "label": "Prioridade",
    "options": ["Alta", "Média", "Baixa"]
  },
  "cliente": { "type": "EntityReference", "label": "Cliente", "entityType": "clients" },
  "envolvidos": { "type": "EntityReference", "label": "Envolvidos", "entityType": "clients", "list": true },
  "tags": { "type": "String", "label": "Etiquetas", "list": true },
  "itens": {
    "type": "Object",
    "label": "Itens",
    "list": true,
    "fields": {
      "descricao": "String",
      "valor": { "type": "Number", "label": "Valor" }
    }
  },
  "endereco": {
    "type": "Object",
    "label": "Endereço",
    "fields": {
      "rua": "String",
      "numero": { "type": "Number", "label": "Número" }
    }
  }
}`;

export const useAdvancedParametersEditorViewModel = (
  props: AdvancedParametersEditorProps,
): AdvancedParametersEditorViewModel => {
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
      setJsonErrors(result.errors);
      return;
    }
    onReplace(result.params ?? []);
    setJsonErrors([]);
    setMode('visual');
  }, [jsonText, onReplace]);

  const toggleReference = useCallback(() => setShowReference((prev) => !prev), []);

  const insertExample = useCallback(() => {
    setJsonText(PARAMETERS_JSON_EXAMPLE);
    setJsonErrors([]);
  }, []);

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
