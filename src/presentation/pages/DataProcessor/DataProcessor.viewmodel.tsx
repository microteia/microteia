import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useTenant } from '../../../stores/useTenant';
import { useAuthorization } from '../../../stores/useAuthorization';
import { PERMISSION_DATA_PROCESSOR_USE } from '../../../domain/schema/access';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { makeGetAIConnectionsUseCase } from '../../../domain/usecases/aiconnections/GetAIConnectionsUseCase';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import type { AIConnection } from '../../../domain/entities';
import type { WorkflowDefinition, WorkflowExecution, WorkflowParameter } from '../../../domain/entities/Workflow';

import { useT } from '../../shared/i18n/useT';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const EXECUTION_TIMEOUT_MS = 60000;

export type StageStatus = 'idle' | 'running' | 'success' | 'error';

export interface RunStage {
  key: string;
  label: string;
  status: StageStatus;
  detail?: string;
}

export type ProcessorLogLevel = 'info' | 'warn' | 'success' | 'error';

export interface ProcessorLogEntry {
  id: string;
  level: ProcessorLogLevel;
  message: string;
  workflowId?: string;
}

export interface WorkflowChoice {
  id: string;
  name: string;
  description: string;
  eligible: boolean;
  reason?: string;
  ranked: boolean;
}

export type StepKey = 'source' | 'ai' | 'workflow' | 'run';
export type StepStatus = 'done' | 'current' | 'upcoming' | 'locked';

export interface WizardStep {
  key: StepKey;
  title: string;
  hint: string;
  status: StepStatus;
  reachable: boolean;
}

export interface DataProcessorViewModel {
  hasAccess: boolean;

  steps: WizardStep[];
  currentStep: StepKey;
  currentStepTitle: string;
  currentStepHint: string;
  onGoToStep: (key: StepKey) => void;
  onBack: () => void;
  onNext: () => void;
  canGoBack: boolean;
  canGoNext: boolean;
  isLastStep: boolean;

  freeText: string;
  onFreeTextChange: (value: string) => void;
  textCharCount: number;

  pdfFileName: string | null;
  pdfExtracting: boolean;
  pdfPreviewUrl: string | null;
  pdfPageCount: number;
  pdfPage: number;
  pdfPageOptions: { value: string; label: string }[];
  onSelectPdfPage: (page: string) => void;
  onPdfSelected: (file: File) => void;
  onClearPdf: () => void;

  connectionsLoading: boolean;
  hasNoConnections: boolean;
  connectionOptions: { value: string; label: string }[];
  selectedConnectionId: string;
  selectedConnectionLabel: string;
  onSelectConnection: (id: string) => void;
  openAISettings: () => void;

  workflowChoices: WorkflowChoice[];
  selectedWorkflowId: string;
  selectedWorkflowName: string;
  onSelectWorkflow: (id: string) => void;

  canDetect: boolean;
  detecting: boolean;
  onDetect: () => void;

  logs: ProcessorLogEntry[];

  canRun: boolean;
  running: boolean;
  onRun: () => void;
  runStages: RunStage[];
  resultExecution: WorkflowExecution | null;
  runSucceeded: boolean;
  onRestart: () => void;

  openWorkflow: (id: string) => void;
  openResultExecutions: () => void;
}

const STEP_ORDER: StepKey[] = ['source', 'ai', 'workflow', 'run'];

const STEP_META: Record<StepKey, { titleKey: string; hintKey: string }> = {
  source: {
    titleKey: 'processor.step.source',
    hintKey: 'processor.step.source.hint',
  },
  ai: {
    titleKey: 'processor.step.ai',
    hintKey: 'processor.step.ai.hint',
  },
  workflow: {
    titleKey: 'processor.step.workflow',
    hintKey: 'processor.step.workflow.hint',
  },
  run: {
    titleKey: 'processor.step.run',
    hintKey: 'processor.step.run.hint',
  },
};

const isParamProcessable = (p: WorkflowParameter): boolean =>
  p.type === 'Object' ? (p.fields ?? []).every(isParamProcessable) : p.type !== 'EntityReference';

