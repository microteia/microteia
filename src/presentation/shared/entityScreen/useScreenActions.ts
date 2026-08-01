import { useCallback, useMemo, useState } from 'react';
import { useActions } from '../../../stores/useActions';
import { useNotification } from '../../../stores/useNotification';
import { useTenant } from '../../../stores/useTenant';
import { setValueByPath } from '../../../domain/services/customFieldValues';
import { actionActiveState, isActionDisabled, isActionHidden } from '../../../domain/schema/actionExpression';
import type { ActionDefinition, ActionOutcome, ActionStatusCode, CustomFieldValue } from '../../../domain/entities';

type Values = Record<string, CustomFieldValue>;

/**
 * Capacidades da tela que chamou. Um comando devolvido pelo workflow cujo callback esteja ausente é
 * simplesmente ignorado — a listagem, por exemplo, não tem formulário para `merge`.
 */
export interface ActionCommandTarget {
  applyValues?: (values: Values) => void;
  setFieldErrors?: (errors: Record<string, string>) => void;
  save?: (override?: Values) => Promise<void>;
  clone?: () => void;
  remove?: () => void;
  refresh?: () => void | Promise<void>;
  close?: () => void;
}

export interface ScreenActionTarget extends ActionCommandTarget {
  screenKey: string;
  actionIds: string[];
  values: Record<string, unknown>;
  record: Record<string, unknown> | null;
  recordId: string | null;
  isNew: boolean;
  isDirty: boolean;
}

export interface ScreenActionButton {
  key: string;
  iconKey: string;
  title: string;
  danger: boolean;
  disabled: boolean;
  /**
   * Estado do interruptor, quando a ação declara `activeWhen`: `true` ligado, `false` desligado.
   * `undefined` = ação comum, que só dispara — e o botão é o de sempre.
   */
  active?: boolean;
  onClick: () => void;
}

export interface ScreenActions {
  buttons: ScreenActionButton[];
  runningActionId: string | null;
  /** Action aguardando confirmação — a tela renderiza o `ConfirmModal` a partir daqui. */
  pendingAction: ActionDefinition | null;
  confirmPendingAction: () => void;
  cancelPendingAction: () => void;
}

const STATUS_TONE: Record<ActionStatusCode, 'success' | 'warning' | 'error'> = {
  SUCCESS: 'success',
  WARNING: 'warning',
  ERROR: 'error',
};

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date);

const toFieldValue = (value: unknown): CustomFieldValue => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => (typeof item === 'string' ? item : String(item)));
  return String(value);
};

/**
 * Achata o `result` do workflow em caminhos pontilhados, para que objetos aninhados cheguem aos campos
 * correspondentes via `setValueByPath`. Arrays são folhas (campos de múltipla escolha).
 */
const flattenResult = (source: Record<string, unknown>, prefix = ''): Values => {
  const out: Values = {};
  for (const [key, value] of Object.entries(source)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (isPlainObject(value)) Object.assign(out, flattenResult(value, path));
    else out[path] = toFieldValue(value);
  }
  return out;
};

export const applyResult = (base: Values, result: Record<string, unknown> | null): Values =>
  Object.entries(flattenResult(result ?? {})).reduce<Values>(
    (acc, [path, value]) => setValueByPath(acc, path, value),
    base,
  );

/**
 * Aplica os comandos devolvidos pelo workflow na ordem canônica. Comandos sem callback correspondente
 * são ignorados: a listagem, por exemplo, não tem formulário para `merge` nem aba para `close`.
 */
export const dispatchActionOutcome = async (
  outcome: ActionOutcome,
  baseValues: Values,
  target: ActionCommandTarget,
): Promise<void> => {
  const { status, result, commands } = outcome;
  if (status.fieldErrors && target.setFieldErrors) target.setFieldErrors(status.fieldErrors);
  // Um status de erro reporta e para: nada de gravar ou excluir em cima de uma falha declarada.
  if (status.code === 'ERROR') return;

  let next = baseValues;
  for (const command of commands) {
    switch (command) {
      case 'replace':
        next = applyResult({}, result);
        target.applyValues?.(next);
        break;
      case 'merge':
        next = applyResult(next, result);
        target.applyValues?.(next);
        break;
      case 'save':
        await target.save?.(next);
        break;
      case 'refresh':
        await target.refresh?.();
        break;
      case 'clone':
        target.clone?.();
        break;
      case 'delete':
        target.remove?.();
        break;
      case 'close':
        target.close?.();
        break;
    }
  }
};

export const useScreenActions = (target: ScreenActionTarget): ScreenActions => {
  const {
    screenKey, actionIds, values, record, recordId, isNew, isDirty,
    applyValues, setFieldErrors, save, clone, remove, refresh, close,
  } = target;

  const { getActionsByIds, runAction } = useActions();
  const { notify } = useNotification();
  const { tenantRole } = useTenant();

  const [runningActionId, setRunningActionId] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<ActionDefinition | null>(null);

  const available = useMemo(() => getActionsByIds(actionIds), [getActionsByIds, actionIds]);

  const exprContext = useMemo(() => ({
    values,
    record,
    isNew,
    isDirty,
    role: tenantRole ?? '',
  }), [values, record, isNew, isDirty, tenantRole]);

  const execute = useCallback(async (action: ActionDefinition) => {
    setRunningActionId(action.id);
    try {
      const response = await runAction({
        actionId: action.id,
        source: screenKey,
        context: values,
        recordId,
        isNew,
      });

      if (response.error || !response.outcome) {
        notify(response.error ?? 'Não foi possível executar a ação.', 'error');
        return;
      }

      const { status } = response.outcome;
      if (status.message) notify(status.message, STATUS_TONE[status.code]);

      await dispatchActionOutcome(response.outcome, values as Values, {
        applyValues, setFieldErrors, save, clone, remove, refresh, close,
      });
    } catch (error) {
      console.error('[useScreenActions]', error);
      notify('Não foi possível executar a ação.', 'error');
    } finally {
      setRunningActionId(null);
    }
  }, [runAction, screenKey, values, recordId, isNew, notify, setFieldErrors, applyValues, save, refresh, clone, remove, close]);

  const requestRun = useCallback((action: ActionDefinition) => {
    if (action.confirmMessage && action.confirmMessage.trim() !== '') {
      setPendingAction(action);
      return;
    }
    void execute(action);
  }, [execute]);

  const confirmPendingAction = useCallback(() => {
    if (!pendingAction) return;
    const action = pendingAction;
    setPendingAction(null);
    void execute(action);
  }, [pendingAction, execute]);

  const cancelPendingAction = useCallback(() => setPendingAction(null), []);

  const buttons = useMemo<ScreenActionButton[]>(
    () => available
      .filter((action) => !isActionHidden(action.hiddenWhen, exprContext))
      .map((action) => ({
        key: action.id,
        iconKey: action.icon,
        title: action.title,
        danger: action.danger,
        disabled: runningActionId !== null || isActionDisabled(action.disabledWhen, exprContext),
        active: actionActiveState(action.activeWhen, exprContext),
        onClick: () => requestRun(action),
      })),
    [available, exprContext, runningActionId, requestRun],
  );

  return { buttons, runningActionId, pendingAction, confirmPendingAction, cancelPendingAction };
};
