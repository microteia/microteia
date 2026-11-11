// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/aggregateRows.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { applyAggregationOp } from '../aggregationSpec';
import { getValueAtPath, parsePath } from '../pathResolver';
import { matchesResolvedPredicates } from '../predicateMatch';
import type { ResolvedPredicate } from '../predicateMatch';
import { bucketDateValue } from './reportBuckets';
import { computedMeasureReferences, evaluateComputedMeasure, isComputedMeasure } from './reportComputedMeasure';
import type { ReportGroupKey, ReportResult, ReportRow, ReportTotals } from './reportResult';
import { isAggregateMeasure, REPORT_OTHERS_KEY, reportGranularityOf } from './reportSpec';
import type { ReportDimension, ReportGroupLevel, ReportMeasure, ReportSpec } from './reportSpec';

export interface ReportAggregateLimits {
  /** Teto de LINHAS devolvidas — grupos, não registros varridos. */
  maxGroups: number;
  /** Teto de colunas do pivô. Uma dimensão de coluna com 5000 valores derrubaria a tela. */
  maxColumns: number;
  /** Teto de registros do relatório tabular. */
  maxRecords: number;
}

export const DEFAULT_REPORT_AGGREGATE_LIMITS: ReportAggregateLimits = {
  maxGroups: 500,
  maxColumns: 50,
  maxRecords: 500,
};

export interface AggregateReportInput {
  spec: ReportSpec;
  /** As linhas já varridas, hidratadas e materializadas. */
  rows: Record<string, unknown>[];
  /**
   * Os filtros de MEDIDA já resolvidos, por chave de medida.
   *
   * A resolução do `InputMapping` fica com quem tem contexto (a callable, o preview); a comparação
   * fica aqui, pura. É o que permite ao preview da autoria e ao executor devolverem o mesmo número
   * sem duas implementações do agregador.
   */
  measureFilters?: Record<string, ResolvedPredicate[]>;
  scanned?: number;
  complete?: boolean;
  limits?: Partial<ReportAggregateLimits>;
  now?: Date;
}

/** O separador das chaves compostas: fora do alcance de qualquer valor digitado. */
const KEY_SEPARATOR = '\u001f';

/** A chave canônica de uma célula do pivô. Exportada porque o renderizador precisa casar com ela. */
export const reportCellKey = (keys: ReportGroupKey[]): string =>
  keys.map((entry) => entry.key).join(KEY_SEPARATOR);

/** O que um valor ausente vira. Vazio é grupo legítimo — "sem responsável" é uma resposta. */
const EMPTY_KEY = '';

const scalarKey = (value: unknown): string => {
  if (value === null || value === undefined) return EMPTY_KEY;
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map((item) => scalarKey(item)).join(',');
  // O que identifica um REGISTRO apontado é o id dele — e a linha chega HIDRATADA, com o registro
  // inteiro onde o documento guarda o id. Sem isto, toda referência caía na mesma chave,
  // `[object Object]`: um grupo só para apontados diferentes, e uma contagem distinta respondendo 1.
  if (typeof value === 'object' && typeof (value as { id?: unknown }).id === 'string') {
    return (value as { id: string }).id;
  }
  return String(value);
};

/**
 * O REGISTRO como ele atravessa a rede.
 *
 * A resposta da callable é serializada pelo codificador do Firebase, e ele transforma um `Date` em
 * `{}` — `Object.entries` de uma data não tem uma entrada sequer. A coluna de data de uma lista
 * simples chegava à tela como `[object Object]`: a data inteira perdida, e nada na tela dizendo que
 * se perdeu. Aqui ela vira texto ISO, que é o formato que o produto inteiro fala e o único que
 * sobrevive ao `.json`.
 *
 * É na AGREGAÇÃO e não na Cloud Function porque `records` é o que o contrato entrega — a mesma
 * função responde ao executor e à pré-visualização da autoria, e as duas atravessam a mesma rede.
 */
const wireValue = (value: unknown): unknown => {
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(wireValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([key, item]) => [key, wireValue(item)]),
    );
  }
  return value;
};

