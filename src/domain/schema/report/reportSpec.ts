// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportSpec.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { NumericAggregationOp } from '../fieldRules';
import { extractFieldExpressionPaths } from '../fieldExpression';
import { parsePath, resolvePath } from '../pathResolver';
import type { SchemaContext } from '../pathResolver';
import { resolveQueryTable } from '../querySpec';
import type { QueryOperator, QueryOrderBy, QueryPredicate, QuerySpec } from '../querySpec';
import type { InputMapping } from '../../entities/Workflow';
import { collectionPermissionId } from '../access/permission';

/**
 * O MAJOR do FORMATO — e nada mais.
 *
 * Toda evolução aditiva o deixa em 1; ele só se move numa quebra total, e uma quebra total é a única
 * coisa que autoriza um kernel a recusar o relatório inteiro sem olhar dentro dele.
 *
 * Existe apesar de `Contribution.apiVersion` porque o relatório do ESCRITÓRIO não é contribuição
 * nenhuma: é dado do tenant, gravado num documento, e precisa se descrever sozinho.
 */
export const REPORT_SPEC_VERSION = 1;

/**
 * De onde as linhas vêm. Aberto por string no ÚNICO lugar em que fechá-lo custaria um major.
 *
 * Hoje só existe `collection`. No dia em que `join` nascer, um kernel que não o conheça precisa
 * PARAR — e é este discriminante que o faz parar. Sem ele, o kernel velho leria `table`, produziria
 * um relatório sobre um lado do join e o rotularia com o título do todo: um número plausível e
 * errado, que é a única falha que este contrato não pode admitir.
 */
export type ReportDatasetKind = string;

export const REPORT_DATASET_KINDS: readonly ReportDatasetKind[] = ['collection'];

export const DEFAULT_REPORT_DATASET_KIND = 'collection';

/**
 * Os baldes de data — o `bin` do Vega-Lite, a `granularity` do Cube. Sem eles, uma dimensão de data
 * produz um grupo por registro, e "faturamento por mês" seria impossível de declarar.
 */
export type ReportGranularity = 'day' | 'week' | 'month' | 'quarter' | 'year';

export const REPORT_GRANULARITIES: readonly ReportGranularity[] =
  ['day', 'week', 'month', 'quarter', 'year'];

/** Lê de volta uma granularidade declarada, devolvendo `undefined` para a que este kernel não conhece. */
export const reportGranularityOf = (value: unknown): ReportGranularity | undefined =>
  REPORT_GRANULARITIES.find((granularity) => granularity === value);

export interface ReportValueFormat {
  /** Aberto: `number`, `integer`, `currency`, `percent`, `date`, `duration` hoje. */
  kind?: string;
  decimals?: number;
  /** Preset do MESMO catálogo de `fieldRulePresets` que o campo usa — nunca um catálogo paralelo. */
  preset?: string;
}

/**
 * O que se pode AGRUPAR e PROJETAR.
 *
 * `key` é a identidade DENTRO do relatório, e é por ela que `shape` e `presentation` a citam — nunca
 * pelo `path`. A indireção é o que compra anos: trocar o caminho medido, mudar o balde ou promover a
 * dimensão a calculada é mudança de UMA entrada daqui, e nenhuma das outras camadas muda uma letra.
 */
