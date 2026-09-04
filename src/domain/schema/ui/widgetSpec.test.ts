import { describe, it, expect } from 'vitest';
import { isWidgetSpec, widgetChildren, WIDGET_NODE_TYPES } from './widgetSpec';
import type { WidgetSpec } from './widgetSpec';

describe('isWidgetSpec', () => {
  it.each([
    { type: 'heading', text: 'x' },
    { type: 'stack', children: [] },
    { type: 'divider' },
  ])('aceita nó com type conhecido: %o', (node) => {
    expect(isWidgetSpec(node)).toBe(true);
  });

  it.each([
    null,
    undefined,
    'texto',
    42,
    [],
    {},
    { type: 'desconhecido' },
    { type: 'script', content: 'alert(1)' },
  ])('rejeita valor inválido: %o', (value) => {
    expect(isWidgetSpec(value)).toBe(false);
  });
});

describe('widgetChildren', () => {
  it('devolve os filhos de um stack', () => {
    const spec: WidgetSpec = { type: 'stack', children: [{ type: 'divider' }] };
    expect(widgetChildren(spec)).toHaveLength(1);
  });

  it('devolve os filhos de um grid', () => {
    const spec: WidgetSpec = { type: 'grid', columns: 2, children: [{ type: 'divider' }, { type: 'divider' }] };
    expect(widgetChildren(spec)).toHaveLength(2);
  });

  it('devolve array vazio para nó folha', () => {
    expect(widgetChildren({ type: 'heading', text: 'x' })).toEqual([]);
  });

  it('devolve array vazio quando children está ausente/malformado', () => {
    expect(widgetChildren({ type: 'stack' } as unknown as WidgetSpec)).toEqual([]);
  });
});

/**
 * O nó de RELATÓRIO — a ligação a dados que o v1 não tinha.
 *
 * Ele nomeia um relatório do catálogo em vez de embutir a consulta: um `source:` inline poria
 * semântica de agregação, permissão e teto de varredura dentro de um DSL de layout.
 */
describe('nó report', () => {
  it('é um nó conhecido', () => {
    expect(isWidgetSpec({ type: 'report', report: 'faturamento' })).toBe(true);
    expect(WIDGET_NODE_TYPES).toContain('report');
  });

  it('não tem filhos — o relatório se desenha inteiro', () => {
    expect(widgetChildren({ type: 'report', report: 'faturamento' })).toEqual([]);
  });

  it('um nó DESCONHECIDO continua sendo recusado — acrescentar um tipo não abre a porta', () => {
    expect(isWidgetSpec({ type: 'sankey', data: [] })).toBe(false);
  });
});