/**
 * A chave do grupo desta dimensão, nesta linha.
 *
 * Granularidade que não se aplica ao valor (não é data, ou é desconhecida deste kernel) cai no VALOR
 * CRU — nunca num balde diferente. Um mês exibido como dia é uma tabela grande; um mês exibido como
 * trimestre é uma mentira, e o leitor não tem como notar.
 */
const dimensionKeyOf = (row: Record<string, unknown>, dimension: ReportDimension): ReportGroupKey => {
  const raw = getValueAtPath(row, parsePath(dimension.path));
  const granularity = reportGranularityOf(dimension.granularity);

  if (granularity) {
    const bucket = bucketDateValue(raw, granularity, dimension.timeZone);
    if (bucket !== null) return { dimension: dimension.key, key: bucket, label: bucket };
  }

  return { dimension: dimension.key, key: scalarKey(raw) };
};

const measureValue = (
  measure: ReportMeasure,
  rows: Record<string, unknown>[],
  filters: ResolvedPredicate[],
): number | null => {
  // Um `kind` que este kernel não conhece é recusado antes, pelo nome da capacidade que falta.
  // Devolver `null` é a segunda linha de defesa, nunca a primeira.
  if (!isAggregateMeasure(measure)) return null;

  const selected = filters.length > 0
    ? rows.filter((row) => matchesResolvedPredicates(row, filters))
    : rows;

  if (measure.op === 'count') {
    if (!measure.distinct || !measure.path) return selected.length;
    const distinct = new Set<string>();
    for (const row of selected) {
      const value = getValueAtPath(row, parsePath(measure.path));
      if (value !== null && value !== undefined) distinct.add(scalarKey(value));
    }
    return distinct.size;
  }

  if (!measure.path) return null;
  const segments = parsePath(measure.path);
  return applyAggregationOp(measure.op, selected.map((row) => getValueAtPath(row, segments)));
};

interface GroupNode {
  keys: ReportGroupKey[];
  rows: Record<string, unknown>[];
  children: Map<string, GroupNode>;
}

const emptyNode = (keys: ReportGroupKey[]): GroupNode => ({ keys, rows: [], children: new Map() });

/**
 * Constrói a árvore de grupos, um nível por `ReportGroupLevel`, na ordem declarada.
 *
 * `prefix` são as chaves de quem já está acima: é o que deixa o grupo residual ("Outros") ganhar a
 * sua própria subárvore, com as chaves certas, a partir só das linhas que juntou.
 */
const buildTree = (
  rows: Record<string, unknown>[],
  levels: ReportGroupLevel[],
  dimensions: Map<string, ReportDimension>,
  prefix: ReportGroupKey[] = [],
): GroupNode => {
  const root = emptyNode(prefix);

  for (const row of rows) {
    let node = root;
    node.rows.push(row);

    for (const level of levels) {
      const dimension = dimensions.get(level.dimension);
      if (!dimension) break;

      const key = dimensionKeyOf(row, dimension);
      const existing = node.children.get(key.key);
      const child = existing ?? emptyNode([...node.keys, key]);
      if (!existing) node.children.set(key.key, child);
      child.rows.push(row);
      node = child;
    }
  }

  return root;
};

/** O que ordenar e cortar um nível precisa saber além dele mesmo. */
interface LevelContext {
  dimensions: Map<string, ReportDimension>;
  measures: ReportMeasure[];
  filters: Record<string, ResolvedPredicate[]>;
  /** Os níveis da árvore inteira — o grupo residual precisa dos que vêm abaixo dele. */
  levels: ReportGroupLevel[];
}

const lastKey = (node: GroupNode): string => node.keys[node.keys.length - 1]?.key ?? '';

/**
 * Os membros de UM nível, ordenados e cortados pelo `limit` da dimensão.
 *
 * Devolve também se algo ficou de FORA, e não é detalhe: o total geral é somado sobre todas as linhas
 * varridas, então um nível cortado mostra linhas que não fecham com o próprio total. Sem este sinal o
 * relatório dizia isso em silêncio — com ele, o corte entra no MESMO aviso de resultado parcial que a
 * varredura já usa, e quem lê sabe que está vendo os primeiros.
 *
 * Com `others`, o que ficou de fora vira UM grupo residual e nada se perde: as linhas visíveis fecham
 * com o total, e o resultado não é parcial.
 *
 * A ordem por MEDIDA é o Top N. O grupo sem valor naquela medida vai para o fim nos dois sentidos —
 * "maiores primeiro" que abrisse com quem não tem número seria uma lista de vazios.
 */