export interface ReportDimension {
  key: string;
  /**
   * Caminho no registro, com hop de FK (`client.name`). MESMA gramática de `QuerySpec.projections`,
   * mesmo `resolvePath`, mesma hidratação — é o que dispensa um mecanismo de join na v1.
   */
  path: string;
  /** Referência `@ns/chave` numa extensão; o que o escritório digitou passa INTACTO por `useLabel`. */
  label?: string;
  /**
   * O BALDE. Só significa algo sobre data; sobre outro tipo é ignorado com aviso. Valor desconhecido
   * degrada para o VALOR CRU, jamais para um balde diferente: um mês exibido como dia é uma tabela
   * grande; um mês exibido como trimestre é uma mentira.
   */
  granularity?: ReportGranularity;
  /**
   * Fuso em que o balde é cortado (IANA). Ausente = UTC. Sem ele, "vendas de segunda" muda de dia
   * conforme quem abre o relatório — e ninguém descobre.
   */
  timeZone?: string;
  /**
   * A ordem dos membros deste nível. `by` ausente ou `'key'` ordena pelo valor do grupo; a CHAVE de
   * uma medida ordena pelo valor dela naquele grupo — é o "Top N" (`dir: 'desc'` + `limit`). `'label'`
   * continua previsto e não executado: o rótulo de um grupo é resolvido na tela, no idioma de quem lê,
   * e o servidor que corta o nível não o conhece.
   */
  sort?: { by?: 'key' | 'label' | string; dir?: 'asc' | 'desc' };
  /**
   * Teto de membros distintos DESTE nível: ficam os primeiros, na ordem de `sort`.
   *
   * Sem `others`, o excedente sai da tabela e o total geral continua somando as linhas todas. Por isso
   * o corte marca o resultado como PARCIAL: as linhas visíveis não fecham com o próprio total, e isso
   * precisa estar dito na tela, no CSV e na impressão.
   */
  limit?: number;
  /**
   * Com `limit`, o excedente vira UM grupo residual — "Outros" — em vez de sair da tabela.
   *
   * É o que faz um Top 10 fechar com o próprio total: as dez linhas mais a residual somam o mesmo que
   * o total geral, e o resultado deixa de ser parcial. O grupo residual tem a chave reservada
   * `REPORT_OTHERS_KEY`, e é ela que a tela traduz.
   */
  others?: boolean;
}

/**
 * A chave do grupo residual de um nível com `others`. Começa por um caractere de controle para nunca
 * colidir com um valor que alguém digitou — o mesmo cuidado do separador das chaves compostas.
 */
export const REPORT_OTHERS_KEY = '\u001eothers';

interface ReportMeasureBase {
  key: string;
  label?: string;
  format?: ReportValueFormat;
}

/**
 * A medida agregada. `kind` ausente é `aggregate` — e mudar esse padrão é QUEBRA ainda que nenhum
 * JSON mude, porque todo spec gravado hoje omite o campo.
 */
export interface ReportAggregateMeasure extends ReportMeasureBase {
  kind?: 'aggregate';
  /**
   * O MESMO vocabulário NUMÉRICO do agregado de campo (`FieldAggregation.op`). Uma segunda lista de
   * operações seria a primeira divergência silenciosa entre o total de um relatório e o total de um
   * campo. `latest` fica de fora: ele copia um valor, e uma medida tem de ser número.
   */
  op: NumericAggregationOp;
  /** Caminho medido. Obrigatório salvo em `count`. */
  path?: string;
  /** A MEDIDA FILTRADA do Cube: restringe esta medida, e só ela. */
  filter?: QueryPredicate[];
  distinct?: boolean;
}

/**
 * A medida CALCULADA — razão, percentual, ticket médio. Um kernel que não a saiba fazer recusa pelo
 * NOME dela (`requires`), em vez de somar sem ela.
 *
 * A expressão vê as OUTRAS medidas, por chave, e nunca o registro: uma razão de médias não é a média
 * das razões, e deixar a expressão enxergar a linha convidaria exatamente esse erro. É avaliada
 * depois da agregação, em cada linha, subtotal, célula e total (`evaluateComputedMeasure`).
 */
export interface ReportComputedMeasure extends ReportMeasureBase {
  kind: 'computed';
  expression: string;
}

export type ReportMeasure = ReportAggregateMeasure | ReportComputedMeasure;

/** `kind` ausente é `aggregate`; é a leitura única desse padrão, para ninguém reinventá-la. */
export const isAggregateMeasure = (measure: ReportMeasure): measure is ReportAggregateMeasure =>
  measure.kind === undefined || measure.kind === 'aggregate';

