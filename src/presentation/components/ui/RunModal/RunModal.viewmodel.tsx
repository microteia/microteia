import { useCallback, useState } from 'react';
import type { WorkflowParameter } from '../../../../domain/entities/Workflow';

import { useT, type TranslateFn } from '../../../shared/i18n/useT';
export type RunModalLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SUCCESS';

export interface RunModalLog {
  level: RunModalLogLevel;
  message: string;
}

export interface RunModalResult {
  status: 'SUCCESS' | 'FAILED' | 'PARTIAL' | null;
  outputs: Record<string, unknown> | null;
  logs: RunModalLog[];
  error: string | null;
}

export interface RunModalProps {
  title: string;
  parameters: WorkflowParameter[];
  runLabel?: string;
  /**
   * Com o que o formulário ABRE. Serve à ação que pergunta antes de executar: o registro da tela já
   * responde parte do que o fluxo pede, e reescrever à mão o que está na tela é trabalho inútil.
   */
  initialValues?: Record<string, unknown>;
  /**
   * O modal só COLETA: confirma, fecha, e quem chamou cuida do resto. É o modo da Action, cujo
   * resultado já é tratado pelo caminho de sempre (mensagem, recarregar a lista) — mostrar aqui o
   * JSON de saída seria a tela de depuração de um fluxo aparecendo para quem só clicou num botão.
   */
  collectOnly?: boolean;
  onClose: () => void;
  onRun: (providedParams: Record<string, unknown>) => Promise<RunModalResult | void>;
}

type BuildOutcome =
  | { ok: true; params: Record<string, unknown> }
  | { ok: false; error: string };

const skeletonValue = (param: WorkflowParameter): unknown => {
  if (param.list) return [];
  if (param.type === 'Object') {
    const obj: Record<string, unknown> = {};
    for (const field of param.fields ?? []) obj[field.key] = skeletonValue(field);
    return obj;
  }
  if (param.type === 'Number') return 0;
  if (param.type === 'Boolean') return false;
  return '';
};

/**
 * O registro que a tela já respondeu pode chegar como o vínculo inteiro (`{ id, nome }`) ou só como
 * o id. O seletor escolhe pelo id, e é ele que o fluxo recebe.
 */
const referenceId = (value: unknown): string =>
  typeof value === 'object' && value !== null && 'id' in value
    ? String((value as { id: unknown }).id)
    : String(value);

/**
 * O valor de partida vira TEXTO, que é como o formulário guarda tudo: o campo de data espera
 * `aaaa-mm-dd`, o de sim/não espera `"true"`, e lista e objeto voltam a ser JSON — a mesma forma que
 * `buildProvidedParams` lê de volta na hora de montar os parâmetros.
 */
const toFormText = (value: unknown, param: WorkflowParameter): string => {
  if (value === null || value === undefined) return '';
  if (param.type === 'EntityReference') {
    const ids = Array.isArray(value) ? value.map(referenceId) : referenceId(value);
    return param.list ? JSON.stringify(ids) : String(ids);
  }
  if (param.list || param.type === 'Object') return JSON.stringify(value, null, 2);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (param.type === 'Date' && typeof value === 'string') return value.slice(0, 10);
  return String(value);
};

const buildInitialValues = (
  parameters: WorkflowParameter[],
  initialValues: Record<string, unknown> | undefined,
): Record<string, string> => {
  if (!initialValues) return {};
  const out: Record<string, string> = {};
  for (const param of parameters) {
    if (!(param.key in initialValues)) continue;
    const text = toFormText(initialValues[param.key], param);
    if (text !== '') out[param.key] = text;
  }
  return out;
};

const buildDefaultJson = (
  parameters: WorkflowParameter[],
  initialValues?: Record<string, unknown>,
): string => {
  if (parameters.length === 0) return '{}';
  const skeleton: Record<string, unknown> = {};
  for (const param of parameters) {
    const provided = initialValues?.[param.key];
    skeleton[param.key] = provided === undefined || provided === null
      ? skeletonValue(param)
      : provided;
  }
  return JSON.stringify(skeleton, null, 2);
};