const sortedChildren = (
  node: GroupNode,
  depth: number,
  ctx: LevelContext,
): { shown: GroupNode[]; dropped: boolean } => {
  const children = [...node.children.values()];
  const level = ctx.levels[depth];
  const dimension = level ? ctx.dimensions.get(level.dimension) : undefined;
  const direction = dimension?.sort?.dir === 'desc' ? -1 : 1;
  const by = dimension?.sort?.by;
  const byMeasure = by !== undefined && ctx.measures.some((measure) => measure.key === by)
    ? by
    : undefined;

  if (byMeasure) {
    const score = new Map(children.map((child) => [
      child,
      valuesOf(ctx.measures, [byMeasure], child.rows, ctx.filters)[byMeasure] ?? null,
    ] as const));
    children.sort((left, right) => {
      const a = score.get(left) ?? null;
      const b = score.get(right) ?? null;
      if (a === null && b === null) return lastKey(left).localeCompare(lastKey(right));
      if (a === null) return 1;
      if (b === null) return -1;
      return (a - b) * direction || lastKey(left).localeCompare(lastKey(right));
    });
  } else {
    children.sort((left, right) => lastKey(left).localeCompare(lastKey(right)) * direction);
  }

  const limit = dimension?.limit;
  if (!dimension || !Number.isFinite(limit) || (limit ?? 0) <= 0 || children.length <= (limit as number)) {
    return { shown: children, dropped: false };
  }

  const shown = children.slice(0, limit);
  if (dimension.others !== true) return { shown, dropped: true };

  const rest = children.slice(limit);
  const residualKeys = [...node.keys, { dimension: dimension.key, key: REPORT_OTHERS_KEY }];
  const residualRows = rest.flatMap((child) => child.rows);
  const residual = buildTree(residualRows, ctx.levels.slice(depth + 1), ctx.dimensions, residualKeys);
  residual.rows = residualRows;
  return { shown: [...shown, residual], dropped: false };
};

/**
 * A linha pertence ao membro? O residual não tem valor próprio: pertence a ele quem NÃO é nenhum dos
 * membros mostrados daquele nível — é a única forma de a célula "Outros" de um pivô somar alguma coisa.
 */
const belongsTo = (
  row: Record<string, unknown>,
  entry: ReportGroupKey,
  dimensions: Map<string, ReportDimension>,
  shownKeys: Map<string, Set<string>>,
): boolean => {
  const dimension = dimensions.get(entry.dimension);
  if (!dimension) return false;
  const key = dimensionKeyOf(row, dimension).key;
  if (entry.key === REPORT_OTHERS_KEY) return !(shownKeys.get(entry.dimension)?.has(key) ?? false);
  return key === entry.key;
};

/**
 * Os valores das medidas pedidas, sobre as linhas de UM grupo.
 *
 * A medida calculada lê as medidas que cita no MESMO grupo — inclusive as que a dobra não exibe: uma
 * taxa de êxito precisa do total de casos sem que a coluna dele apareça. Por isso o valor de cada
 * medida é resolvido sob demanda e lembrado, e só as pedidas saem no resultado.
 */
const valuesOf = (
  measures: ReportMeasure[],
  keys: string[],
  rows: Record<string, unknown>[],
  filters: Record<string, ResolvedPredicate[]>,
): Record<string, number | null> => {
  const byKey = new Map(measures.map((measure) => [measure.key, measure] as const));
  const resolved = new Map<string, number | null>();
  const resolving = new Set<string>();

  const valueOf = (key: string): number | null => {
    if (resolved.has(key)) return resolved.get(key) ?? null;
    const measure = byKey.get(key);
    if (!measure || resolving.has(key)) return null;

    resolving.add(key);
    const value = isComputedMeasure(measure)
      ? evaluateComputedMeasure(measure, Object.fromEntries(
        computedMeasureReferences(measure).map((reference) => [reference, valueOf(reference)]),
      ))
      : measureValue(measure, rows, filters[key] ?? []);
    resolving.delete(key);
    resolved.set(key, value);
    return value;
  };

  const values: Record<string, number | null> = {};
  for (const key of keys) {
    if (byKey.has(key)) values[key] = valueOf(key);
  }
  return values;
};

