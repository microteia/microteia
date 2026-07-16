import { useCallback, useState } from 'react';
import type { WorkflowParameter } from '../../../../domain/entities/Workflow';

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
  onClose: () => void;
  onRun: (providedParams: Record<string, unknown>) => Promise<RunModalResult>;
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

const buildDefaultJson = (parameters: WorkflowParameter[]): string => {
  if (parameters.length === 0) return '{}';
  const skeleton: Record<string, unknown> = {};
  for (const param of parameters) skeleton[param.key] = skeletonValue(param);
  return JSON.stringify(skeleton, null, 2);
};

const buildProvidedParams = (
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
        return { ok: false, error: 'O JSON deve ser um objeto com os parâmetros de entrada.' };
      }
      return { ok: true, params: parsed as Record<string, unknown> };
    } catch (error) {
      return { ok: false, error: `JSON inválido: ${error instanceof Error ? error.message : ''}` };
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
        return { ok: false, error: `JSON inválido no campo "${param.label || param.key}".` };
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
  const { parameters, runLabel = 'Executar', onClose, onRun } = props;

  const [mode, setMode] = useState<'form' | 'json'>('form');
  const [values, setValues] = useState<Record<string, string>>({});
  const [jsonText, setJsonText] = useState(() => buildDefaultJson(parameters));
  const [phase, setPhase] = useState<'input' | 'result'>('input');
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RunModalResult | null>(null);

  const outcome = buildProvidedParams(mode, jsonText, values, parameters);

  const getValue = useCallback((key: string) => values[key] ?? '', [values]);

  const setValue = useCallback((key: string, value: string) => {
    setValues((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleRun = useCallback(async () => {
    if (running) return;
    const built = buildProvidedParams(mode, jsonText, values, parameters);
    if (!built.ok) return;
    setRunning(true);
    try {
      const outcomeResult = await onRun(built.params);
      setResult(outcomeResult);
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
  }, [running, mode, jsonText, values, parameters, onRun]);

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