const buildProvidedParams = (
  t: TranslateFn,
  mode: 'form' | 'json',
  jsonText: string,
  values: Record<string, string>,
  parameters: WorkflowParameter[],
): BuildOutcome => {
  if (mode === 'json') {
    const text = jsonText.trim();
    if (!text) return { ok: true, params: {} };
    try {
      const parsed: unknown = JSON.parse(text);
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        return { ok: false, error: t('run.error.json-not-object') };
      }
      return { ok: true, params: parsed as Record<string, unknown> };
    } catch (error) {
      return { ok: false, error: t('run.error.json-invalid', { detail: error instanceof Error ? error.message : '' }) };
    }
  }

  const params: Record<string, unknown> = {};
  for (const param of parameters) {
    const raw = values[param.key] ?? '';
    if (param.list || param.type === 'Object') {
      const trimmed = raw.trim();
      if (!trimmed) continue;
      try {
        params[param.key] = JSON.parse(trimmed);
      } catch {
        return { ok: false, error: t('run.error.json-invalid-field', { field: param.label || param.key }) };
      }
    } else {
      if (raw === '') continue;
      params[param.key] = param.type === 'Boolean' ? raw === 'true' : raw;
    }
  }
  return { ok: true, params };
};

export interface RunModalViewModel {
  parameters: WorkflowParameter[];
  hasParameters: boolean;
  mode: 'form' | 'json';
  setMode: (mode: 'form' | 'json') => void;
  getValue: (key: string) => string;
  setValue: (key: string, value: string) => void;
  jsonText: string;
  setJsonText: (value: string) => void;
  formError: string | null;
  phase: 'input' | 'result';
  running: boolean;
  result: RunModalResult | null;
  outputsJson: string;
  canRun: boolean;
  runLabel: string;
  handleRun: () => Promise<void>;
  handleReset: () => void;
  handleClose: () => void;
}

export const useRunModalViewModel = (props: RunModalProps): RunModalViewModel => {
  const t = useT('core.ui');
  const { parameters, runLabel = t('run.execute'), initialValues, collectOnly = false, onClose, onRun } = props;

  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [values, setValues] = useState<Record<string, string>>(
    () => buildInitialValues(parameters, initialValues),
  );
  const [jsonText, setJsonText] = useState(() => buildDefaultJson(parameters, initialValues));
  const [phase, setPhase] = useState<'input' | 'result'>('input');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunModalResult | null>(null);

  const outcome = buildProvidedParams(t, mode, jsonText, values, parameters);

  const getValue = useCallback((key: string) => values[key] ?? '', [values]);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleRun = useCallback(async () => {
    if (running) return;
    const built = buildProvidedParams(t, mode, jsonText, values, parameters);
    if (!built.ok) return;
    // Só coleta: dispara e sai de cena. Esperar aqui deixaria o modal travado durante a execução,
    // sem nada a mostrar no fim — o retorno já é tratado por quem chamou.
    if (collectOnly) {
      void onRun(built.params);
      onClose();
      return;
    }
    setRunning(true);
    try {
      const outcomeResult = await onRun(built.params);
      setResult(outcomeResult ?? null);
    } catch (error) {
      setResult({
        status: 'FAILED',
        outputs: null,
        logs: [],
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      setRunning(false);
      setPhase('result');
    }
  }, [running, mode, jsonText, values, parameters, collectOnly, onRun, onClose, t]);

  const handleReset = useCallback(() => {
    setPhase('input');
    setResult(null);
  }, []);

  const handleClose = useCallback(() => {
    onClose();
  }, [onClose]);

  const outputsJson = result?.outputs != null ? JSON.stringify(result.outputs, null, 2) : '';
  const formError = phase === 'input' && !outcome.ok ? outcome.error : null;

  return {
    parameters,
    hasParameters: parameters.length > 0,
    mode,
    setMode,
    getValue,
    setValue,
    jsonText,
    setJsonText,
    formError,
    phase,
    running,
    result,
    outputsJson,
    canRun: !running && outcome.ok,
    runLabel,
    handleRun,
    handleReset,
    handleClose,
  };
};
