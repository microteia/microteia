// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';
import type { WorkflowDefinition } from '../../../domain/entities/Workflow';

/**
 * O Processador mandava à automação o texto de UMA página — a da prévia. Documento com o cabeçalho na
 * página 1 e os totais na última chegava pela metade, e nada falhava: o leitor gravava o registro sem os
 * totais (issue #7). A seleção de páginas manda várias, na ordem, separadas pelo mesmo `\f` do passo
 * "Ler documento" — e o padrão continua sendo a página 1.
 */
const PAGES = ['Header page', 'Middle page', 'Totals page'];

vi.mock('pdfjs-dist/build/pdf.worker.min.mjs?url', () => ({ default: 'worker.js' }));
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: {},
  getDocument: () => ({
    promise: Promise.resolve({
      numPages: PAGES.length,
      getPage: async (n: number) => ({
        getTextContent: async () => ({ items: PAGES[n - 1] === '' ? [] : [{ str: PAGES[n - 1], hasEOL: false }] }),
        getViewport: () => ({ width: 1, height: 1 }),
        render: () => ({ promise: Promise.resolve() }),
      }),
    }),
    destroy: async () => undefined,
  }),
}));

// Estáveis entre renders, como os de verdade: um `t` novo a cada render relançaria os efeitos sem fim.
const translate = (key: string) => key;
const resolveLabel = (value: string | null | undefined) => value ?? '';
vi.mock('../../shared/i18n/useT', () => ({
  useT: () => translate,
  useLabel: () => resolveLabel,
}));

const workflow = {
  id: 'wf-statement',
  tenantId: 't1',
  name: 'Statement',
  eventName: 'workflow.called',
  enabled: true,
  steps: [],
  parameters: [{ key: 'text', label: 'Text', type: 'String', fillFrom: 'sourceText' }],
} as unknown as WorkflowDefinition;

const runWorkflow = vi.fn(async () => ({ eventId: 'evt-1' }));

const tenant = { currentTenant: { id: 't1' } };
vi.mock('../../../stores/useTenant', () => ({ useTenant: () => tenant }));
vi.mock('../../../stores/useAuthorization', () => ({ useAuthorization: () => ({ can: () => true }) }));
vi.mock('../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ openTab: vi.fn() }) }));
const notify = vi.fn();
vi.mock('../../../stores/useNotification', () => ({ useNotification: () => ({ notify }) }));
const getConnections = { execute: async () => [] };
const workflowStore = { workflows: [workflow] };
vi.mock('../../../stores/useWorkflowStore', () => ({ useWorkflowStore: () => workflowStore }));
const di = {
  aiConnectionRepository: {},
  dataProcessorRepository: { runWorkflow, detectWorkflows: vi.fn() },
  workflowExecutionRepository: { subscribeToWorkflowExecutions: () => () => undefined },
};
vi.mock('../../../infrastructure/di/useDI', () => ({ useDI: () => di }));
vi.mock('../../../domain/usecases/aiconnections/GetAIConnectionsUseCase', () => ({
  makeGetAIConnectionsUseCase: () => getConnections,
}));

const { useDataProcessorViewModel } = await import('./DataProcessor.viewmodel');

const pdf = { name: 'statement.pdf', arrayBuffer: async () => new ArrayBuffer(4) } as unknown as File;

const openPdf = async () => {
  const hook = renderHook(() => useDataProcessorViewModel());
  act(() => hook.result.current.onPdfSelected(pdf));
  await waitFor(() => expect(hook.result.current.pdfExtracting).toBe(false));
  await waitFor(() => expect(hook.result.current.freeText).not.toBe(''));
  return hook;
};

const choosePages = async (hook: Awaited<ReturnType<typeof openPdf>>, spec: string) => {
  act(() => hook.result.current.onPdfPagesSpecChange(spec));
  await waitFor(() => expect(hook.result.current.pdfExtracting).toBe(false));
};

describe('Processador de dados — páginas enviadas (#7)', () => {
  beforeEach(() => {
    runWorkflow.mockClear();
    PAGES.splice(0, PAGES.length, 'Header page', 'Middle page', 'Totals page');
  });

  it('sem mexer em nada, manda só a página 1, como antes', async () => {
    const hook = await openPdf();
    expect(hook.result.current.pdfPagesSpec).toBe('1');
    expect(hook.result.current.freeText).toBe('Header page');

    act(() => hook.result.current.onSelectWorkflow('wf-statement'));
    await act(async () => hook.result.current.onRun());
    expect(runWorkflow).toHaveBeenCalledWith(expect.objectContaining({ text: 'Header page', sourceName: 'statement.pdf' }));
  });

  it('páginas 1,3 chegam na ordem, separadas por form feed', async () => {
    const hook = await openPdf();
    await choosePages(hook, '3,1');
    await waitFor(() => expect(hook.result.current.freeText).toBe('Header page\fTotals page'));
    expect(hook.result.current.pdfPagesSelectedCount).toBe(2);

    act(() => hook.result.current.onSelectWorkflow('wf-statement'));
    await act(async () => hook.result.current.onRun());
    expect(runWorkflow).toHaveBeenCalledWith(expect.objectContaining({ text: 'Header page\fTotals page' }));
  });

  it('"todas" manda o documento inteiro', async () => {
    const hook = await openPdf();
    act(() => hook.result.current.onSelectAllPdfPages());
    await waitFor(() => expect(hook.result.current.freeText).toBe('Header page\fMiddle page\fTotals page'));
    expect(hook.result.current.pdfPagesSpec).toBe('1-3');
  });

  it('a página em branco no início não some: o split continua dando a página certa', async () => {
    PAGES[0] = '';
    const hook = renderHook(() => useDataProcessorViewModel());
    act(() => hook.result.current.onPdfSelected(pdf));
    await waitFor(() => expect(hook.result.current.pdfPageCount).toBe(3));
    await choosePages(hook, '1-2');
    await waitFor(() => expect(hook.result.current.freeText).toBe('\fMiddle page'));
    expect(hook.result.current.textCharCount).toBe('\fMiddle page'.length);
  });

  it('página que o PDF não tem, ou seleção vazia, não deixa seguir', async () => {
    const hook = await openPdf();
    await choosePages(hook, '1,4');
    expect(hook.result.current.pdfPagesError).toBe('@core.automation/step.read-document.pages-out-of-range');
    expect(hook.result.current.canGoNext).toBe(false);

    await choosePages(hook, '  ');
    expect(hook.result.current.pdfPagesError).toBe('@core.admin/processor.pages.empty');
    expect(hook.result.current.canGoNext).toBe(false);

    await choosePages(hook, '2');
    expect(hook.result.current.pdfPagesError).toBeNull();
    await waitFor(() => expect(hook.result.current.canGoNext).toBe(true));
  });

  it('trocar a página da prévia manda aquela página, como sempre foi', async () => {
    const hook = await openPdf();
    act(() => hook.result.current.onSelectPdfPage('2'));
    await waitFor(() => expect(hook.result.current.freeText).toBe('Middle page'));
    expect(hook.result.current.pdfPagesSpec).toBe('2');
  });
});
