import { useState, useMemo, useCallback, useEffect } from 'react';
import { transpileScriptSource as transpile } from '../../../domain/services/scriptSource';
import { useScriptStore } from '../../../stores/useScriptStore';
import { artifactIdIssue, deriveArtifactIdUnderPrefix } from '../../../domain/services/artifactIdentity';
import { withArtifactPrefix } from '../../../domain/schema/plugin/artifactPrefix';
import { useArtifactPrefix } from '../../shared/settings/useArtifactPrefix';
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

import { useT, useLabel, useLocaleFormat, type TranslateFn } from '../../shared/i18n/useT';
import { useInstalledExtensions } from '../../../stores/useInstalledExtensions';
import type { ArtifactVersion } from '../../../domain/schema/workflowVersion';
import { PARAMETER_TYPE_KEYS } from '../../shared/parameterTypeKeys';

/** Quantas versões a seção mostra — as mais recentes; as anteriores continuam guardadas. */
const SCRIPT_VERSIONS_SHOWN = 50;

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
  /** O prefixo do escritório, fixo à frente do id na criação; `null` sem prefixo. */
  artifactPrefix: string | null;
  suggestedScriptId: string;
  scriptIdError: string | undefined;
  script: Script | null;
  formData: ScriptFormData;
  /** O nome como quem usa o sistema o lê: o campo guarda a referência, o cabeçalho mostra o texto. */
  displayName: string;
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
  /** As versões guardadas do script — a seção só existe para um script salvo. */
  versions: { version: number; title: string; origin: string; isCurrent: boolean }[];
  versionsError: string | null;
  restoringVersion: number | null;
  restoreVersion: (version: number) => void;
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
  const { scriptRepository, workflowVersionRepository } = useDI();
  const { currentTenant } = useTenant();
  const { setTabTitle, closeTab, openTab, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const { formatDateTime } = useLocaleFormat();
  const { installed } = useInstalledExtensions();
  const { dynamicScreens } = useScreenDefinitions();
  const { functions: expressionFunctions } = useExpressionFunctions();

  const script = useMemo(
    () => (isNew ? null : (scripts.find((s) => s.id === scriptId) ?? null)),
    [isNew, scripts, scriptId],
  );

  const [formData, setFormDataState] = useState<ScriptFormData>(() => buildForm(null, t));

  const artifactPrefix = useArtifactPrefix();

  const suggestedScriptId = useMemo(
    () => (formData.name.trim() ? deriveArtifactIdUnderPrefix(artifactPrefix, formData.name, takenScriptIds) : ''),
    [formData.name, takenScriptIds, artifactPrefix],
  );

  const scriptIdError = useMemo(
    () => (isNew && formData.scriptId.trim()
      ? artifactIdIssue(t, withArtifactPrefix(artifactPrefix, 'artifact', formData.scriptId), takenScriptIds, 'script')
      : undefined),
    [isNew, formData.scriptId, takenScriptIds, t, artifactPrefix],
  );
  const [isSaving, setIsSaving] = useState(false);
  const [runModalOpen, setRunModalOpen] = useState(false);
  const [scriptToDelete, setScriptToDelete] = useState<Script | null>(null);
  // As versões começam recolhidas: são lidas só quando alguém as abre.
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(() => new Set(['queryDoc', 'versions']));

  const isSectionCollapsed = useCallback((key: string) => collapsedSections.has(key), [collapsedSections]);

  const openDataFunctionReference = useCallback(() => openTab('data-function-reference'), [openTab]);

  const [storedVersions, setStoredVersions] = useState<ArtifactVersion[]>([]);
  const [versionsError, setVersionsError] = useState<string | null>(null);
  const [restoringVersion, setRestoringVersion] = useState<number | null>(null);
  const versionsOpen = !collapsedSections.has('versions');
  const savedScriptId = script?.id ?? null;
  const savedAt = script?.updatedAt?.getTime() ?? 0;

  // Lidas ao abrir a seção — e de novo depois de cada gravação, que é quando o servidor guarda uma nova.
  useEffect(() => {
    if (!versionsOpen || !currentTenant || !savedScriptId) return undefined;
    let active = true;
    workflowVersionRepository.listVersions(currentTenant.id, 'script', savedScriptId, SCRIPT_VERSIONS_SHOWN)
      .then((found) => {
        if (!active) return;
        setStoredVersions(found);
        setVersionsError(null);
      })
      .catch((caught: unknown) => {
        if (active) setVersionsError(caught instanceof Error ? caught.message : String(caught));
      });
    return () => { active = false; };
  }, [versionsOpen, currentTenant, savedScriptId, savedAt, workflowVersionRepository]);

  /** Restaurar grava o código e o contrato daquela versão — o servidor o guarda como uma versão nova. */
  const restoreVersion = useCallback(async (version: number) => {
    const chosen = storedVersions.find((one) => one.version === version);
    if (!script || !chosen) return;
    setRestoringVersion(version);
    try {
      await updateScript(script.id, chosen.content as Partial<Script>);
      notify(t('versions.restored', { version: String(version) }), 'success');
    } catch (caught) {
      notify(label(caught instanceof Error ? caught.message : String(caught)), 'error');
    } finally {
      setRestoringVersion(null);
    }
  }, [storedVersions, script, updateScript, notify, t, label]);

  const latestStored = storedVersions[0]?.version ?? 0;
  const versions = useMemo(
    () => storedVersions.map((one) => {
      const { origin } = one;
      return {
        version: one.version,
        title: t('versions.item', { version: String(one.version), date: formatDateTime(one.savedAt) }),
        origin: origin.kind === 'extension'
          ? t('versions.origin.extension', {
            name: label(installed.find((extension) => extension.id === origin.pluginId)?.package.manifest.name)
              || origin.pluginId,
            rev: origin.sourceRev !== null ? String(origin.sourceRev) : '—',
          })
          : t('versions.origin.edit'),
        // O script não guarda o próprio número: a versão de agora é a mais recente guardada.
        isCurrent: one.version === latestStored,
      };
    }),
    [storedVersions, latestStored, formatDateTime, installed, label, t],
  );

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
    if (script) setTabTitle(tabKey, label(script.name) || t('script.fallback-name'));
  }, [script, tabKey, setTabTitle, label, t]);

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
        const chosenId = withArtifactPrefix(
          artifactPrefix,
          'artifact',
          formData.scriptId.trim() || deriveArtifactIdUnderPrefix(artifactPrefix, formData.name, takenScriptIds),
        );
        const created = await createScript(data, chosenId);
        notify(t('script.created'), 'success');
        closeTab(tabKey, activePanelId ?? 'main');
        openTab(`view-script:${created.id}`);
      } else if (script) {
        await updateScript(script.id, data);
        notify(t('script.saved'), 'success');
      }
    } catch (error) {
      console.error('[ViewScript] handleSave:', error);
      notify(t('script.save-failed'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [currentTenant, formData, isNew, script, scriptIdError, takenScriptIds, artifactPrefix, createScript, updateScript, notify, closeTab, tabKey, activePanelId, openTab, t]);

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
      notify(t('script.delete-failed'), 'error');
    } finally {
      setScriptToDelete(null);
    }
  }, [scriptToDelete, deleteScript, notify, closeTab, tabKey, activePanelId, t]);

  return {
    isNew,
    artifactPrefix,
    suggestedScriptId,
    scriptIdError,
    script,
    formData,
    displayName: label(formData.name),
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
    versions,
    versionsError,
    restoringVersion,
    restoreVersion: (version) => { void restoreVersion(version); },
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