export interface ReportDataset {
  /** Ausente = `collection`. Mudar este padrão é QUEBRA, ainda que nenhum JSON mude. */
  kind?: ReportDatasetKind;
  /**
   * A COLEÇÃO. Num pacote é a chave de TEMPLATE da tela, reescrita para a chave instalada por
   * `materializeReport` — a coleção pode ganhar sufixo no escritório de destino.
   */
  table: string;
  /** O filtro FIXO do relatório. Reuso literal do predicado do `QuerySpec`, `InputMapping` incluso. */
  where?: QueryPredicate[];
  /**
   * O filtro por EXPRESSÃO — a pergunta feita sobre a LINHA, e a linha entra no relatório quando ela
   * responde verdadeiro.
   *
   * É o MESMO idioma do `hiddenWhen` de uma ação e do `validate` de um campo, com o mesmo catálogo de
   * funções: o escopo é o registro, plano por chave, e uma referência é navegada pelo nome do
   * apontado (`cliente.cidade`).
   *
   * Existe AO LADO de `where`, não em vez dele, porque são duas coisas diferentes. Um predicado
   * compara UM caminho com UM valor, e é ele que desce ao Firestore como igualdade rasa — é a
   * varredura mais barata que o relatório tem. Esta é a pergunta que nenhuma lista de predicados
   * escreve: dois campos comparados entre si, uma conta, uma data relativa a hoje, um OU no meio de
   * dois ES. Ela é sempre avaliada em MEMÓRIA, sobre o que a varredura trouxe, e por isso ela restringe
   * o resultado sem nunca ampliar o que foi lido.
   *
   * Mora em `dataset` porque muda o NÚMERO, e é essa posição que faz um kernel que não a conheça
   * RECUSAR o relatório pelo nome dela — em vez de somar, calado, justamente as linhas que ela exclui.
   */
  includeWhen?: string;
  dimensions?: ReportDimension[];
  measures?: ReportMeasure[];
  /** Teto de registros VARRIDOS. Pedido acima do teto do executor é grampeado, nunca recusado. */
  scanLimit?: number;
}

/**
 * UM nível de agrupamento.
 *
 * É objeto, e não `string`, porque o subtotal é propriedade DO NÍVEL — não da lista de níveis. Uma
 * lista paralela de "quais níveis subtotalizam" dessincroniza na primeira reordenação, e a
 * dessincronia aparece como um subtotal no lugar errado.
 */
export interface ReportGroupLevel {
  /** Chave de uma `ReportDimension`. NUNCA um caminho. */
  dimension: string;
  subtotal?: boolean;
  collapsed?: boolean;
}

/** O registro é a linha — e a lista pode ser QUEBRADA em grupos sem deixar de mostrar os registros. */
export interface ReportTabularShape {
  kind: 'tabular';
  /** Chaves de DIMENSÃO, na ordem das colunas. Uma medida aqui é erro nomeado. */
  columns: string[];
  /**
   * Os níveis que quebram a lista em grupos. Ausente ou vazio = lista corrida.
   *
   * É a LISTA AGRUPADA, e ela não é `summary` com detalhe: no resumo o grupo SUBSTITUI os registros
   * — ele é a resposta —, e aqui o grupo os EMOLDURA. Um relatório que responde "quanto cada cliente
   * deve" e um que responde "o que cada cliente deve" são perguntas diferentes, e a segunda não
   * tinha como ser declarada: quem punha as dimensões numa dobra agrupada perdia as colunas, porque
   * cada dimensão virava um nível de recuo.
   *
   * Array desde o dia um, e não uma chave só, porque o custo é o mesmo: `buildTree` já percorre N
   * níveis, e é a mesma recursão que o resumo e o pivô usam. Fechar em um nível agora obrigaria a um
   * segundo formato depois — e o `.json` já gravado no escritório não se reescreve.
   *
   * A dimensão que agrupa sai das `columns`: repeti-la em toda linha de detalhe é escrever o mesmo
   * valor debaixo do cabeçalho que acabou de o dizer.
   */
  groupBy?: ReportGroupLevel[];
  orderBy?: QueryOrderBy[];
  limit?: number;
}

