// @vitest-environment jsdom
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ThemeProvider } from 'styled-components';
import { darkTheme } from '../../../../shared/styles/theme';
import type { WidgetSpec } from '../../../shared/widget/widgetSpec';
import { WidgetRenderer } from './WidgetRenderer.view';

const renderSpec = (spec: unknown) =>
  render(
    <ThemeProvider theme={darkTheme}>
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
        { label: 'Autor', value: 'Curatino' },
        { label: 'Evento', value: 'Pessoa' },
      ],
    } satisfies WidgetSpec);
    expect(screen.getByText('Autor')).toBeDefined();
    expect(screen.getByText('Curatino')).toBeDefined();
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
});
