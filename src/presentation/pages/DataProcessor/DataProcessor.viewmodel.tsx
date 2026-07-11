import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { useTenant } from '../../../stores/useTenant';
import { useWorkspace } from '../../../stores/useWorkspace';
import { useNotification } from '../../../stores/useNotification';
import { useDI } from '../../../infrastructure/di/useDI';
import { useWorkflowStore } from '../../../stores/useWorkflowStore';
import { makeGetAIConnectionsUseCase } from '../../../domain/usecases/aiconnections/GetAIConnectionsUseCase';
import { WORKFLOW_CALLED_EVENT } from '../../../domain/schema/eventCatalog';
import type { AIConnection } from '../../../domain/entities';
import type { WorkflowDefinition, WorkflowExecution, WorkflowParameter } from '../../../domain/entities/Workflow';

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

export interface DataProcessorViewModel {
  hasAccess: boolean;

  freeText: string;
  onFreeTextChange: (value: string) => void;

  pdfFileName: string | null;
  pdfExtracting: boolean;
  pdfPreviewUrl: string | null;
  onPdfSelected: (file: File) => void;
  onClearPdf: () => void;

  connectionsLoading: boolean;
  hasNoConnections: boolean;
  connectionOptions: { value: string; label: string }[];
  selectedConnectionId: string;
  onSelectConnection: (id: string) => void;
  openAISettings: () => void;

  workflowChoices: WorkflowChoice[];
  selectedWorkflowId: string;
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

  openWorkflow: (id: string) => void;
  openResultExecutions: () => void;
}

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
  const { currentTenant, tenantRole } = useTenant();
  const { openTab } = useWorkspace();
  const { notify } = useNotification();
  const { aiConnectionRepository, dataProcessorRepository, workflowExecutionRepository } = useDI();
  const { workflows } = useWorkflowStore();

  const hasAccess = tenantRole === 'admin' || tenantRole === 'lawyer';

  const getConnectionsUC = useMemo(
    () => makeGetAIConnectionsUseCase(aiConnectionRepository),
    [aiConnectionRepository],
  );

  const [freeText, setFreeText] = useState('');
  const [pdfFileName, setPdfFileName] = useState<string | null>(null);
  const [pdfData, setPdfData] = useState<Uint8Array | null>(null);
  const [pdfExtracting, setPdfExtracting] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

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
    if (!pdfData) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- inicializa o estado de carregamento antes da operação assíncrona
    setPdfExtracting(true);
    const task = pdfjsLib.getDocument({ data: pdfData });
    task.promise
      .then(async (pdf) => {
        const page = await pdf.getPage(1);
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
      })
      .catch(() => {
        if (!cancelled) {
          notify('Não foi possível ler o PDF selecionado.', 'error');
          setPdfFileName(null);
        }
      })
      .finally(() => {
        void task.destroy();
        if (!cancelled) setPdfExtracting(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pdfData, notify]);

  const onFreeTextChange = useCallback((value: string) => setFreeText(value), []);

  const onPdfSelected = useCallback((file: File) => {
    setPdfFileName(file.name);
    setPdfPreviewUrl(null);
    file.arrayBuffer().then((buffer) => setPdfData(new Uint8Array(buffer)));
  }, []);

  const onClearPdf = useCallback(() => {
    setPdfFileName(null);
    setPdfData(null);
    setPdfPreviewUrl(null);
  }, []);

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
        reason: eligible ? undefined : 'Possui parâmetros de referência (ainda não suportados).',
        ranked: detectedOrder.includes(w.id),
      };
    });
    if (detectedOrder.length === 0) return mapped;
    const rank = (id: string) => {
      const idx = detectedOrder.indexOf(id);
      return idx === -1 ? Number.MAX_SAFE_INTEGER : idx;
    };
    return [...mapped].sort((a, b) => rank(a.id) - rank(b.id));
  }, [callableWorkflows, detectedOrder]);

  const selectedWorkflow = useMemo(
    () => callableWorkflows.find((w) => w.id === selectedWorkflowId) ?? null,
    [callableWorkflows, selectedWorkflowId],
  );

  const connectionOptions = useMemo(
    () => connections.map((c) => ({ value: c.id, label: `${c.name} — ${c.provider}/${c.model}` })),
    [connections],
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

  const onDetect = useCallback(async () => {
    if (!currentTenant || !selectedConnectionId || !trimmedText) return;

    const eligible = callableWorkflows.filter(isEligible);
    const withDescription = eligible.filter((w) => (w.description ?? '').trim().length > 0);
    const withoutDescription = eligible.filter((w) => !(w.description ?? '').trim());

    const newLogs: ProcessorLogEntry[] = withoutDescription.map((w) =>
      makeLog('warn', `"${w.name}" não foi enviada por não ter descrição cadastrada.`, w.id),
    );

    if (withDescription.length === 0) {
      setLogs([
        ...newLogs,
        makeLog('error', 'Nenhuma automação com descrição disponível para detecção.'),
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
        setLogs((prev) => [...prev, makeLog('info', 'A IA não encontrou automação compatível com o texto.')]);
      } else {
        setSelectedWorkflowId(orderedWorkflowIds[0]);
        const names = orderedWorkflowIds
          .map((id) => callableWorkflows.find((w) => w.id === id)?.name ?? id)
          .join(' › ');
        setLogs((prev) => [...prev, makeLog('success', `Automações compatíveis (por adequação): ${names}`)]);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao detectar automações.';
      setLogs((prev) => [...prev, makeLog('error', message)]);
      notify(message, 'error');
    } finally {
      setDetecting(false);
    }
  }, [currentTenant, selectedConnectionId, trimmedText, callableWorkflows, dataProcessorRepository, notify]);

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
            setStage('execute', 'success', 'Concluída com sucesso.');
          } else {
            setStage('execute', 'error', 'A automação falhou.');
          }
          setRunning(false);
          clearObservation();
        },
        () => {
          setStage('execute', 'error', 'Não foi possível acompanhar a execução.');
          setRunning(false);
          clearObservation();
        },
      );
      timeoutRef.current = setTimeout(() => {
        setStage('execute', 'error', 'Tempo esgotado ao aguardar a execução. Confira na aba Execuções.');
        setRunning(false);
        clearObservation();
      }, EXECUTION_TIMEOUT_MS);
    },
    [workflowExecutionRepository, clearObservation, setStage],
  );

  const onRun = useCallback(async () => {
    if (!currentTenant || !selectedWorkflow) return;
    const targetId = selectedWorkflow.id;

    setResultExecution(null);
    setRunWorkflowId(targetId);
    setRunStages([
      { key: 'prepare', label: 'Enviando dados e preenchendo a automação', status: 'running' },
      { key: 'execute', label: 'Executando a automação', status: 'idle' },
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
      const message = err instanceof Error ? err.message : 'Erro ao executar a automação.';
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
  ]);

  return {
    hasAccess,
    freeText,
    onFreeTextChange,
    pdfFileName,
    pdfExtracting,
    pdfPreviewUrl,
    onPdfSelected,
    onClearPdf,
    connectionsLoading,
    hasNoConnections,
    connectionOptions,
    selectedConnectionId,
    onSelectConnection,
    openAISettings,
    workflowChoices,
    selectedWorkflowId,
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
    openWorkflow,
    openResultExecutions,
  };
};
