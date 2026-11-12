// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { baseDarkTheme } from '../../../../shared/styles/theme';
import type { WidgetSpec } from '../../../../domain/schema/ui/widgetSpec';
import { WidgetRenderer } from './WidgetRenderer.view';
import { useWidgetFilterValues } from '../../../shared/widgetFilterContext';

// O indicador ligado e o relatório falam com o servidor; aqui interessa o que o painel lhes ENTREGA:
// as props do nó e as respostas da barra que os envolve.
vi.mock('../ReportMetric', () => ({
  ReportMetric: (props: { reportKey: string; bind?: Record<string, string> }) => {
    const values = useWidgetFilterValues();
    return <span>{`metric:${props.reportKey}:${JSON.stringify(props.bind)}:${JSON.stringify(values)}`}</span>;
  },
}));
vi.mock('../ReportView', () => ({
  ReportView: (props: { reportKey: string; view?: string }) => <span>{`report:${props.reportKey}:${props.view ?? 'full'}`}</span>,
}));
vi.mock('../../../shared/i18n/useT', () => ({
  useLabel: () => (value: string | null | undefined) => value ?? '',
  useT: () => (key: string) => key,
}));

const renderSpec = (spec: unknown) =>
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <WidgetRenderer spec={spec} />
    </ThemeProvider>,
  );

describe('WidgetRenderer', () => {
  it('renderiza heading e text', () => {
    renderSpec({
      type: 'stack',
      children: [
        { type: 'heading', text: 'Título' },
        { type: 'text', text: 'Parágrafo' },
      ],
    } satisfies WidgetSpec);

    expect(screen.getByText('Título')).toBeDefined();
    expect(screen.getByText('Parágrafo')).toBeDefined();
  });

  it('renderiza um metric com valor e rótulo', () => {
    renderSpec({ type: 'metric', label: 'Automações', value: '3' } satisfies WidgetSpec);
    expect(screen.getByText('3')).toBeDefined();
    expect(screen.getByText('Automações')).toBeDefined();
  });

  it('renderiza pares keyValue', () => {
    renderSpec({
      type: 'keyValue',
      items: [
        { label: 'Autor', value: 'Microteia' },
        { label: 'Evento', value: 'Pessoa' },
      ],
    } satisfies WidgetSpec);
    expect(screen.getByText('Autor')).toBeDefined();
    expect(screen.getByText('Microteia')).toBeDefined();
    expect(screen.getByText('Evento')).toBeDefined();
  });

  it('renderiza markdown como HTML', () => {
    renderSpec({ type: 'markdown', content: 'Texto **forte**' } satisfies WidgetSpec);
    expect(screen.getByText('forte').tagName.toLowerCase()).toBe('strong');
  });

  it('renderiza recursivamente nós aninhados', () => {
    renderSpec({
      type: 'stack',
      children: [
        {
          type: 'grid',
          columns: 2,
          children: [
            { type: 'metric', label: 'A', value: '1' },
            { type: 'metric', label: 'B', value: '2' },
          ],
        },
      ],
    } satisfies WidgetSpec);
    expect(screen.getByText('1')).toBeDefined();
    expect(screen.getByText('2')).toBeDefined();
  });

  it('IGNORA nó desconhecido sem quebrar (degrada, não derruba)', () => {
    renderSpec({
      type: 'stack',
      children: [
        { type: 'heading', text: 'Ok' },
        { type: 'algo-do-futuro', payload: 'x' } as unknown as WidgetSpec,
        { type: 'text', text: 'Continua' },
      ],
    });
    expect(screen.getByText('Ok')).toBeDefined();
    expect(screen.getByText('Continua')).toBeDefined();
  });

  it('não renderiza nada para spec inválido no topo', () => {
    const { container } = renderSpec({ foo: 'bar' });
    expect(container.textContent).toBe('');
  });

  it('não renderiza nada para spec nulo', () => {
    const { container } = renderSpec(null);
    expect(container.textContent).toBe('');
  });

  it('o metric com relatório vira o indicador ligado; sem relatório, continua o número fixo', () => {
    renderSpec({
      type: 'grid',
      children: [
        { type: 'metric', label: 'Receita', report: 'acme-revenue' },
        { type: 'metric', label: 'Fixo', value: '7' },
      ],
    } satisfies WidgetSpec);
    expect(screen.getByText('metric:acme-revenue:undefined:{}')).toBeDefined();
    expect(screen.getByText('7')).toBeDefined();
  });

  it('a barra de filtros entrega o padrão de cada filtro aos nós de dentro, e passa a vista do relatório', () => {
    renderSpec({
      type: 'filters',
      filters: [{ key: 'when', control: 'period', default: 'this-month' }, { key: 'where' }],
      children: [
        { type: 'metric', label: 'Receita', report: 'acme-revenue', bind: { period: 'when' } },
        { type: 'report', report: 'acme-by-city', view: 'chart' },
      ],
    } satisfies WidgetSpec);
    expect(screen.getByText('metric:acme-revenue:{"period":"when"}:{"when":"this-month"}')).toBeDefined();
    expect(screen.getByText('report:acme-by-city:chart')).toBeDefined();
  });
});