const totalsOf = (
  measures: ReportMeasure[],
  keys: string[],
  rows: Record<string, unknown>[],
  filters: Record<string, ResolvedPredicate[]>,
): ReportTotals => ({
  values: valuesOf(measures, keys, rows, filters),
  count: rows.length,
});

/**
 * Agrega as linhas varridas no resultado que a tela, o CSV e a impressão consomem.
 *
 * É FUNÇÃO PURA, e fora da Cloud Function de propósito: é o que faz o preview da autoria devolver
 * exatamente o número que o executor devolve, e o que deixa um executor paginado de amanhã reusá-la
 * sem mudar o nome nem a forma da callable.
 */
export const aggregateReportRows = (input: AggregateReportInput): ReportResult => {
  const { spec, rows } = input;
  const limits = { ...DEFAULT_REPORT_AGGREGATE_LIMITS, ...input.limits };
  const filters = input.measureFilters ?? {};
  const measures = spec.dataset.measures ?? [];
  const dimensions = new Map((spec.dataset.dimensions ?? []).map((one) => [one.key, one]));
  const contextOf = (levels: ReportGroupLevel[]): LevelContext => ({ dimensions, measures, filters, levels });

  const base = {
    shape: spec.shape.kind,
    scanned: input.scanned ?? rows.length,
    complete: input.complete ?? true,
    generatedAt: (input.now ?? new Date()).toISOString(),
  };

  if (spec.shape.kind === 'tabular') {
    const measureKeys = measures.map((measure) => measure.key);
    const levels = spec.shape.groupBy ?? [];
    const totals = measureKeys.length > 0 ? totalsOf(measures, measureKeys, rows, filters) : null;

    if (levels.length === 0) {
      return {
        ...base,
        columns: [],
        rows: [],
        records: rows.slice(0, limits.maxRecords).map((row) => wireValue(row) as Record<string, unknown>),
        totals,
        completeGroups: rows.length <= limits.maxRecords,
      };
    }

    /*
     * A LISTA AGRUPADA devolve as duas coisas: a árvore de grupos e, na folha de cada um, os
     * registros dele.
     *
     * O teto de registros é do RELATÓRIO, não do grupo: gastá-lo por grupo deixaria um relatório de
     * duzentos grupos devolver cem mil linhas. Quem esgota o teto marca o resultado como parcial, no
     * mesmo aviso que a varredura já usa — o grupo seguinte aparece sem detalhe, e isso precisa ser
     * dito em vez de parecer um grupo vazio.
     */
    const tree = buildTree(rows, levels, dimensions);
    const emitted: ReportRow[] = [];
    let truncated = false;
    let taken = 0;
    const ctx = contextOf(levels);

    const walk = (node: GroupNode, depth: number): void => {
      const level = sortedChildren(node, depth, ctx);
      truncated = truncated || level.dropped;

      for (const child of level.shown) {
        if (emitted.length >= limits.maxGroups) {
          truncated = true;
          return;
        }

        const leaf = depth === levels.length - 1;
        const shown = leaf
          ? child.rows.slice(0, Math.max(0, limits.maxRecords - taken))
          : [];
        if (leaf) {
          taken += shown.length;
          truncated = truncated || shown.length < child.rows.length;
        }

        emitted.push({
          keys: child.keys,
          values: valuesOf(measures, measureKeys, child.rows, filters),
          count: child.rows.length,
          level: depth,
          ...(leaf ? { records: shown.map((row) => wireValue(row) as Record<string, unknown>) } : {}),
        });
        if (!leaf) walk(child, depth + 1);
      }
    };

    walk(tree, 0);

    return {
      ...base,
      columns: [],
      rows: emitted,
      totals,
      completeGroups: !truncated,
    };
  }

  const wantsTotal = spec.shape.grandTotal !== false;
  const values = spec.shape.values;

  if (spec.shape.kind === 'summary') {
    const levels = spec.shape.groupBy;
    const tree = buildTree(rows, levels, dimensions);
    const emitted: ReportRow[] = [];
    let truncated = false;
    const ctx = contextOf(levels);

    const walk = (node: GroupNode, depth: number): void => {
      const level = sortedChildren(node, depth, ctx);
      truncated = truncated || level.dropped;

      for (const child of level.shown) {
        if (emitted.length >= limits.maxGroups) {
          truncated = true;
          return;
        }

        const leaf = depth === levels.length - 1;
        if (leaf || levels[depth]?.subtotal === true) {
          emitted.push({
            keys: child.keys,
            values: valuesOf(measures, values, child.rows, filters),
            count: child.rows.length,
            level: depth,
            ...(leaf ? {} : { subtotal: true }),
          });
        }
        if (!leaf) walk(child, depth + 1);
      }
    };

    walk(tree, 0);

    return {
      ...base,
      columns: [],
      rows: emitted,
      totals: wantsTotal ? totalsOf(measures, values, rows, filters) : null,
      completeGroups: !truncated,
    };
  }

  const rowLevels = spec.shape.rows;
  const columnLevels = spec.shape.columns;

  const columnTree = buildTree(rows, columnLevels, dimensions);
  const columnPaths: ReportGroupKey[][] = [];
  let columnsDropped = false;
  const columnCtx = contextOf(columnLevels);
  // Os membros MOSTRADOS de cada dimensão de coluna — é contra eles que a coluna "Outros" se define.
  const shownColumnKeys = new Map<string, Set<string>>();
  const collectColumns = (node: GroupNode, depth: number): void => {
    const level = sortedChildren(node, depth, columnCtx);
    columnsDropped = columnsDropped || level.dropped;

    for (const child of level.shown) {
      const entry = child.keys[child.keys.length - 1];
      if (entry && entry.key !== REPORT_OTHERS_KEY) {
        const known = shownColumnKeys.get(entry.dimension) ?? new Set<string>();
        known.add(entry.key);
        shownColumnKeys.set(entry.dimension, known);
      }
      if (depth === columnLevels.length - 1) columnPaths.push(child.keys);
      else collectColumns(child, depth + 1);
    }
  };
  collectColumns(columnTree, 0);

  const columns = columnPaths.slice(0, limits.maxColumns);
  const columnsTruncated = columnsDropped || columnPaths.length > columns.length;

  const rowTree = buildTree(rows, rowLevels, dimensions);
  const emitted: ReportRow[] = [];
  let rowsTruncated = false;
  const rowCtx = contextOf(rowLevels);

  const walkRows = (node: GroupNode, depth: number): void => {
    const level = sortedChildren(node, depth, rowCtx);
    rowsTruncated = rowsTruncated || level.dropped;

    for (const child of level.shown) {
      if (emitted.length >= limits.maxGroups) {
        rowsTruncated = true;
        return;
      }

      const leaf = depth === rowLevels.length - 1;
      if (leaf || rowLevels[depth]?.subtotal === true) {
        const cells: Record<string, Record<string, number | null>> = {};
        for (const column of columns) {
          const inCell = child.rows.filter((row) => column.every((entry) =>
            belongsTo(row, entry, dimensions, shownColumnKeys)));
          cells[reportCellKey(column)] = valuesOf(measures, values, inCell, filters);
        }

        emitted.push({
          keys: child.keys,
          values: valuesOf(measures, values, child.rows, filters),
          cells,
          count: child.rows.length,
          level: depth,
          ...(leaf ? {} : { subtotal: true }),
        });
      }
      if (!leaf) walkRows(child, depth + 1);
    }
  };

  walkRows(rowTree, 0);

  const columnTotals: Record<string, Record<string, number | null>> = {};
  for (const column of columns) {
    const inColumn = rows.filter((row) => column.every((entry) =>
      belongsTo(row, entry, dimensions, shownColumnKeys)));
    columnTotals[reportCellKey(column)] = valuesOf(measures, values, inColumn, filters);
  }

  return {
    ...base,
    columns,
    rows: emitted,
    totals: wantsTotal ? totalsOf(measures, values, rows, filters) : null,
    columnTotals: wantsTotal ? columnTotals : undefined,
    completeGroups: !rowsTruncated && !columnsTruncated,
  };
};
