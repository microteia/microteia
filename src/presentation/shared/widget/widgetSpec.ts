/**
 * Widget DSL — descrição declarativa e serializável de uma tela, renderizada pelo Kernel a partir
 * de metadata. É o que permite um plugin de terceiro entregar interface **sem uma linha de JS no
 * browser**: nada de `dangerouslySetInnerHTML`, `eval` ou estilo arbitrário; cada nó vira um
 * componente do próprio Microteia, com cor só via tema.
 *
 * v1 é estática (sem ligação a dados nem expressões) — suficiente para telas descritivas. Ligação a
 * dados (`source: query:/script:/field:`) é o próximo incremento.
 */
export type WidgetSpec =
  | { type: 'stack'; gap?: 'sm' | 'md' | 'lg'; children: WidgetSpec[] }
  | { type: 'grid'; columns?: number; children: WidgetSpec[] }
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string; muted?: boolean }
  | { type: 'markdown'; content: string }
  | { type: 'metric'; label: string; value: string }
  | { type: 'keyValue'; items: { label: string; value: string }[] }
  | { type: 'banner'; message: string; variant?: 'info' | 'warning' }
  | { type: 'divider' };

export type WidgetNodeType = WidgetSpec['type'];

export const WIDGET_NODE_TYPES: readonly WidgetNodeType[] = [
  'stack', 'grid', 'heading', 'text', 'markdown', 'metric', 'keyValue', 'banner', 'divider',
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Um nó é válido quando é um objeto com `type` conhecido. Filhos são validados na recursão. */
export const isWidgetSpec = (value: unknown): value is WidgetSpec =>
  isPlainObject(value) && WIDGET_NODE_TYPES.includes(value.type as WidgetNodeType);

/** Filhos renderizáveis de um nó de layout — sempre um array, nunca `undefined`. */
export const widgetChildren = (spec: WidgetSpec): WidgetSpec[] =>
  (spec.type === 'stack' || spec.type === 'grid') && Array.isArray(spec.children) ? spec.children : [];
