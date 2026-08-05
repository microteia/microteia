import { useCallback, useEffect, useMemo, useState } from 'react';
import { useActions } from '../../../stores/useActions';
import { artifactIdIssue, deriveArtifactId } from '../../../domain/services/artifactIdentity';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import { getScreenIconOptions } from '../../shared/screenIcons';
import { useRecordActions } from '../../shared/recordActions/useRecordActions';
import { ACTION_SYSTEM_PARAMETERS } from '../../shared/entityScreen/useActionParameterPrompt';
import type { ActionDefinition } from '../../../domain/entities';
import type { WorkflowVariable } from '../../components/ui/ExpressionEditor/autocompleteHelpers';
import type { SearchSelectOption } from '../../components/ui/SearchSelect';

export interface ActionFormState {
  /** Id do documento — o que uma tela e um pacote guardam para apontar para esta ação. */
  actionId: string;
  key: string;
  title: string;
  icon: string;
  workflowId: string;
  command: string;
  hiddenWhen: string;
  disabledWhen: string;
  activeWhen: string;
  confirmMessage: string;
  /** A ação abre o formulário dos parâmetros do fluxo antes de executar. */
  promptParameters: boolean;
  /** Parâmetro do fluxo → expressão com que o campo abre preenchido. */
  parameterDefaults: Record<string, string>;
  danger: boolean;
  enabled: boolean;
  order: number;
}

const EMPTY_FORM: ActionFormState = {
  actionId: '',
  key: '',
  title: '',
  icon: 'apps',
  workflowId: '',
  command: '',
  hiddenWhen: '',
  disabledWhen: '',
  activeWhen: '',
  confirmMessage: '',
  promptParameters: false,
  parameterDefaults: {},
  danger: false,
  enabled: true,
  order: 0,
};

const toForm = (action: ActionDefinition): ActionFormState => ({
  actionId: action.id,
  key: action.key,
  title: action.title,
  icon: action.icon,
  workflowId: action.workflowId,
  command: action.command ?? '',
  hiddenWhen: action.hiddenWhen ?? '',
  disabledWhen: action.disabledWhen ?? '',
  activeWhen: action.activeWhen ?? '',
  confirmMessage: action.confirmMessage ?? '',
  promptParameters: action.promptParameters === true,
  parameterDefaults: action.parameterDefaults ?? {},
  danger: action.danger,
  enabled: action.enabled,
  order: action.order,
});

/** Expressão em branco não vira registro no banco: ausente e vazia dizem a mesma coisa. */
const cleanParameterDefaults = (defaults: Record<string, string>): Record<string, string> =>
  Object.fromEntries(
    Object.entries(defaults).filter(([, expression]) => expression.trim() !== ''),
  );

/** Um parâmetro do fluxo-alvo que a ação pode perguntar — e pré-preencher. */
export interface PromptableParameter {
  key: string;
  label: string;
  required: boolean;
}

export interface ViewActionViewModel {
  isAdmin: boolean;
  isNew: boolean;
  /** O identificador do documento: editável só na inclusão, sugerido a partir do título. */
  suggestedActionId: string;
  actionIdError: string | undefined;
  /** O identificador já gravado — a tela o mostra em modo leitura depois da criação. */
  actionId: string;
  notFound: boolean;
  formData: ActionFormState;
  setFormData: (patch: Partial<ActionFormState>) => void;
  iconOptions: SearchSelectOption[];
  workflowOptions: { value: string; label: string }[];
  expressionVariables: WorkflowVariable[];
  commandOptions: SearchSelectOption[];
  /** Os parâmetros do fluxo escolhido, fora os cinco que o sistema sempre entrega. */
  promptableParameters: PromptableParameter[];
  setParameterDefault: (key: string, expression: string) => void;
  canSave: boolean;
  isSaving: boolean;
  handleSave: () => Promise<void>;
  actionToDelete: ActionDefinition | null;
  handleDelete: () => void;
  confirmDelete: () => Promise<void>;
  cancelDelete: () => void;
}

