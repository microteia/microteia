// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import { ReportView } from './ReportView.view';
import { useReportFrame } from '../../../shared/report/reportFrame';
import type { ReportDefinition } from '../../../../domain/entities/Report';

const result = {
  shape: 'summary',
  columns: [],
  rows: [],
  totals: null,
  scanned: 3,
  complete: true,
  completeGroups: true,
  generatedAt: '2026-11-18T12:00:00.000Z',
};
const runReport = vi.fn(async () => ({ result, issues: [] }));

const report = {
  id: 'r1',
  key: 'acme-revenue',
  title: 'Receita',
  origin: 'plugin',
  spec: {
    v: 1,
    dataset: { table: 'orders' },
    shape: { kind: 'summary', groupBy: [], values: [] },
    presentation: { prompts: [{ key: 'customer', path: 'customer', op: 'in', required: true }] },
  },
} as unknown as ReportDefinition;

vi.mock('../../../shared/i18n/useT', () => ({
  useLabel: () => (value: string | null | undefined) => value ?? '',
  useT: () => (key: string) => key,
  useLocaleFormat: () => ({ formatNumber: String, formatDate: String, formatDateTime: String }),
}));
vi.mock('../../../../stores/useReportDefinitions', () => ({
  useReportDefinitions: () => ({ getReport: () => report, runReport }),
}));
vi.mock('../../../../stores/useWorkspace', () => ({ useWorkspace: () => ({ setTabTitle: () => {} }) }));
vi.mock('../../../../stores/useAuthorization', () => ({ useAuthorization: () => ({ can: () => true }) }));
vi.mock('../../../shared/useOpenRecord', () => ({ useOpenRecord: () => () => {} }));
vi.mock('../../../shared/report/useReportSchema', () => ({
  useReportSchema: () => ({ ctx: { screens: new Map() }, table: 'orders' }),
}));
vi.mock('../../../shared/report/useReportGroupLabels', () => ({ useReportGroupLabels: () => () => '' }));
vi.mock('../../../shared/report/useReportCsv', () => ({ useReportExport: () => () => {} }));
vi.mock('../ReportTable', () => ({ ReportTable: () => <span>standard-table</span> }));
vi.mock('../ReportChart', () => ({ ReportChart: () => <span>standard-chart</span> }));
vi.mock('../ReportMatrix', () => ({ ReportMatrix: () => <span>standard-matrix</span> }));
vi.mock('../ReportDrill', () => ({ ReportDrill: () => null }));
vi.mock('../ReportSubscribe', () => ({
  ReportSubscribe: (props: { prompts: Record<string, unknown> }) => <span>{`subscribe:${JSON.stringify(props.prompts)}`}</span>,
}));
vi.mock('../FieldFilterInput', () => ({ FieldFilterInput: () => <span>standard-prompt</span> }));

/** A view da extensão: um seletor próprio, e o resultado que a moldura lhe entrega. */
const CustomerBody: React.FC<{ tabKey: string }> = () => {
  const frame = useReportFrame();
  return (
    <div>
      <button onClick={() => { void frame?.run({ customer: ['c1'] }); }}>pick-customer</button>
      <span>{`custom:${frame?.result ? frame.result.scanned : 'none'}`}</span>
    </div>
  );
};

const Broken: React.FC<{ tabKey: string }> = () => {
  throw new Error('boom');
};

const renderView = (body?: React.ComponentType<{ tabKey: string }>) =>
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <ReportView reportKey="acme-revenue" tabKey="rep:acme-revenue" body={body} />
    </ThemeProvider>,
  );

beforeEach(() => {
  runReport.mockClear();
});

/**
 * O corpo da aba do relatório desenhado pela view que a extensão declara (#3). A moldura — título,
 * botões, avisos — continua da plataforma, e é ela que executa: exportar e assinar agem sobre a
 * pergunta que a view fez.
 */
describe('ReportView — o corpo desenhado pela extensão', () => {
  it('sem view, o corpo é o padrão: a barra de filtros do relatório', () => {
    renderView();

    expect(screen.getByText('prompts.required')).toBeDefined();
  });

  it('com view, a barra, o gráfico e a tabela padrão saem, e o cabeçalho fica', () => {
    renderView(CustomerBody);

    expect(screen.queryByText('prompts.required')).toBeNull();
    expect(screen.getByText('custom:none')).toBeDefined();
    expect(screen.getByText('Receita')).toBeDefined();
    expect(screen.getByText('toolbar.export')).toBeDefined();
  });

  it('a view pergunta pela moldura, e a assinatura repete as respostas DELA', async () => {
    renderView(CustomerBody);

    await act(async () => { fireEvent.click(screen.getByText('pick-customer')); });

    expect(runReport).toHaveBeenCalledWith({ reportId: 'r1', prompts: { customer: ['c1'] } });
    expect(screen.getByText('custom:3')).toBeDefined();

    fireEvent.click(screen.getByText('subscribe.action'));
    expect(screen.getByText('subscribe:{"customer":["c1"]}')).toBeDefined();
  });

  it('a view que quebra devolve o corpo padrão, dizendo por quê — a aba nunca fica em branco', () => {
    const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
    renderView(Broken);
    quiet.mockRestore();

    expect(screen.getByText('view.failed')).toBeDefined();
    expect(screen.getByText('prompts.required')).toBeDefined();
  });
});