/** Agrupado, com subtotal por nível. */
export interface ReportSummaryShape {
  kind: 'summary';
  /** Níveis, do mais externo ao mais interno. Array desde o dia um. */
  groupBy: ReportGroupLevel[];
  /** Chaves de MEDIDA, na ordem. Array desde o dia um: duas medidas por célula é o caso comum. */
  values: string[];
  grandTotal?: boolean;
  limit?: number;
}

/** O pivô: linhas × colunas. */
export interface ReportMatrixShape {
  kind: 'matrix';
  rows: ReportGroupLevel[];
  columns: ReportGroupLevel[];
  values: string[];
  grandTotal?: boolean;
  /** Zero e vazio não são a mesma afirmação: um diz "houve e deu zero", o outro "não houve". */
  emptyCell?: 'blank' | 'zero';
}

export type ReportShape = ReportTabularShape | ReportSummaryShape | ReportMatrixShape;

export type ReportShapeKind = string;

export const REPORT_SHAPE_KINDS: readonly ReportShapeKind[] = ['tabular', 'summary', 'matrix'];

/**
 * Aberto de propósito: um ponto `reports.chart` futuro deixa uma extensão trazer o renderizador, e o
 * kind dela virá qualificado (`com.acme.charts/sankey`). Fechar agora custaria um major depois.
 */
export type ReportChartKind = string;

export const REPORT_CHART_KINDS: readonly ReportChartKind[] =
  ['bar', 'column', 'line', 'area', 'pie', 'donut'];

export interface ReportChart {
  kind: ReportChartKind;
  /** Dimensão do eixo categórico. Ausente = o primeiro nível de `rows`/`groupBy`. */
  category?: string;
  /** Medidas desenhadas. Ausente = todas as de `values`. */
  series?: string[];
  /** Quebra as séries por uma segunda dimensão — o `columns` do pivô virando legenda. */
  splitBy?: string;
  stacked?: boolean;
  height?: number;
}

export interface ReportFieldPresentation {
  label?: string;
  format?: ReportValueFormat;
  align?: 'start' | 'center' | 'end';
  width?: number;
  hidden?: boolean;
}

/** O filtro que o LEITOR preenche na tela. `value` nasce vazio; `default` semeia. */
export interface ReportPrompt {
  key: string;
  label?: string;
  path: string;
  op: QueryOperator;
  /**
   * Como ele escolhe. Ausente = herda o controle do campo apontado. `'period'` pede um PERÍODO
   * relativo (`REPORT_PERIODS`) sobre um caminho de data, e o servidor o converte num intervalo no
   * fuso do escritório — `op` é ignorado, porque o período já é a comparação.
   */
  control?: string;
  /** Sem resposta, o relatório não roda: o servidor recusa, e a tela não deixa executar. */
  required?: boolean;
  /**
   * O valor usado quando o filtro NÃO é enviado (a chave ausente). Um filtro enviado vazio é uma
   * resposta — "sem restrição" — e não é substituído: é o que deixa o leitor limpar o padrão.
   */
  default?: InputMapping;
}

/** O tom de um realce. Tom, nunca cor: quem desenha é o tema, e o tema escuro tem o seu verde. */
export const REPORT_HIGHLIGHT_TONES = ['positive', 'warning', 'negative'] as const;

export type ReportHighlightTone = typeof REPORT_HIGHLIGHT_TONES[number];

export const REPORT_HIGHLIGHT_OPS = ['lt', 'lte', 'gt', 'gte', 'eq', 'neq'] as const;

export type ReportHighlightOp = typeof REPORT_HIGHLIGHT_OPS[number];

/**
 * A formatação CONDICIONAL de uma medida: a célula ganha um tom quando o valor atende à comparação.
 *
 * Mora em `presentation` porque removê-la deixa o relatório correto — o número é o mesmo, só deixa de
 * chamar a atenção. A primeira regra que casa vence, na ordem declarada.
 */
export interface ReportHighlight {
  /** Chave de uma medida. */
  measure: string;
  op: ReportHighlightOp;
  value: number;
  tone: ReportHighlightTone;
}

