import { useState, useMemo, useCallback, useEffect } from 'react';
import { transform } from 'sucrase';
import { useScriptStore } from '../../../stores/useScriptStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { validateFieldKey } from '../../../domain/services/customFieldValues';
import { ENTITY_REGISTRY } from '../../../domain/schema/entityRegistry';
import type { Script, ScriptOutputParam } from '../../../domain/entities/Script';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';

const DEFAULT_SOURCE = `async function main() {
  // 'input' contém os parâmetros de entrada configurados no Step.
  // 'fn.*' expõe as funções de expressão (ex: fn.formatDate, fn.dateDiff).
  return {
    // preencha aqui os parâmetros de saída declarados
  };
}

main();
`;

export const SCRIPT_PARAMETER_TYPE_OPTIONS: { value: WorkflowParameter['type']; label: string }[] = [
  { value: 'String', label: 'Texto' },
  { value: 'Number', label: 'Número' },
  { value: 'Date', label: 'Data' },
  { value: 'Boolean', label: 'Booleano' },
  { value: 'select', label: 'Lista de opções' },
  { value: 'EntityReference', label: 'Referência a entidade' },
];

const sanitizeInputParams = (parameters: WorkflowParameter[]): WorkflowParameter[] =>
  parameters.map((parameter) => {
    const clean: WorkflowParameter = { key: parameter.key, label: parameter.label, type: parameter.type };
    if (parameter.required) clean.required = true;
    if (parameter.type === 'EntityReference') {
      if (parameter.entityType) clean.entityType = parameter.entityType;
      if (parameter.multi) clean.multi = true;
    }
    if (parameter.type === 'select' && parameter.options) clean.options = parameter.options;
    return clean;
  });

const sanitizeOutputParams = (parameters: ScriptOutputParam[]): ScriptOutputParam[] =>
  parameters.map((parameter) => {
    const clean: ScriptOutputParam = { key: parameter.key, label: parameter.label, type: parameter.type };
    if (parameter.type === 'EntityReference' && parameter.entityType) clean.entityType = parameter.entityType;
    return clean;
  });

