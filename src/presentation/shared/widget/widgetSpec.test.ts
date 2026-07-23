import { describe, it, expect } from 'vitest';
import { isWidgetSpec, widgetChildren } from './widgetSpec';
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
