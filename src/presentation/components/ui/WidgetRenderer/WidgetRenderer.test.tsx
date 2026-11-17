// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
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
// A fonte de um filtro de escolha mora nos stores do escritório; aqui ela é a tela `clients` (que só o
// pacote dono conhece) e a lista `statuses`. Qualquer outra coleção não está instalada.
vi.mock('../../../shared/widgetChoiceField', () => ({
  useWidgetChoiceField: (pluginId: string | undefined) =>
    (filter: { key: string; control?: string; collection?: string; multi?: boolean }, label: string) => {
      const known = (filter.control === 'record' && filter.collection === 'clients' && pluginId === 'com.acme.sales')
        || (filter.control === 'lookup' && filter.collection === 'statuses');
      return known
        ? { key: filter.key, label, type: filter.control === 'record' ? 'reference' : 'select', multi: filter.multi !== false }
        : null;
    },
}));
// O controle é o do filtro do relatório; aqui ele só mostra o que recebe e devolve uma escolha.
vi.mock('../FieldFilterInput', () => ({
  FieldFilterInput: (props: { field: { key: string; type: string; multi: boolean }; value: unknown; onChange: (value: unknown) => void }) => (
    <button onClick={() => props.onChange(props.field.multi ? ['c1', 'c2'] : 'c1')}>
      {`choice:${props.field.key}:${props.field.type}:${props.field.multi}:${JSON.stringify(props.value)}`}
    </button>
  ),
}));
vi.mock('../../../shared/i18n/useT', () => ({
  useLabel: () => (value: string | null | undefined) => value ?? '',
  useT: () => (key: string) => key,
}));

const renderSpec = (spec: unknown, pluginId?: string) =>
  render(
    <ThemeProvider theme={baseDarkTheme}>
      <WidgetRenderer spec={spec} pluginId={pluginId} />
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

  it('o filtro de registro e o de lista escolhem pelo controle do relatório, e a resposta vai como LISTA', () => {
    renderSpec({
      type: 'filters',
      filters: [
        { key: 'client', control: 'record', collection: 'clients' },
        { key: 'status', control: 'lookup', collection: 'statuses', multi: false, default: 'active' },
      ],
      children: [{ type: 'metric', label: 'Receita', report: 'acme-revenue', bind: { client: 'client', status: 'status' } }],
    } satisfies WidgetSpec, 'com.acme.sales');

    expect(screen.getByText('choice:client:reference:true:null')).toBeDefined();
    expect(screen.getByText('choice:status:select:false:"active"')).toBeDefined();
    // Escolha de UM ainda vai como lista: é o que `eq` e `in` do relatório entendem os dois.
    expect(screen.getByText('metric:acme-revenue:{"client":"client","status":"status"}:{"status":["active"]}')).toBeDefined();

    fireEvent.click(screen.getByText('choice:client:reference:true:null'));
    expect(screen.getByText(
      'metric:acme-revenue:{"client":"client","status":"status"}:{"client":["c1","c2"],"status":["active"]}',
    )).toBeDefined();
  });

  it('a fonte que o escritório não tem some da barra — o seletor vazio diria que não há clientes', () => {
    renderSpec({
      type: 'filters',
      filters: [{ key: 'client', label: 'Cliente', control: 'record', collection: 'clients' }],
      children: [{ type: 'metric', label: 'Receita', report: 'acme-revenue', bind: { client: 'client' } }],
    } satisfies WidgetSpec);

    expect(screen.queryByText('Cliente')).toBeNull();
    expect(screen.getByText('metric:acme-revenue:{"client":"client"}:{}')).toBeDefined();
  });
});