const transpile = (sourceTs: string): { compiledJs: string } | { error: string } => {
  if (/\b(import|export)\b/.test(sourceTs) || /\brequire\s*\(/.test(sourceTs)) {
    return { error: 'Scripts não podem usar import, export ou require. Use apenas o objeto "input" e "fn.*".' };
  }
  try {
    const result = transform(sourceTs, { transforms: ['typescript'], disableESTransforms: true });
    if (!result.code.trim()) return { error: 'O código do script está vazio.' };
    return { compiledJs: result.code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : 'Código inválido.' };
  }
};

export interface ScriptFormData {
  name: string;
  description: string;
  sourceTs: string;
  inputParams: WorkflowParameter[];
  outputParams: ScriptOutputParam[];
}

const buildForm = (script: Script | null): ScriptFormData => ({
  name: script?.name ?? '',
  description: script?.description ?? '',
  sourceTs: script?.sourceTs ?? DEFAULT_SOURCE,
  inputParams: script?.inputParams ?? [],
  outputParams: script?.outputParams ?? [],
});

export interface ViewScriptViewModel {
  isNew: boolean;
  script: Script | null;
  formData: ScriptFormData;
  setFormData: (data: Partial<ScriptFormData>) => void;
  typeOptions: { value: WorkflowParameter['type']; label: string }[];
  entityOptions: { value: string; label: string }[];
  inputParamErrors: (string | undefined)[];
  outputParamErrors: (string | undefined)[];
  addInputParam: () => void;
  updateInputParam: (index: number, patch: Partial<WorkflowParameter>) => void;
  removeInputParam: (index: number) => void;
  addOutputParam: () => void;
  updateOutputParam: (index: number, patch: Partial<ScriptOutputParam>) => void;
  removeOutputParam: (index: number) => void;
  isSectionCollapsed: (key: string) => boolean;
  toggleSection: (key: string) => void;
  isSaving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  handleDelete: () => void;
  scriptToDelete: Script | null;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useViewScriptViewModel = (tabKey: string): ViewScriptViewModel => {
  const isNew = tabKey === 'new-script';
  const scriptId = isNew ? '' : tabKey.replace('view-script:', '');

  const { scripts, createScript, updateScript, deleteScript } = useScriptStore();
  const { currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { dynamicScreens } = useScreenDefinitions();

  const script = useMemo(
    () => (isNew ? null : (scripts.find((s) => s.id === scriptId) ?? null)),
    [isNew, scripts, scriptId],
  );

  const [formData, setFormDataState] = useState<ScriptFormData>(() => buildForm(null));
  const [isSaving, setIsSaving] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const isSectionCollapsed = useCallback((key: string) => collapsedSections.has(key), [collapsedSections]);

  const toggleSection = useCallback((key: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  useEffect(() => {
    if (script) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza formulário com script carregado da store
      setFormDataState(buildForm(script));
    }
  }, [script]);

  useEffect(() => {
    if (script) setTabTitle(tabKey, script.name || 'Script');
  }, [script, tabKey, setTabTitle]);

  const setFormData = useCallback((data: Partial<ScriptFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const entityOptions = useMemo(() => {
    const builtin = Object.values(ENTITY_REGISTRY)
      .filter((entity) => entity.referenceable)
      .map((entity) => ({ value: entity.collection, label: entity.labelPlural }));
    const custom = dynamicScreens.map((def) => ({ value: def.id, label: def.titlePlural }));
    return [...builtin, ...custom];
  }, [dynamicScreens]);

  const buildKeyErrors = useCallback(
    (keys: { key: string; entityType?: string; type: string }[], requireEntity: boolean): (string | undefined)[] => {
      const seen = new Set<string>();
      return keys.map((param) => {
        const keyError = validateFieldKey(param.key);
        if (keyError) return keyError;
        if (seen.has(param.key)) return 'Chave duplicada';
        seen.add(param.key);
        if (requireEntity && param.type === 'EntityReference' && !param.entityType) {
          return 'Selecione a entidade referenciada';
        }
        return undefined;
      });
    },
    [],
  );

  const inputParamErrors = useMemo(() => buildKeyErrors(formData.inputParams, true), [buildKeyErrors, formData.inputParams]);
  const outputParamErrors = useMemo(() => buildKeyErrors(formData.outputParams, true), [buildKeyErrors, formData.outputParams]);

  const addInputParam = useCallback(() => {
    setFormDataState((prev) => ({ ...prev, inputParams: [...prev.inputParams, { key: '', label: '', type: 'String' }] }));
  }, []);

  const updateInputParam = useCallback((index: number, patch: Partial<WorkflowParameter>) => {
    setFormDataState((prev) => ({
      ...prev,
      inputParams: prev.inputParams.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removeInputParam = useCallback((index: number) => {
    setFormDataState((prev) => ({ ...prev, inputParams: prev.inputParams.filter((_, i) => i !== index) }));
  }, []);

  const addOutputParam = useCallback(() => {
    setFormDataState((prev) => ({ ...prev, outputParams: [...prev.outputParams, { key: '', label: '', type: 'String' }] }));
  }, []);

  const updateOutputParam = useCallback((index: number, patch: Partial<ScriptOutputParam>) => {
    setFormDataState((prev) => ({
      ...prev,
      outputParams: prev.outputParams.map((p, i) => (i === index ? { ...p, ...patch } : p)),
    }));
  }, []);

  const removeOutputParam = useCallback((index: number) => {
    setFormDataState((prev) => ({ ...prev, outputParams: prev.outputParams.filter((_, i) => i !== index) }));
  }, []);

  const hasParamErrors = useMemo(
    () => inputParamErrors.some((e) => e) || outputParamErrors.some((e) => e),
    [inputParamErrors, outputParamErrors],
  );

  const canSave = useMemo(
    () => formData.name.trim().length > 0 && !hasParamErrors && !isSaving,
    [formData.name, hasParamErrors, isSaving],
  );

  const handleSave = useCallback(async () => {
    if (!currentTenant) return;

    const compiled = transpile(formData.sourceTs);
    if ('error' in compiled) {
      notify(compiled.error, 'error');
      return;
    }

    setIsSaving(true);
    try {
      const data = {
        name: formData.name.trim(),
        description: formData.description.trim(),
        sourceTs: formData.sourceTs,
        compiledJs: compiled.compiledJs,
        inputParams: sanitizeInputParams(formData.inputParams),
        outputParams: sanitizeOutputParams(formData.outputParams),
      };

      if (isNew) {
        const created = await createScript(data);
        notify('Script criado.', 'success');
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(`view-script:${created.id}`);
      } else if (script) {
        await updateScript(script.id, data);
        notify('Script salvo.', 'success');
      }
    } catch (error) {
      console.error('[ViewScript] handleSave:', error);
      notify('Erro ao salvar script.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant, formData, isNew, script, createScript, updateScript, notify, closeTab, tabKey, activePanelId, openTab]);

  const handleDelete = useCallback(() => {
    if (script) setScriptToDelete(script);
  }, [script]);

  const cancelDelete = useCallback(() => setScriptToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!scriptToDelete) return;
    try {
      await deleteScript(scriptToDelete.id);
      notify('Script excluído.', 'success');
      closeTab(tabKey, activePanelId);
    } catch (error) {
      console.error('[ViewScript] confirmDelete:', error);
      notify('Erro ao excluir script.', 'error');
    } finally {
      setScriptToDelete(null);
    }
  }, [scriptToDelete, deleteScript, notify, closeTab, tabKey, activePanelId]);

  return {
    isNew,
    script,
    formData,
    setFormData,
    typeOptions: SCRIPT_PARAMETER_TYPE_OPTIONS,
    entityOptions,
    inputParamErrors,
    outputParamErrors,
    addInputParam,
    updateInputParam,
    removeInputParam,
    addOutputParam,
    updateOutputParam,
    removeOutputParam,
    isSectionCollapsed,
    toggleSection,
    isSaving,
    canSave,
    handleSave,
    handleDelete,
    scriptToDelete,
    confirmDelete,
    cancelDelete,
  };
};
