/**
 * Widget DSL — descrição declarativa e serializável de uma tela, renderizada pelo Kernel a partir
 * de metadata. É o que permite um plugin de terceiro entregar interface **sem uma linha de JS no
 * browser**: nada de `dangerouslySetInnerHTML`, `eval` ou estilo arbitrário; cada nó vira um
 * componente do próprio Microteia, com cor só via tema.
 *
 * A ligação a dados chegou pelo nó `report`, que nomeia um relatório do catálogo. `when` por
 * expressão continua pendente.
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
  | { type: 'divider' }
  /**
   * UM RELATÓRIO, pelo nome.
   *
   * É a ligação a dados que o v1 não tinha — e ela é INDIRETA de propósito. Inlinar uma consulta
   * aqui poria semântica de agregação, permissão e teto de varredura dentro de um DSL de layout, e
   * criaria um segundo lugar onde declarar o que um número significa. Nomear o relatório dá o mesmo
   * poder com um nó, e não fecha a porta para um `source:` inline depois.
   */
  | { type: 'report'; report: string };

export type WidgetNodeType = WidgetSpec['type'];

export const WIDGET_NODE_TYPES: readonly WidgetNodeType[] = [
  'stack', 'grid', 'heading', 'text', 'markdown', 'metric', 'keyValue', 'banner', 'divider',
  'report',
] as const;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Um nó é válido quando é um objeto com `type` conhecido. Filhos são validados na recursão. */
export const isWidgetSpec = (value: unknown): value is WidgetSpec =>
  isPlainObject(value) && WIDGET_NODE_TYPES.includes(value.type as WidgetNodeType);

/** Filhos renderizáveis de um nó de layout — sempre um array, nunca `undefined`. */
export const widgetChildren = (spec: WidgetSpec): WidgetSpec[] =>
  (spec.type === 'stack' || spec.type === 'grid') && Array.isArray(spec.children) ? spec.children : [];
