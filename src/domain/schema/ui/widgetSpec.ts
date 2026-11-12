/**
 * Widget DSL — descrição declarativa e serializável de uma tela, renderizada pelo Kernel a partir
 * de metadata. É o que permite um plugin de terceiro entregar interface **sem uma linha de JS no
 * browser**: nada de `dangerouslySetInnerHTML`, `eval` ou estilo arbitrário; cada nó vira um
 * componente do próprio Microteia, com cor só via tema.
 *
 * A ligação a dados chegou pelo nó `report`, que nomeia um relatório do catálogo; o `metric` passou a
 * poder mostrar UMA medida dele, e a barra `filters` responde os filtros de todos os relatórios abaixo
 * dela. `when` por expressão continua pendente.
 */

/** Como o nó `report` se mostra: inteiro, só o gráfico ou só a tabela — sem cabeçalho nem filtros. */
export const WIDGET_REPORT_VIEWS = ['full', 'chart', 'table'] as const;
export type WidgetReportView = typeof WIDGET_REPORT_VIEWS[number];

/**
 * Um filtro da barra `filters`. `period` oferece os períodos relativos dos relatórios; `text`, um
 * valor livre. A resposta só chega a um relatório que a LIGUE (`bind`) — a barra não adivinha qual
 * filtro de qual relatório é "o mesmo".
 */
export type WidgetFilter = {
  key: string;
  label?: string;
  control?: 'period' | 'text';
  default?: string;
};

/**
 * `type`, e não `interface`, nesta e na de cima: o spec viaja como `Record<string, unknown>` no
 * `impl.widget`, e uma interface não tem a assinatura de índice que essa atribuição exige.
 *
 * O que um nó ligado a relatório responde: `prompts` fixa respostas, `bind` liga um filtro do relatório
 * (a chave) a um filtro da barra (o valor). A barra vence quando foi respondida; depois o fixo; depois o
 * padrão do próprio relatório.
 */
export type WidgetReportAnswers = {
  prompts?: Record<string, unknown>;
  bind?: Record<string, string>;
};

export type WidgetSpec =
  | { type: 'stack'; gap?: 'sm' | 'md' | 'lg'; children: WidgetSpec[] }
  | { type: 'grid'; columns?: number; children: WidgetSpec[] }
  | { type: 'heading'; text: string }
  | { type: 'text'; text: string; muted?: boolean }
  | { type: 'markdown'; content: string }
  /**
   * Um número grande com legenda. Ou `value` (o texto, fixo), ou `report` + `measure`: o total daquela
   * medida (a primeira, sem `measure`). `compare: 'previous-period'` mostra a variação contra o período
   * anterior quando o filtro de período do relatório está num período corrente (este mês → mês passado).
   */
  | ({ type: 'metric'; label: string; value?: string; report?: string; measure?: string; compare?: 'previous-period' }
    & WidgetReportAnswers)
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
  | ({ type: 'report'; report: string; view?: WidgetReportView } & WidgetReportAnswers)
  /** A barra de filtros de um painel: os filhos são o que ela filtra. */
  | { type: 'filters'; filters: WidgetFilter[]; children: WidgetSpec[] };

export type WidgetNodeType = WidgetSpec['type'];

export const WIDGET_NODE_TYPES: readonly WidgetNodeType[] = [
  'stack', 'grid', 'heading', 'text', 'markdown', 'metric', 'keyValue', 'banner', 'divider',
  'report', 'filters',
] as const;

/**
 * O kernel a partir do qual um painel liga dados: `metric` com relatório, `report` com respostas ou
 * vista, e a barra `filters`. Um kernel anterior IGNORA o nó desconhecido — e a barra levaria junto
 * todo o painel que está dentro dela.
 */
export const WIDGET_DATA_SINCE_KERNEL = '2.112.0';

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

/** Um nó é válido quando é um objeto com `type` conhecido. Filhos são validados na recursão. */
export const isWidgetSpec = (value: unknown): value is WidgetSpec =>
  isPlainObject(value) && WIDGET_NODE_TYPES.includes(value.type as WidgetNodeType);

/** Filhos renderizáveis de um nó de layout — sempre um array, nunca `undefined`. */
export const widgetChildren = (spec: WidgetSpec): WidgetSpec[] =>
  (spec.type === 'stack' || spec.type === 'grid' || spec.type === 'filters') && Array.isArray(spec.children)
    ? spec.children
    : [];

/** O que o nó usa da ligação a dados — o que exige `WIDGET_DATA_SINCE_KERNEL`. */
const nodeDataFeatures = (node: WidgetSpec): string[] => {
  if (node.type === 'filters') return ['filters'];
  if (node.type === 'metric' && node.report !== undefined) return ['metric.report'];
  if (node.type === 'report') {
    return [
      ...(node.prompts !== undefined ? ['report.prompts'] : []),
      ...(node.bind !== undefined ? ['report.bind'] : []),
      ...(node.view !== undefined ? ['report.view'] : []),
    ];
  }
  return [];
};

/** As capacidades de dados que a árvore inteira usa, sem repetição e na ordem em que aparecem. */
export const widgetDataFeatures = (spec: unknown): string[] => {
  const found = new Set<string>();
  const walk = (node: unknown): void => {
    if (!isWidgetSpec(node)) return;
    for (const feature of nodeDataFeatures(node)) found.add(feature);
    widgetChildren(node).forEach(walk);
  };
  walk(spec);
  return [...found];
};

/**
 * As respostas que um nó manda ao relatório: as fixas (`prompts`) e, por cima, as da barra que ele
 * liga (`bind`).
 *
 * `filters` traz só os filtros da barra que TÊM estado — tocados ou com padrão. Ausente, o nó não diz
 * nada sobre aquele filtro, e vale o fixo ou o padrão do relatório; vazio, é o leitor escolhendo "qualquer
 * um", e vai como `null` — "sem restrição" — para o padrão do relatório não voltar por cima do gesto.
 */
export const resolveWidgetAnswers = (
  node: WidgetReportAnswers,
  filters: Readonly<Record<string, string>>,
): Record<string, unknown> => {
  const answers: Record<string, unknown> = { ...(node.prompts ?? {}) };
  for (const [prompt, filter] of Object.entries(node.bind ?? {})) {
    if (!Object.prototype.hasOwnProperty.call(filters, filter)) continue;
    answers[prompt] = filters[filter] === '' ? null : filters[filter];
  }
  return answers;
};