/**
 * A APARÊNCIA — e o limite dela.
 *
 * REGRA DA CAMADA: só pode conter propriedade cuja REMOÇÃO deixa um relatório correto. O que muda um
 * número mora em `dataset` ou em `shape`. Há teste mecânico, porque regra que só existe na prosa
 * erode: sem ele, esta camada vira um segundo Widget DSL em dois anos.
 */
export interface ReportPresentation {
  chart?: ReportChart;
  /** Aparência por chave de dimensão OU de medida — o espaço de nomes é um só. */
  fields?: Record<string, ReportFieldPresentation>;
  prompts?: ReportPrompt[];
  /** A formatação condicional, por medida. Ver `ReportHighlight`. */
  highlight?: ReportHighlight[];
  /**
   * O DETALHAMENTO: clicar num grupo ou numa célula abre os registros daquele recorte. Ligado por
   * padrão — ver o número sem poder ver de onde ele vem é a pergunta que todo leitor faz em seguida —,
   * e `enabled: false` o desliga para quem quer o relatório só como resumo.
   *
   * Objeto desde já, e não booleano: booleano que vira objeto é a quebra clássica, e um alvo de
   * detalhamento é a primeira coisa que este campo vai querer.
   */
  drillDown?: { enabled?: boolean };
  export?: { csv?: boolean; pdf?: boolean; fileName?: string };
}

export interface ReportAccess {
  /**
   * A permissão PRÓPRIA. Ela só RESTRINGE; NUNCA concede: ver o relatório exige esta permissão E a
   * leitura de cada coleção que ele toca. A alternativa transformaria cada relatório num vetor de
   * escalada de privilégio autorado por quem só tem `reports.manage` — e criar relatório é, de
   * propósito, um gesto barato.
   */
  permission?: string;
  /** O que essa permissão passa a exigir. Mesma semântica aditiva de `access.requirement`. */
  requires?: string[];
}

/** PREVISTO no contrato, não executado na v1. Reservar o nome é o que torna a ida e volta sem perda. */
export interface ReportSchedule {
  cron?: string;
  timeZone?: string;
  delivery?: { kind: string; to?: string[]; format?: string }[];
  enabled?: boolean;
}

/**
 * A espinha é FIXA e legível por qualquer versão; a variação mora dentro de cada camada, onde a
 * recusa pode ser nomeada.
 *
 * Não é união discriminada na raiz — e essa é a decisão que governa todas as outras. O `WidgetSpec`
 * pode ser união porque é árvore composicional: descartar um nó deixa uma árvore válida. Um
 * relatório é uma AFIRMAÇÃO SOBRE UM NÚMERO, com raiz só: diante de uma `shape` desconhecida, um
 * kernel velho precisa conseguir ler `dataset` para dizer sobre o que o relatório é, em vez de
 * recusar uma caixa preta.
 */
export interface ReportSpec {
  v: number;
  dataset: ReportDataset;
  shape: ReportShape;
  presentation?: ReportPresentation;
  access?: ReportAccess;
  schedule?: ReportSchedule;
  /**
   * As capacidades que este relatório EXIGE de quem o executa. É DERIVADA por
   * `deriveReportRequires` e nunca escrita à mão — a mesma regra de "afirmação sobre o kernel num
   * documento gerado é DERIVADA, nunca prosa".
   *
   * O portão do pacote (`packageIssues`, e portanto o `build` da extensão e o `validate_plugin` do
   * MCP) reprova a OMISSÃO: um `requires` escrito à menos vale mais que a derivação em
   * `unsupportedReportCapabilities`, e seria o único jeito de o relatório rodar sem o recurso que
   * lhe falta em vez de ser recusado pelo nome dele.
   */
  requires?: string[];
}

const trimmed = (value: string | undefined): string => (value ?? '').trim();

/**
 * Todos os caminhos que o relatório LÊ. Alimenta `projections`, e portanto o plano de hidratação —
 * um caminho que falte aqui chega ao agregador como `undefined`, e vira um grupo vazio silencioso.
 */
