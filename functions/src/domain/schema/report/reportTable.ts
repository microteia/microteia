// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportTable.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportTable.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { ReportCsvTable } from './reportCsv';
import type { ReportGroupKey, ReportResult } from './reportResult';
import type { ReportDimension, ReportSpec, ReportValueFormat } from './reportSpec';
import { reportCellKey } from './aggregateRows';

/**
 * O rótulo de uma coluna ou de um número, resolvido pela regra de sempre: `@ns/chave` traduz, o que
 * o escritório digitou passa INTACTO. Na ausência de rótulo, a chave é o nome — é o que a autoria
 * mostra enquanto ninguém escreveu um.
 */
export const columnLabel = (
  declared: string | undefined,
  fallback: string,
  label: (value: string | null | undefined) => string,
): string => (declared ? label(declared) : fallback);

/** As medidas exibidas pela dobra, na ordem, com o formato que cada uma declara. */
export const shownMeasures = (spec: ReportSpec): { key: string; label?: string; format?: ReportValueFormat }[] => {
  const declared = spec.dataset.measures ?? [];
  const keys = spec.shape.kind === 'tabular'
    ? declared.map((measure) => measure.key)
    : spec.shape.values;

  return keys
    .map((key) => declared.find((measure) => measure.key === key))
    .filter((measure): measure is NonNullable<typeof measure> => measure !== undefined)
    .map((measure) => ({ key: measure.key, label: measure.label, format: measure.format }));
};

/** As dimensões que a dobra agrupa nas LINHAS, na ordem dos níveis. */
export const rowDimensions = (spec: ReportSpec): ReportDimension[] => {
  const declared = spec.dataset.dimensions ?? [];
  const keys = spec.shape.kind === 'summary'
    ? spec.shape.groupBy.map((level) => level.dimension)
    : (spec.shape.kind === 'matrix' ? spec.shape.rows.map((level) => level.dimension) : spec.shape.columns);

  return keys
    .map((key) => declared.find((dimension) => dimension.key === key))
    .filter((dimension): dimension is ReportDimension => dimension !== undefined);
};

/**
 * As dimensões que QUEBRAM a lista em grupos, na ordem dos níveis. Vazio em toda outra dobra.
 *
 * Separada de `rowDimensions` de propósito: na lista agrupada as duas respondem coisas diferentes —
 * uma é o que cada linha MOSTRA, a outra é o que as REÚNE —, e foi confundir as duas que fazia cada
 * campo virar um nível de recuo em vez de uma coluna.
 */
export const groupDimensions = (spec: ReportSpec): ReportDimension[] => {
  if (spec.shape.kind !== 'tabular') return [];
  const declared = spec.dataset.dimensions ?? [];

  return (spec.shape.groupBy ?? [])
    .map((level) => declared.find((dimension) => dimension.key === level.dimension))
    .filter((dimension): dimension is ReportDimension => dimension !== undefined);
};

/**
 * Como cada pedaço da tabela vira TEXTO — e é só isto que muda entre a tela e o servidor. A tela traduz
 * um grupo pela listagem do escritório; o servidor, pelas mesmas fontes que a busca de registros usa.
 * O número sai cru para a planilha e formatado para o PDF, pelo mesmo motivo do CSV: a planilha soma o
 * cru, e quem lê o papel lê o formatado.
 */
export interface ReportTableText {
  label: (value: string | null | undefined) => string;
  group: (entry: ReportGroupKey | undefined) => string;
  cell: (record: Record<string, unknown>, dimension: ReportDimension) => string;
  number: (value: number | null | undefined, format: ReportValueFormat | undefined) => string;
  total: string;
  /** O aviso de PARCIAL, dito no próprio arquivo — ele viaja por e-mail e sobrevive à tela. */
  partial: (scanned: number) => string;
}

/**
 * O relatório como TABELA de arquivo: cabeçalho, linhas, total e o aviso de parcial. Uma função só para
 * o botão "Exportar" e para o arquivo que uma automação gera — o que um e outro mostram não pode divergir.
 */
export const buildReportTable = (spec: ReportSpec, result: ReportResult, text: ReportTableText): ReportCsvTable => {
  const measures = shownMeasures(spec);
  const dimensions = rowDimensions(spec);
  const dimensionLabels = dimensions.map((dimension) => columnLabel(dimension.label, dimension.key, text.label));

  const header: string[] = [];
  const rows: string[][] = [];
  let totals: string[] | undefined;
  let totalsHeader: string[] | undefined;

  if (spec.shape.kind === 'tabular') {
    /*
     * A lista AGRUPADA vira arquivo PLANO: o valor do grupo repetido em cada linha, numa coluna própria à
     * frente das outras. Uma faixa de grupo e um subtotal no meio do arquivo quebrariam o `SOMA` de
     * qualquer coluna abaixo dele; repetido, o grupo é o que uma tabela dinâmica reagrupa.
     */
    const groups = groupDimensions(spec);
    header.push(...groups.map((dimension) => columnLabel(dimension.label, dimension.key, text.label)), ...dimensionLabels);

    if (groups.length > 0) {
      for (const row of result.rows) {
        const prefix = row.keys.map((entry) => text.group(entry));
        for (const record of row.records ?? []) {
          rows.push([...prefix, ...dimensions.map((dimension) => text.cell(record, dimension))]);
        }
      }
    } else {
      for (const record of result.records ?? []) {
        rows.push(dimensions.map((dimension) => text.cell(record, dimension)));
      }
    }

    if (result.totals && measures.length > 0) {
      // Bloco à parte: o corpo tem as colunas do registro, o total tem as das medidas.
      totalsHeader = ['', ...measures.map((measure) => columnLabel(measure.label, measure.key, text.label))];
      totals = [text.total, ...measures.map((measure) => text.number(result.totals?.values[measure.key], measure.format))];
    }
  } else if (spec.shape.kind === 'matrix') {
    header.push(dimensionLabels.join(' / '));
    for (const column of result.columns) {
      const columnName = column.map((entry) => text.group(entry)).join(' / ');
      for (const measure of measures) {
        header.push(measures.length > 1
          ? [columnName, columnLabel(measure.label, measure.key, text.label)].join(' — ')
          : columnName);
      }
    }
    for (const row of result.rows) {
      rows.push([
        text.group(row.keys[row.keys.length - 1]),
        ...result.columns.flatMap((column) => measures.map((measure) =>
          text.number(row.cells?.[reportCellKey(column)]?.[measure.key], measure.format))),
      ]);
    }
    if (result.columnTotals) {
      totals = [
        text.total,
        ...result.columns.flatMap((column) => measures.map((measure) =>
          text.number(result.columnTotals?.[reportCellKey(column)]?.[measure.key], measure.format))),
      ];
    }
  } else {
    header.push(dimensionLabels.join(' / '));
    header.push(...measures.map((measure) => columnLabel(measure.label, measure.key, text.label)));
    for (const row of result.rows) {
      rows.push([
        text.group(row.keys[row.keys.length - 1]),
        ...measures.map((measure) => text.number(row.values[measure.key], measure.format)),
      ]);
    }
    if (result.totals) {
      totals = [text.total, ...measures.map((measure) => text.number(result.totals?.values[measure.key], measure.format))];
    }
  }

  return {
    header,
    rows,
    ...(totals ? { totals } : {}),
    ...(totalsHeader ? { totalsHeader } : {}),
    ...(result.complete && result.completeGroups ? {} : { notice: text.partial(result.scanned) }),
  };
};
