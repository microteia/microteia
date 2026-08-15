import { useState, useMemo, useCallback, useEffect } from 'react';
import { transform } from 'sucrase';
import { useScriptStore } from '../../../stores/useScriptStore';
import { artifactIdIssue, deriveArtifactId } from '../../../domain/services/artifactIdentity';
import { useDI } from '../../../infrastructure/di/useDI';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useScreenDefinitions } from '../../../stores/useScreenDefinitions';
import { toSchemaScreens } from '../../../data/utils/recordRulesGate';
import { useEntityReferenceOptions, useLookupCollectionOptions } from '../../shared/useParameterOptions';
import { useExpressionFunctions } from '../../../stores/useExpressionFunctions';
import {
  siblingParameterErrors,
  hasParameterErrorsDeep,
  sanitizeWorkflowParameters,
  sanitizeScriptOutputParams,
  cloneParameterInList,
} from '../../../domain/schema/workflowParameters';
import { buildScriptTypeDefs } from './scriptTypeDefs';
import type { Script, ScriptOutputParam } from '../../../domain/entities/Script';
import type { WorkflowParameter } from '../../../domain/entities/Workflow';
import type { RunModalResult } from '../../components/ui/RunModal';

import { useT, useLabel, type TranslateFn } from '../../shared/i18n/useT';
import { PARAMETER_TYPE_KEYS } from '../../shared/parameterTypeKeys';

/**
 * O esqueleto que aparece num script novo. Os COMENTÁRIOS dele são texto de usuário — quem escreve o
 * script os lê —, então vêm do catálogo como qualquer outra frase, num bloco só.
 */
const defaultSource = (t: TranslateFn): string => `async function main() {
${t('script.starter.comments')}
  return {
${t('script.starter.return-comment')}
  };
}

main();
`;

export const scriptParameterTypeOptions = (
  t: TranslateFn,
): { value: WorkflowParameter['type']; label: string }[] =>
  (Object.keys(PARAMETER_TYPE_KEYS) as WorkflowParameter['type'][]).map((type) => ({
    value: type,
    label: t(PARAMETER_TYPE_KEYS[type]),
  }));

const sanitizeInputParams = sanitizeWorkflowParameters;
const sanitizeOutputParams = sanitizeScriptOutputParams;

