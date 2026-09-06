// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/aggregateRows.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/aggregateRows.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import { applyAggregationOp } from '../aggregationSpec';
import { getValueAtPath, parsePath } from '../pathResolver';
import { matchesResolvedPredicates } from '../predicateMatch';
import type { ResolvedPredicate } from '../predicateMatch';
import { bucketDateValue } from './reportBuckets';
import type { ReportGroupKey, ReportResult, ReportRow, ReportTotals } from './reportResult';
import { isAggregateMeasure, reportGranularityOf } from './reportSpec';
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
  // Medida CALCULADA é prevista no contrato e não executada aqui: quem a declara é recusado antes,
  // pelo nome da capacidade que falta. Devolver `null` é a segunda linha de defesa, nunca a primeira.
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

/** Constrói a árvore de grupos, um nível por `ReportGroupLevel`, na ordem declarada. */
const buildTree = (
  rows: Record<string, unknown>[],
  levels: ReportGroupLevel[],
  dimensions: Map<string, ReportDimension>,
): GroupNode => {
  const root = emptyNode([]);

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

/**
 * Os membros de UM nível, ordenados e cortados pelo `limit` da dimensão.
 *
 * Devolve também o que ficou de FORA, e não é detalhe: o total geral é somado sobre todas as linhas
 * varridas, então um nível cortado mostra linhas que não fecham com o próprio total. Sem este sinal o
 * relatório dizia isso em silêncio — com ele, o corte entra no MESMO aviso de resultado parcial que a
 * varredura já usa, e quem lê sabe que está vendo os primeiros.
 */
const sortedChildren = (
  node: GroupNode,
  level: ReportGroupLevel | undefined,
  dimensions: Map<string, ReportDimension>,
): { shown: GroupNode[]; dropped: boolean } => {
  const children = [...node.children.values()];
  const dimension = level ? dimensions.get(level.dimension) : undefined;
  const direction = dimension?.sort?.dir === 'desc' ? -1 : 1;

  children.sort((left, right) => {
    const a = left.keys[left.keys.length - 1]?.key ?? '';
    const b = right.keys[right.keys.length - 1]?.key ?? '';
    return a.localeCompare(b) * direction;
  });

  const limit = dimension?.limit;
  if (!Number.isFinite(limit) || (limit ?? 0) <= 0) return { shown: children, dropped: false };
  return { shown: children.slice(0, limit), dropped: children.length > (limit as number) };
};

const valuesOf = (
  measures: ReportMeasure[],
  keys: string[],
  rows: Record<string, unknown>[],
  filters: Record<string, ResolvedPredicate[]>,
): Record<string, number | null> => {
  const values: Record<string, number | null> = {};
  for (const key of keys) {
    const measure = measures.find((candidate) => candidate.key === key);
    if (measure) values[key] = measureValue(measure, rows, filters[key] ?? []);
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

    const walk = (node: GroupNode, depth: number): void => {
      const level = sortedChildren(node, levels[depth], dimensions);
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

    const walk = (node: GroupNode, depth: number): void => {
      const level = sortedChildren(node, levels[depth], dimensions);
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
  const collectColumns = (node: GroupNode, depth: number): void => {
    const level = sortedChildren(node, columnLevels[depth], dimensions);
    columnsDropped = columnsDropped || level.dropped;

    for (const child of level.shown) {
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

  const walkRows = (node: GroupNode, depth: number): void => {
    const level = sortedChildren(node, rowLevels[depth], dimensions);
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
          const inCell = child.rows.filter((row) => column.every((entry) => {
            const dimension = dimensions.get(entry.dimension);
            return dimension !== undefined && dimensionKeyOf(row, dimension).key === entry.key;
          }));
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
    const inColumn = rows.filter((row) => column.every((entry) => {
      const dimension = dimensions.get(entry.dimension);
      return dimension !== undefined && dimensionKeyOf(row, dimension).key === entry.key;
    }));
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