export const reportPaths = (spec: ReportSpec): string[] => {
  const paths = new Set<string>();
  const add = (path: string | undefined): void => {
    const value = trimmed(path);
    if (value) paths.add(value);
  };

  for (const predicate of spec.dataset.where ?? []) add(predicate.path);
  // O que a EXPRESSÃO lê é dado que o relatório lê: sem entrar aqui, o caminho não é hidratado (e
  // chega ao avaliador como ausente) nem a coleção que ele atravessa é cobrada de quem lê.
  for (const path of extractFieldExpressionPaths(spec.dataset.includeWhen)) add(path);
  for (const dimension of spec.dataset.dimensions ?? []) add(dimension.path);

  for (const measure of spec.dataset.measures ?? []) {
    if (!isAggregateMeasure(measure)) continue;
    add(measure.path);
    for (const predicate of measure.filter ?? []) add(predicate.path);
  }

  if (spec.shape.kind === 'tabular') {
    for (const order of spec.shape.orderBy ?? []) add(order.path);
  }
  for (const prompt of spec.presentation?.prompts ?? []) add(prompt.path);

  return [...paths];
};

/**
 * Deriva o `QuerySpec` que traz as linhas. Um executor só, um validador só — acrescentar `groupBy` e
 * `measures` ao próprio `QuerySpec` obrigaria cada um dos consumidores dele a responder "e se vier
 * preenchido e eu ignorar?", e a resposta seria um resultado silenciosamente errado.
 *
 * O `limit` É o orçamento de varredura: quem corta o resultado é a agregação, não a consulta. Cortar
 * antes de agregar somaria as primeiras cem linhas e chamaria isso de total.
 */
export const buildReportQuery = (spec: ReportSpec, scanCeiling: number): QuerySpec => {
  const asked = spec.dataset.scanLimit;
  const scan = Number.isFinite(asked) && (asked ?? 0) > 0
    ? Math.min(asked as number, scanCeiling)
    : scanCeiling;

  return {
    table: spec.dataset.table,
    where: spec.dataset.where ?? [],
    orderBy: spec.shape.kind === 'tabular' ? spec.shape.orderBy : undefined,
    limit: scan,
    projections: reportPaths(spec),
  };
};

/**
 * Toda coleção que o relatório TOCA: a fonte, mais o destino de cada hop de FK. É a lista que o RBAC
 * cobra, e é DERIVADA — uma extensão não consegue esconder um hop declarando de menos.
 *
 * Os hops são colhidos mesmo de um caminho que não resolve: a lista de permissões a cobrar nunca
 * pode ser MENOR que a realidade, e um spec inválido é recusado antes de executar de qualquer forma.
 */
export const reportSourceCollections = (spec: ReportSpec, ctx: SchemaContext): string[] => {
  const resolved = resolveQueryTable(spec.dataset.table, ctx);
  if (!resolved) return [];

  const collections = new Set<string>([resolved.physicalCollection]);
  for (const path of reportPaths(spec)) {
    const resolution = resolvePath(ctx, resolved.root, parsePath(path));
    for (const hop of resolution.hops) collections.add(hop.targetCollection);
  }

  return [...collections];
};

/**
 * TODA permissão que ver o relatório exige: a PRÓPRIA (`access.permission`), quando declarada, mais a
 * leitura de cada coleção que ele toca.
 *
 * A própria só RESTRINGE — o guia de autoria promete isso, e nenhum dos quatro lugares que decidem
 * "este relatório é para você?" a cobrava: a callable, o gateway de agente, a lista de Relatórios e o
 * ⌘K montavam cada um a lista de coleções à mão, e a permissão própria não estava em nenhuma das
 * quatro. Uma lista só é o que impede a quinta de nascer sem ela.
 */
export const reportRequiredPermissions = (spec: ReportSpec, ctx: SchemaContext): string[] => {
  const own = spec.access?.permission?.trim();
  return [
    ...(own ? [own] : []),
    ...reportSourceCollections(spec, ctx).map((collection) => collectionPermissionId(collection, 'read')),
  ];
};

/** O detalhamento vale para este relatório? Ligado salvo quando o spec o desliga explicitamente. */
export const reportDrillEnabled = (spec: ReportSpec): boolean =>
  spec.presentation?.drillDown?.enabled !== false;