const transpile = (sourceTs: string): { compiledJs: string } | { error: string } => {
  if (/\b(import|export)\b/.test(sourceTs) || /\brequire\s*\(/.test(sourceTs)) {
    return { error: '@core.automation/script.error.no-modules' };
  }
  try {
    const result = transform(sourceTs, { transforms: ['typescript'], disableESTransforms: true });
    if (!result.code.trim()) return { error: '@core.automation/script.error.empty' };
    return { compiledJs: result.code };
  } catch (error) {
    return { error: error instanceof Error ? error.message : '@core.automation/script.error.invalid' };
  }
};

export interface ScriptFormData {
  /** Id do documento — o que um Step e um pacote guardam para apontar para este script. */
  scriptId: string;
  name: string;
  description: string;
  sourceTs: string;
  inputParams: WorkflowParameter[];
  outputParams: ScriptOutputParam[];
}

const buildForm = (script: Script | null, t: TranslateFn): ScriptFormData => ({
  scriptId: script?.id ?? '',
  name: script?.name ?? '',
  description: script?.description ?? '',
  sourceTs: script?.sourceTs ?? defaultSource(t),
  inputParams: script?.inputParams ?? [],
  outputParams: script?.outputParams ?? [],
});

export interface ViewScriptViewModel {
  isNew: boolean;
  /** O identificador: editável só na inclusão, sugerido a partir do nome. */
  suggestedScriptId: string;
  scriptIdError: string | undefined;
  script: Script | null;
  formData: ScriptFormData;
  scriptTypeDefs: string;
  setFormData: (data: Partial<ScriptFormData>) => void;
  typeOptions: { value: WorkflowParameter['type']; label: string }[];
  entityOptions: { value: string; label: string }[];
  lookupOptions: { value: string; label: string }[];
  inputParamErrors: (string | undefined)[];
  outputParamErrors: (string | undefined)[];
  addInputParam: () => void;
  updateInputParam: (index: number, patch: Partial<WorkflowParameter>) => void;
  removeInputParam: (index: number) => void;
  addOutputParam: () => void;
  updateOutputParam: (index: number, patch: Partial<ScriptOutputParam>) => void;
  removeOutputParam: (index: number) => void;
  replaceInputParams: (inputParams: WorkflowParameter[]) => void;
  replaceOutputParams: (outputParams: ScriptOutputParam[]) => void;
  cloneInputParam: (index: number) => void;
  cloneOutputParam: (index: number) => void;
  isSectionCollapsed: (key: string) => boolean;
  toggleSection: (key: string) => void;
  openDataFunctionReference: () => void;
  isSaving: boolean;
  canSave: boolean;
  handleSave: () => Promise<void>;
  runModalOpen: boolean;
  openRunModal: () => void;
  closeRunModal: () => void;
  runScriptForModal: (providedParams: Record<string, unknown>) => Promise<RunModalResult>;
  handleDelete: () => void;
  scriptToDelete: Script | null;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useViewScriptViewModel = (tabKey: string): ViewScriptViewModel => {
  const t = useT('core.automation');
  const label = useLabel();
  const isNew = tabKey === 'new-script';
  const scriptId = isNew ? '' : tabKey.replace('view-script:', '');

  const { scripts, createScript, updateScript, deleteScript } = useScriptStore();
  const takenScriptIds = useMemo(() => new Set(scripts.map((item) => item.id)), [scripts]);
  const { scriptRepository } = useDI();
  const { currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { dynamicScreens } = useScreenDefinitions();
  const { functions: expressionFunctions } = useExpressionFunctions();

  const script = useMemo(
    () => (isNew ? null : (scripts.find((s) => s.id === scriptId) ?? null)),
    [isNew, scripts, scriptId],
  );

  const [formData, setFormDataState] = useState<ScriptFormData>(() => buildForm(null, t));

  const suggestedScriptId = useMemo(
    () => (formData.name.trim() ? deriveArtifactId(formData.name, takenScriptIds) : ''),
    [formData.name, takenScriptIds],
  );

  const scriptIdError = useMemo(
    () => (isNew && formData.scriptId.trim()
      ? artifactIdIssue(t, formData.scriptId, takenScriptIds, 'script')
      : undefined),
    [isNew, formData.scriptId, takenScriptIds, t],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set(['queryDoc']));

  const isSectionCollapsed = useCallback((key: string) => collapsedSections.has(key), [collapsedSections]);

  const openDataFunctionReference = useCallback(() => openTab('data-function-reference'), [openTab]);

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
      setFormDataState(buildForm(script, t));
    }
  }, [script, t]);

  useEffect(() => {
    if (script) setTabTitle(tabKey, script.name || 'Script');
  }, [script, tabKey, setTabTitle]);

  const setFormData = useCallback((data: Partial<ScriptFormData>) => {
    setFormDataState((prev) => ({ ...prev, ...data }));
  }, []);

  const entityOptions = useEntityReferenceOptions();
  const lookupOptions = useLookupCollectionOptions();

  const scriptTypeDefs = useMemo(
    () => buildScriptTypeDefs(formData.inputParams, expressionFunctions, toSchemaScreens(dynamicScreens)),
    [formData.inputParams, expressionFunctions, dynamicScreens],
  );

  const inputParamErrors = useMemo(
    () => siblingParameterErrors(formData.inputParams).map((issue) => (issue ? label(issue.message, issue.messageParams) : undefined)),
    [formData.inputParams, label],
  );
  const outputParamErrors = useMemo(
    () => siblingParameterErrors(formData.outputParams).map((issue) => (issue ? label(issue.message, issue.messageParams) : undefined)),
    [formData.outputParams, label],
  );

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

  const replaceInputParams = useCallback((inputParams: WorkflowParameter[]) => {
    setFormDataState((prev) => ({ ...prev, inputParams }));
  }, []);

  const replaceOutputParams = useCallback((outputParams: ScriptOutputParam[]) => {
    setFormDataState((prev) => ({ ...prev, outputParams }));
  }, []);

  const cloneInputParam = useCallback((index: number) => {
    setFormDataState((prev) => ({ ...prev, inputParams: cloneParameterInList(prev.inputParams, index) }));
  }, []);

  const cloneOutputParam = useCallback((index: number) => {
    setFormDataState((prev) => ({ ...prev, outputParams: cloneParameterInList(prev.outputParams, index) }));
  }, []);

  const hasParamErrors = useMemo(
    () => hasParameterErrorsDeep(formData.inputParams) || hasParameterErrorsDeep(formData.outputParams),
    [formData.inputParams, formData.outputParams],
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

    if (scriptIdError) {
      notify(scriptIdError, 'error');
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
        const chosenId = formData.scriptId.trim() || deriveArtifactId(formData.name, takenScriptIds);
        const created = await createScript(data, chosenId);
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
  }, [currentTenant, formData, isNew, script, scriptIdError, takenScriptIds, createScript, updateScript, notify, closeTab, tabKey, activePanelId, openTab]);

  const openRunModal = useCallback(() => {
    const compiled = transpile(formData.sourceTs);
    if ('error' in compiled) {
      notify(compiled.error, 'error');
      return;
    }
    setRunModalOpen(true);
  }, [formData.sourceTs, notify]);

  const closeRunModal = useCallback(() => setRunModalOpen(false), []);

  const runScriptForModal = useCallback(
    async (providedParams: Record<string, unknown>): Promise<RunModalResult> => {
      if (!currentTenant) {
        return { status: 'FAILED', outputs: null, logs: [], error: t('core.ui/tenant.none-selected') };
      }
      const compiled = transpile(formData.sourceTs);
      if ('error' in compiled) {
        return { status: 'FAILED', outputs: null, logs: [], error: compiled.error };
      }
      try {
        const res = await scriptRepository.runScript({
          tenantId: currentTenant.id,
          compiledJs: compiled.compiledJs,
          inputParams: sanitizeInputParams(formData.inputParams),
          providedParams,
        });
        return {
          status: res.error ? 'FAILED' : 'SUCCESS',
          outputs: res.outputs,
          logs: res.logs,
          error: res.error,
        };
      } catch (error) {
        return {
          status: 'FAILED',
          outputs: null,
          logs: [],
          error: error instanceof Error ? error.message : String(error),
        };
      }
    },
    [currentTenant, formData.sourceTs, formData.inputParams, scriptRepository, t],
  );

  const handleDelete = useCallback(() => {
    if (script) setScriptToDelete(script);
  }, [script]);

  const cancelDelete = useCallback(() => setScriptToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!scriptToDelete) return;
    try {
      await deleteScript(scriptToDelete.id);
      notify(t('script.deleted'), 'success');
      closeTab(tabKey, activePanelId);
    } catch (error) {
      console.error('[ViewScript] confirmDelete:', error);
      notify('Erro ao excluir script.', 'error');
    } finally {
      setScriptToDelete(null);
    }
  }, [scriptToDelete, deleteScript, notify, closeTab, tabKey, activePanelId, t]);

  return {
    isNew,
    suggestedScriptId,
    scriptIdError,
    script,
    formData,
    scriptTypeDefs,
    setFormData,
    typeOptions: scriptParameterTypeOptions(t),
    entityOptions,
    lookupOptions,
    inputParamErrors,
    outputParamErrors,
    addInputParam,
    updateInputParam,
    removeInputParam,
    addOutputParam,
    updateOutputParam,
    removeOutputParam,
    replaceInputParams,
    replaceOutputParams,
    cloneInputParam,
    cloneOutputParam,
    isSectionCollapsed,
    toggleSection,
    openDataFunctionReference,
    isSaving,
    canSave,
    handleSave,
    runModalOpen,
    openRunModal,
    closeRunModal,
    runScriptForModal,
    handleDelete,
    scriptToDelete,
    confirmDelete,
    cancelDelete,
  };
};