const isEligible = (w: WorkflowDefinition): boolean =>
  (w.parameters ?? []).every(isParamProcessable);

let logSeq = 0;
const makeLog = (level: ProcessorLogLevel, message: string, workflowId?: string): ProcessorLogEntry => {
  logSeq += 1;
  return { id: `log-${logSeq}`, level, message, workflowId };
};

export const useDataProcessorViewModel = (): DataProcessorViewModel => {
  const t = useT('core.admin');
  const { currentTenant } = useTenant();
  const { can } = useAuthorization();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const { aiConnectionRepository, dataProcessorRepository, workflowExecutionRepository } = useDI();
  const { workflows } = useWorkflowStore();

  const hasAccess = can(PERMISSION_DATA_PROCESSOR_USE);

  const getConnectionsUC = useMemo(
    () => makeGetAIConnectionsUseCase(aiConnectionRepository),
    [aiConnectionRepository],
  );

  const [currentStep, setCurrentStep] = useState<StepKey>('source');

  const [freeText, setFreeText] = useState('');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);
  const [pdfPageCount, setPdfPageCount] = useState(0);
  const [pdfPage, setPdfPage] = useState(1);

  const [connections, setConnections] = useState<AIConnection[]>([]);
  const [connectionsLoading, setConnectionsLoading] = useState(false);
  const [selectedConnectionId, setSelectedConnectionId] = useState('');

  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [detectedOrder, setDetectedOrder] = useState<string[]>([]);
  const [detecting, setDetecting] = useState(false);

  const [logs, setLogs] = useState<ProcessorLogEntry[]>([]);

  const [running, setRunning] = useState(false);
  const [runStages, setRunStages] = useState<RunStage[]>([]);
  const [resultExecution, setResultExecution] = useState<WorkflowExecution | null>(null);
  const [runWorkflowId, setRunWorkflowId] = useState('');

  const unsubRef = useRef<(() => void) | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearObservation = useCallback(() => {
    if (unsubRef.current) {
      unsubRef.current();
      unsubRef.current = null;
    }
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
      timeoutRef.current = null;
    }
  }, []);

  useEffect(() => clearObservation, [clearObservation]);

  useEffect(() => {
    if (!currentTenant || !hasAccess) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa o estado de carregamento antes da operação assíncrona
    setConnectionsLoading(true);
    getConnectionsUC
      .execute(currentTenant.id)
      .then((result) => {
        if (cancelled) return;
        setConnections(result);
        if (result.length > 0) {
          setSelectedConnectionId((prev) => prev || (result.find((c) => c.isDefault)?.id ?? result[0].id));
        }
      })
      .catch(() => {
        if (!cancelled) setConnections([]);
      })
      .finally(() => {
        if (!cancelled) setConnectionsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [currentTenant, hasAccess, getConnectionsUC]);

  useEffect(() => {
    if (!pdfFile) return;
    let cancelled = false;
    let destroyTask: (() => Promise<void>) | null = null;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa o estado de carregamento antes da operação assíncrona
    setPdfExtracting(true);

    const extract = async () => {
      const buffer = await pdfFile.arrayBuffer();
      const task = pdfjsLib.getDocument({ data: new Uint8Array(buffer) });
      destroyTask = () => task.destroy();
      const pdf = await task.promise;
      if (!cancelled) setPdfPageCount(pdf.numPages);

      const pageNumber = Math.min(Math.max(pdfPage, 1), pdf.numPages);
      const page = await pdf.getPage(pageNumber);
      const content = await page.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      if (!cancelled) setFreeText(text);

      const canvas = document.createElement('canvas');
      const viewport = page.getViewport({ scale: 1.1 });
      const ctx = canvas.getContext('2d');
      if (ctx) {
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvas, canvasContext: ctx, viewport }).promise;
        if (!cancelled) setPdfPreviewUrl(canvas.toDataURL('image/png'));
      }
    };

    extract()
      .catch(() => {
        if (!cancelled) notify(t('processor.pdf.read-failed'), 'error');
      })
      .finally(() => {
        void destroyTask?.();
        if (!cancelled) setPdfExtracting(false);
      });

    return () => {
      cancelled = true;
    };
  }, [pdfFile, pdfPage, notify, t]);

  const onFreeTextChange = useCallback((value: string) => setFreeText(value), []);

  const onPdfSelected = useCallback((file: File) => {
    setPdfFileName(file.name);
    setPdfPreviewUrl(null);
    setPdfPageCount(0);
    setPdfPage(1);
    setPdfFile(file);
  }, []);

  const onClearPdf = useCallback(() => {
    setPdfFileName(null);
    setPdfFile(null);
    setPdfPreviewUrl(null);
    setPdfPageCount(0);
    setPdfPage(1);
  }, []);

  const onSelectPdfPage = useCallback((page: string) => {
    const parsed = Number(page);
    if (Number.isFinite(parsed) && parsed > 0) setPdfPage(parsed);
  }, []);

  const pdfPageOptions = useMemo(
    () =>
      Array.from({ length: pdfPageCount }, (_, index) => ({
        value: String(index + 1),
        label: t('processor.page.option', { page: index + 1, total: pdfPageCount }),
      })),
    [pdfPageCount, t],
  );

  const onSelectConnection = useCallback((id: string) => setSelectedConnectionId(id), []);
  const onSelectWorkflow = useCallback((id: string) => setSelectedWorkflowId(id), []);
  const openAISettings = useCallback(() => openTab('tenant-settings:ai'), [openTab]);
  const openWorkflow = useCallback((id: string) => openTab(`view-workflow:${id}`), [openTab]);
  const openResultExecutions = useCallback(() => {
    if (runWorkflowId) openTab(`view-workflow:${runWorkflowId}::executions`);
  }, [openTab, runWorkflowId]);

  const callableWorkflows = useMemo(
    () => workflows.filter((w) => w.eventName === WORKFLOW_CALLED_EVENT && w.enabled),
    [workflows],
  );

  const workflowChoices = useMemo<WorkflowChoice[]>(() => {
    const mapped = callableWorkflows.map((w) => {
      const eligible = isEligible(w);
      return {
        id: w.id,
        name: w.name,
        description: w.description ?? '',
        eligible,
        reason: eligible ? undefined : t('processor.workflow.has-references'),
        ranked: detectedOrder.includes(w.id),
      };
    });
    if (detectedOrder.length === 0) return mapped;
    const rank = (id: string) => {
      const idx = detectedOrder.indexOf(id);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return [...mapped].sort((a, b) => rank(a.id) - rank(b.id));
  }, [callableWorkflows, detectedOrder, t]);

  const selectedWorkflow = useMemo(
    () => callableWorkflows.find((w) => w.id === selectedWorkflowId) ?? null,
    [callableWorkflows, selectedWorkflowId],
  );

  const connectionOptions = useMemo(
    () => connections.map((c) => ({ value: c.id, label: `${c.name} — ${c.provider}/${c.model}` })),
    [connections],
  );

  const selectedConnectionLabel = useMemo(
    () => connectionOptions.find((o) => o.value === selectedConnectionId)?.label ?? '',
    [connectionOptions, selectedConnectionId],
  );

  const hasNoConnections = !connectionsLoading && connections.length === 0;
  const trimmedText = freeText.trim();

  const canDetect =
    !!selectedConnectionId &&
    trimmedText.length > 0 &&
    !detecting &&
    callableWorkflows.some((w) => isEligible(w) && (w.description ?? '').trim().length > 0);

  const canRun =
    !!selectedWorkflow &&
    isEligible(selectedWorkflow) &&
    !running &&
    (trimmedText.length > 0 || (selectedWorkflow.parameters ?? []).length === 0) &&
    (!!selectedConnectionId || (selectedWorkflow.parameters ?? []).length === 0);

  const completedSteps = useMemo<Record<StepKey, boolean>>(
    () => ({
      source: trimmedText.length > 0,
      ai: !!selectedConnectionId,
      workflow: !!selectedWorkflow && isEligible(selectedWorkflow),
      run: !!resultExecution && resultExecution.status === 'SUCCESS',
    }),
    [trimmedText, selectedConnectionId, selectedWorkflow, resultExecution],
  );

  const furthestReachableIndex = useMemo(() => {
    let index = 0;
    while (index < STEP_ORDER.length - 1 && completedSteps[STEP_ORDER[index]]) index += 1;
    return index;
  }, [completedSteps]);

  const currentIndex = STEP_ORDER.indexOf(currentStep);

  const steps = useMemo<WizardStep[]>(
    () =>
      STEP_ORDER.map((key, index) => {
        const reachable = index <= furthestReachableIndex;
        const status: StepStatus =
          key === currentStep
            ? 'current'
            : completedSteps[key]
              ? 'done'
              : reachable
                ? 'upcoming'
                : 'locked';
        return {
          key,
          title: t(STEP_META[key].titleKey),
          hint: t(STEP_META[key].hintKey),
          status,
          reachable,
        };
      }),
    [currentStep, completedSteps, furthestReachableIndex, t],
  );

  const onGoToStep = useCallback(
    (key: StepKey) => {
      const index = STEP_ORDER.indexOf(key);
      if (index <= furthestReachableIndex) setCurrentStep(key);
    },
    [furthestReachableIndex],
  );

  const canGoBack = currentIndex > 0;
  const canGoNext = currentIndex < STEP_ORDER.length - 1 && completedSteps[currentStep];
  const isLastStep = currentIndex === STEP_ORDER.length - 1;

  const onBack = useCallback(() => {
    setCurrentStep((prev) => {
      const index = STEP_ORDER.indexOf(prev);
      return index > 0 ? STEP_ORDER[index - 1] : prev;
    });
  }, []);

  const onNext = useCallback(() => {
    setCurrentStep((prev) => {
      const index = STEP_ORDER.indexOf(prev);
      return index < STEP_ORDER.length - 1 ? STEP_ORDER[index + 1] : prev;
    });
  }, []);

  const onDetect = useCallback(async () => {
    if (!currentTenant || !selectedConnectionId || !trimmedText) return;

    const eligible = callableWorkflows.filter(isEligible);
    const withDescription = eligible.filter((w) => (w.description ?? '').trim().length > 0);
    const withoutDescription = eligible.filter((w) => !(w.description ?? '').trim());

    const newLogs: ProcessorLogEntry[] = withoutDescription.map((w) =>
      makeLog('warn', t('processor.log.no-description', { name: w.name }), w.id),
    );

    if (withDescription.length === 0) {
      setLogs([
        ...newLogs,
        makeLog('error', t('processor.log.none-describable')),
      ]);
      return;
    }

    setLogs(newLogs);
    setDetecting(true);
    try {
      const { orderedWorkflowIds } = await dataProcessorRepository.detectWorkflows({
        tenantId: currentTenant.id,
        connectionId: selectedConnectionId,
        text: trimmedText,
        workflows: withDescription.map((w) => ({ id: w.id, description: (w.description ?? '').trim() })),
      });

      setDetectedOrder(orderedWorkflowIds);
      if (orderedWorkflowIds.length === 0) {
        setLogs((prev) => [...prev, makeLog('info', t('processor.log.no-match'))]);
      } else {
        setSelectedWorkflowId(orderedWorkflowIds[0]);
        const names = orderedWorkflowIds
          .map((id) => callableWorkflows.find((w) => w.id === id)?.name ?? id)
          .join(' › ');
        setLogs((prev) => [...prev, makeLog('success', t('processor.log.matches', { names }))]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : t('processor.detect-failed');
      setLogs((prev) => [...prev, makeLog('error', message)]);
      notify(message, 'error');
    } finally {
      setDetecting(false);
    }
  }, [currentTenant, selectedConnectionId, trimmedText, callableWorkflows, dataProcessorRepository, notify, t]);

  const setStage = useCallback((key: string, status: StageStatus, detail?: string) => {
    setRunStages((prev) => prev.map((s) => (s.key === key ? { ...s, status, detail } : s)));
  }, []);

  const observeExecution = useCallback(
    (tenantId: string, workflowId: string, eventId: string) => {
      clearObservation();
      unsubRef.current = workflowExecutionRepository.subscribeToWorkflowExecutions(
        tenantId,
        workflowId,
        (execs) => {
          const exec = execs.find((e) => e.eventId === eventId);
          if (!exec || exec.status === 'RUNNING') return;
          setResultExecution(exec);
          if (exec.status === 'SUCCESS') {
            setStage('execute', 'success', t('processor.stage.succeeded'));
          } else {
            setStage('execute', 'error', t('processor.stage.failed'));
          }
          setRunning(false);
          clearObservation();
        },
        () => {
          setStage('execute', 'error', t('processor.stage.untracked'));
          setRunning(false);
          clearObservation();
        },
      );
      timeoutRef.current = setTimeout(() => {
        setStage('execute', 'error', t('processor.stage.timeout'));
        setRunning(false);
        clearObservation();
      }, EXECUTION_TIMEOUT_MS);
    },
    [workflowExecutionRepository, clearObservation, setStage, t],
  );

  const onRun = useCallback(async () => {
    if (!currentTenant || !selectedWorkflow) return;
    const targetId = selectedWorkflow.id;

    setResultExecution(null);
    setRunWorkflowId(targetId);
    setRunStages([
      { key: 'prepare', label: t('processor.stage.prepare'), status: 'running' },
      { key: 'execute', label: t('processor.stage.execute'), status: 'idle' },
    ]);
    setRunning(true);

    try {
      const { eventId } = await dataProcessorRepository.runWorkflow({
        tenantId: currentTenant.id,
        connectionId: selectedConnectionId || undefined,
        targetWorkflowId: targetId,
        text: trimmedText || undefined,
      });
      setStage('prepare', 'success');
      setStage('execute', 'running');
      observeExecution(currentTenant.id, targetId, eventId);
    } catch (err) {
      const message = err instanceof Error ? err.message : t('processor.run-failed');
      setStage('prepare', 'error', message);
      setRunning(false);
      notify(message, 'error');
    }
  }, [
    currentTenant,
    selectedWorkflow,
    selectedConnectionId,
    trimmedText,
    dataProcessorRepository,
    observeExecution,
    setStage,
    notify,
    t,
  ]);

  const onRestart = useCallback(() => {
    clearObservation();
    setFreeText('');
    setPdfFileName(null);
    setPdfFile(null);
    setPdfPreviewUrl(null);
    setPdfPageCount(0);
    setPdfPage(1);
    setSelectedWorkflowId('');
    setDetectedOrder([]);
    setLogs([]);
    setRunStages([]);
    setResultExecution(null);
    setRunWorkflowId('');
    setRunning(false);
    setCurrentStep('source');
  }, [clearObservation]);

  return {
    hasAccess,

    steps,
    currentStep,
    currentStepTitle: t(STEP_META[currentStep].titleKey),
    currentStepHint: t(STEP_META[currentStep].hintKey),
    onGoToStep,
    onBack,
    onNext,
    canGoBack,
    canGoNext,
    isLastStep,

    freeText,
    onFreeTextChange,
    textCharCount: trimmedText.length,

    pdfFileName,
    pdfExtracting,
    pdfPreviewUrl,
    pdfPageCount,
    pdfPage,
    pdfPageOptions,
    onSelectPdfPage,
    onPdfSelected,
    onClearPdf,

    connectionsLoading,
    hasNoConnections,
    connectionOptions,
    selectedConnectionId,
    selectedConnectionLabel,
    onSelectConnection,
    openAISettings,

    workflowChoices,
    selectedWorkflowId,
    selectedWorkflowName: selectedWorkflow?.name ?? '',
    onSelectWorkflow,

    canDetect,
    detecting,
    onDetect,

    logs,

    canRun,
    running,
    onRun,
    runStages,
    resultExecution,
    runSucceeded: !!resultExecution && resultExecution.status === 'SUCCESS',
    onRestart,

    openWorkflow,
    openResultExecutions,
  };
};