export const useViewActionViewModel = (tabKey: string): ViewActionViewModel => {
  const { actions, createAction, updateAction, deleteAction } = useActions();
  const { workflows } = useWorkflowStore();
  const { tenantRole } = useTenant();
  const { closeTab, openTab, setTabTitle, activePanelId } = useWorkspace();
  const { notify } = useNotification();
  const recordActions = useRecordActions();

  const isNew = tabKey === 'new-action';
  const actionId = isNew ? null : tabKey.replace('view-action:', '');

  const action = useMemo(
    () => (actionId ? actions.find((item) => item.id === actionId) ?? null : null),
    [actions, actionId],
  );

  const [formData, setForm] = useState<ActionFormState>(EMPTY_FORM);
  const [isSaving, setIsSaving] = useState(false);
  const [actionToDelete, setActionToDelete] = useState<ActionDefinition | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza o formulário ao carregar a ação
    setForm(action ? toForm(action) : EMPTY_FORM);
  }, [action]);

  useEffect(() => {
    if (action) setTabTitle(tabKey, action.title);
  }, [action, tabKey, setTabTitle]);

  const setFormData = useCallback(
    (patch: Partial<ActionFormState>) => setForm((prev) => ({ ...prev, ...patch })),
    [],
  );

  const iconOptions = useMemo<SearchSelectOption[]>(
    () => getScreenIconOptions().map((option) => ({
      value: option.key,
      label: option.label,
      icon: option.Icon,
    })),
    [],
  );

  // Só workflows do tipo "chamado" podem ser alvo: são os únicos que declaram parâmetros de entrada.
  const workflowOptions = useMemo(
    () => workflows
      .filter((workflow) => workflow.eventName === WORKFLOW_CALLED_EVENT)
      .map((workflow) => ({ value: workflow.id, label: workflow.name }))
      .sort((a, b) => a.label.localeCompare(b.label)),
    [workflows],
  );

  const expressionVariables = useMemo<WorkflowVariable[]>(() => [
    { name: 'record', definedBy: 'Registro como está gravado' },
    { name: 'isNew', definedBy: 'Registro ainda não gravado' },
    { name: 'isDirty', definedBy: 'Há alterações não gravadas' },
    { name: 'role', definedBy: 'Papel do usuário no escritório' },
    { name: 'surface', definedBy: 'Onde a ação aparece: detail, list ou parentTab' },
    { name: 'relation', definedBy: 'O registro dentro da aba do pai: none, owned ou related' },
  ], []);

  /**
   * Os comandos do sistema que uma ação pode executar em vez de um fluxo. Vêm do ponto de extensão,
   * não de uma lista escrita aqui: uma extensão que registre o seu aparece nesta lista sozinha.
   */
  const commandOptions = useMemo<SearchSelectOption[]>(
    () => [
      { value: '', label: 'Executar um fluxo de trabalho' },
      ...recordActions.map((action) => ({
        value: action.metadata.key,
        label: action.metadata.title,
        meta: action.metadata.key,
      })),
    ],
    [recordActions],
  );

  const promptableParameters = useMemo<PromptableParameter[]>(() => {
    const workflow = workflows.find((candidate) => candidate.id === formData.workflowId);
    return (workflow?.parameters ?? [])
      .filter((param) => !ACTION_SYSTEM_PARAMETERS.has(param.key))
      .map((param) => ({ key: param.key, label: param.label || param.key, required: !!param.required }));
  }, [workflows, formData.workflowId]);

  const setParameterDefault = useCallback((key: string, expression: string) => {
    setForm((prev) => ({
      ...prev,
      parameterDefaults: { ...prev.parameterDefaults, [key]: expression },
    }));
  }, []);

  // Uma ação executa UMA coisa: um comando do sistema ou um fluxo de trabalho. O comando dispensa
  // o fluxo — não há o que rodar no servidor.
  const takenActionIds = useMemo(() => new Set(actions.map((item) => item.id)), [actions]);

  const suggestedActionId = useMemo(
    () => (formData.title.trim() ? deriveArtifactId(formData.title, takenActionIds) : ''),
    [formData.title, takenActionIds],
  );

  const actionIdError = useMemo(
    () => (isNew && formData.actionId.trim()
      ? artifactIdIssue(formData.actionId, takenActionIds, 'ação')
      : undefined),
    [isNew, formData.actionId, takenActionIds],
  );

  const canSave = !actionIdError
    && formData.key.trim() !== ''
    && formData.title.trim() !== ''
    && (formData.command !== '' || formData.workflowId !== '')
    && !isSaving;

  const handleSave = useCallback(async () => {
    if (!canSave) return;
    setIsSaving(true);
    try {
      const payload = {
        key: formData.key.trim(),
        title: formData.title.trim(),
        icon: formData.icon,
        workflowId: formData.command ? '' : formData.workflowId,
        command: formData.command || null,
        hiddenWhen: formData.hiddenWhen.trim() || null,
        activeWhen: formData.activeWhen.trim() || null,
        disabledWhen: formData.disabledWhen.trim() || null,
        confirmMessage: formData.confirmMessage.trim() || null,
        promptParameters: formData.command ? null : formData.promptParameters,
        parameterDefaults: cleanParameterDefaults(formData.parameterDefaults),
        danger: formData.danger,
        enabled: formData.enabled,
        order: formData.order,
      };
      if (isNew) {
        const chosenId = formData.actionId.trim() || deriveArtifactId(formData.title, takenActionIds);
        const created = await createAction(payload, chosenId);
        notify('Ação criada com sucesso.', 'success');
        closeTab(tabKey, activePanelId);
        openTab(`view-action:${created.id}`);
      } else if (action) {
        await updateAction(action.id, payload);
        notify('Ação atualizada com sucesso.', 'success');
      }
    } catch (error) {
      console.error('[ViewAction save]', error);
      notify('Erro ao salvar a ação.', 'error');
    } finally {
      setIsSaving(false);
    }
  }, [canSave, formData, isNew, action, takenActionIds, createAction, updateAction, notify, closeTab, openTab, tabKey, activePanelId]);

  const handleDelete = useCallback(() => setActionToDelete(action), [action]);
  const cancelDelete = useCallback(() => setActionToDelete(null), []);

  const confirmDelete = useCallback(async () => {
    if (!actionToDelete) return;
    try {
      await deleteAction(actionToDelete.id);
      notify('Ação excluída.', 'success');
      closeTab(tabKey, activePanelId);
    } catch {
      notify('Erro ao excluir a ação.', 'error');
    } finally {
      setActionToDelete(null);
    }
  }, [actionToDelete, deleteAction, notify, closeTab, tabKey, activePanelId]);

  return {
    isAdmin: tenantRole === 'admin',
    isNew,
    suggestedActionId,
    actionIdError,
    actionId: action?.id ?? '',
    notFound: !isNew && !action,
    formData,
    setFormData,
    iconOptions,
    workflowOptions,
    expressionVariables,
    commandOptions,
    promptableParameters,
    setParameterDefault,
    canSave,
    isSaving,
    handleSave,
    actionToDelete,
    handleDelete,
    confirmDelete,
    cancelDelete,
  };
};
