// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/reportSnapshot.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/reportSnapshot.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

import type { FieldDefinition } from '../../entities/entitySchemas';
import { contentFingerprint } from '../contentFingerprint';
import type { SchemaContext, SchemaScreen } from '../screenEntity';
import { REPORT_SNAPSHOT_DATASET_KIND, reportRequiredPermissions } from './reportSpec';
import type { ReportSpec } from './reportSpec';

/**
 * O INSTANTÂNEO de um relatório — a foto do resultado, tirada por uma automação, para virar série.
 *
 * O relatório responde "como está agora": o registro é sobrescrito, e o "aberto" de ontem deixa de existir
 * quando o chamado fecha. A foto guarda o RESULTADO (grupos e totais, nunca registros) com a data em que foi
 * tirada, e a série de fotos é FONTE de outro relatório (`dataset.kind: 'snapshot'`, `dataset.table` = a
 * chave do relatório de origem). Cada foto vira linhas — uma por grupo, com `takenAt` —, e a partir daí é
 * o mesmo agregador, os mesmos filtros e os mesmos gráficos de qualquer relatório.
 *
 * A série não é retroativa: começa na primeira foto. E reflete o que a automação que a tirou podia ver,
 * não o que quem lê a série vê hoje — por isso só a lê quem pode ler o relatório de origem.
 */
export const REPORT_SNAPSHOTS_COLLECTION = 'report_snapshots';
export { REPORT_SNAPSHOT_DATASET_KIND };

/** O kernel a partir do qual o passo tira a foto e o relatório lê a série. */
export const REPORT_SNAPSHOTS_SINCE_KERNEL = '2.124.0';

/** Grupos guardados por foto. A foto é UM documento, e um relatório de milhares de grupos não é série. */
export const REPORT_SNAPSHOT_MAX_GROUPS = 500;
/** Fotos lidas por execução da série: dez anos de fotos semanais. As mais recentes. */
export const REPORT_SNAPSHOT_MAX_SERIES = 520;
/** Retenção: a foto expira depois disso (TTL do Firestore sobre `expiresAt`). */
export const REPORT_SNAPSHOT_RETENTION_YEARS = 5;

/** As colunas que toda linha da série tem, além das dimensões e medidas do relatório de origem. */
export const REPORT_SNAPSHOT_TAKEN_AT = 'takenAt';
export const REPORT_SNAPSHOT_COUNT = 'count';

export interface ReportSnapshot {
  id: string;
  /** A CHAVE do relatório de origem — a mesma do `rep:<key>`. */
  report: string;
  takenAt: Date;
  /** Identifica a DEFINIÇÃO do relatório no momento da foto (`reportSnapshotDefinition`). */
  definition: string;
  /** Uma linha por grupo do nível mais fundo: a chave de cada dimensão, cada medida e `count`. */
  rows: Record<string, unknown>[];
  totals: Record<string, number | null>;
  count: number;
  /** O relatório de origem varreu tudo e não cortou grupos. */
  complete: boolean;
  /** Os grupos passaram de `REPORT_SNAPSHOT_MAX_GROUPS` e a foto guardou só os primeiros. */
  truncated: boolean;
  /** Quem tirou: a pessoa por trás da automação, ou `null` para o motor sozinho. */
  takenBy: string | null;
  expiresAt: Date;
}

export const isSnapshotReport = (spec: ReportSpec): boolean => spec.dataset.kind === REPORT_SNAPSHOT_DATASET_KIND;

/**
 * Uma foto só tem sentido sobre um resultado AGREGADO. A lista simples (registro por linha) guardaria
 * registros — e a foto existe justamente para não guardá-los —; a série sobre série é um eco da primeira.
 */
export const snapshotRefusal = (spec: ReportSpec): string | null => {
  if (isSnapshotReport(spec)) return '@core.reports/snapshot.of-series';
  if (spec.shape.kind === 'tabular') return '@core.reports/snapshot.tabular';
  return null;
};

/**
 * O que define o NÚMERO do relatório: o que se conta, como se agrupa e o que se filtra. A apresentação fica
 * de fora — trocar a cor do gráfico não quebra a série; renomear uma dimensão, sim.
 */
export const reportSnapshotDefinition = (spec: ReportSpec): string => contentFingerprint({
  table: spec.dataset.table,
  where: spec.dataset.where ?? [],
  includeWhen: spec.dataset.includeWhen ?? '',
  related: spec.dataset.related ?? [],
  dimensions: (spec.dataset.dimensions ?? []).map((one) => ({
    key: one.key, path: one.path, expression: one.expression, buckets: one.buckets, granularity: one.granularity, timeZone: one.timeZone,
  })),
  measures: spec.dataset.measures ?? [],
});

/** A tabela SINTÉTICA da série de um relatório — o nome com que a série entra no esquema. */
export const snapshotSeriesTable = (reportKey: string): string => `${REPORT_SNAPSHOT_DATASET_KIND}:${reportKey}`;

/**
 * A tela sintética da série: `takenAt` (data), as dimensões do relatório de origem e as medidas dele
 * (número), mais `count`. A dimensão que é um CAMPO da coleção de origem herda a definição dele — a lista de
 * opções, a referência —, para que o grupo apareça pelo rótulo e não pela chave crua; a calculada, a com
 * faixas e a com balde de data guardam texto.
 */
export const snapshotSchemaScreen = (
  reportKey: string,
  source: ReportSpec,
  title: string,
  ctx: SchemaContext,
): SchemaScreen => {
  const table = snapshotSeriesTable(reportKey);
  const sourceFields = ctx.screens.get(source.dataset.table)?.fields ?? [];
  const reserved = new Set([REPORT_SNAPSHOT_TAKEN_AT, REPORT_SNAPSHOT_COUNT]);
  const fields: FieldDefinition[] = [
    { key: REPORT_SNAPSHOT_TAKEN_AT, label: '@core.reports/snapshot.field.taken-at', type: 'date', required: true, order: 0, origin: 'builtin' },
  ];
  for (const dimension of source.dataset.dimensions ?? []) {
    if (reserved.has(dimension.key)) continue;
    const plain = !dimension.expression && !dimension.buckets && !dimension.granularity && !dimension.path.includes('.');
    const field = plain ? sourceFields.find((one) => one.key === dimension.path) : undefined;
    fields.push({
      ...(field ?? {}),
      key: dimension.key,
      label: dimension.label || field?.label || dimension.key,
      type: field?.type ?? 'text',
      required: false,
      order: fields.length,
      origin: 'builtin',
    });
  }
  for (const measure of source.dataset.measures ?? []) {
    if (reserved.has(measure.key)) continue;
    fields.push({ key: measure.key, label: measure.label || measure.key, type: 'number', required: false, order: fields.length, origin: 'builtin' });
  }
  fields.push({ key: REPORT_SNAPSHOT_COUNT, label: '@core.reports/snapshot.field.count', type: 'number', required: false, order: fields.length, origin: 'builtin' });
  return { id: table, collection: table, titleSingular: title, titlePlural: title, titleFieldKey: REPORT_SNAPSHOT_TAKEN_AT, fields };
};

/** O esquema com a série do relatório de origem — é contra ele que o relatório da série é validado. */
export const snapshotSchemaContext = (
  ctx: SchemaContext,
  reportKey: string,
  source: ReportSpec,
  title: string,
): SchemaContext => {
  const screen = snapshotSchemaScreen(reportKey, source, title, ctx);
  return { ...ctx, screens: new Map([...ctx.screens, [screen.collection ?? screen.id, screen]]) };
};

/**
 * O relatório da série visto como relatório de COLEÇÃO — a coleção sintética. É essa vista que passa pela
 * validação, pelo filtro e pelo agregador de sempre: nenhum deles precisa saber que as linhas são fotos.
 */
export const snapshotReportView = (spec: ReportSpec): ReportSpec => (isSnapshotReport(spec)
  ? { ...spec, dataset: { ...spec.dataset, kind: undefined, table: snapshotSeriesTable(spec.dataset.table) } }
  : spec);

/** As linhas de uma foto, prontas para a gravação: só os grupos, até o teto. */
export const snapshotRowsOf = (rows: readonly Record<string, unknown>[]): { rows: Record<string, unknown>[]; truncated: boolean } => ({
  rows: rows.slice(0, REPORT_SNAPSHOT_MAX_GROUPS).map((row) => ({ ...row })),
  truncated: rows.length > REPORT_SNAPSHOT_MAX_GROUPS,
});

/** Cada foto vira linhas da série, com a data dela. A data da foto vence uma dimensão de mesmo nome. */
export const snapshotSeriesRows = (snapshots: readonly ReportSnapshot[]): Record<string, unknown>[] =>
  snapshots.flatMap((snapshot) => snapshot.rows.map((row, index) => ({
    ...row,
    id: `${snapshot.id}:${index}`,
    [REPORT_SNAPSHOT_TAKEN_AT]: snapshot.takenAt,
  })));

/** O que a tela diz sobre a série: quantas fotos, de quando a quando, e se a definição mudou no meio. */
export interface ReportSeriesInfo {
  snapshots: number;
  first: string | null;
  last: string | null;
  definitionChanged: boolean;
  /** Alguma foto foi tirada de um resultado parcial ou cortado. */
  partial: boolean;
}

export const reportSeriesInfo = (snapshots: readonly ReportSnapshot[]): ReportSeriesInfo => {
  const times = snapshots.map((one) => one.takenAt.getTime()).sort((a, b) => a - b);
  return {
    snapshots: snapshots.length,
    first: times.length > 0 ? new Date(times[0]).toISOString() : null,
    last: times.length > 0 ? new Date(times[times.length - 1]).toISOString() : null,
    definitionChanged: new Set(snapshots.map((one) => one.definition)).size > 1,
    partial: snapshots.some((one) => !one.complete || one.truncated),
  };
};

/**
 * TODA permissão que ler o relatório exige, já com a da série: quem lê a série precisa poder ler o relatório
 * de ORIGEM — a foto foi tirada com a visão da automação, e contar o que a origem esconde seria vazar por
 * outra porta. `null` quando a série não tem origem: falha FECHADA, quem chama recusa.
 */
export const reportAccessPermissions = (
  spec: ReportSpec,
  ctx: SchemaContext,
  source: ReportSpec | null | undefined,
): string[] | null => {
  if (!isSnapshotReport(spec)) return reportRequiredPermissions(spec, ctx);
  if (!source || isSnapshotReport(source)) return null;
  const own = spec.access?.permission?.trim();
  return [...new Set([...(own ? [own] : []), ...reportRequiredPermissions(source, ctx)])];
};

/** Um relatório que pode ser ORIGEM de uma série — o que a tela tem à mão de cada um. */
export interface SnapshotSourceReport {
  key: string;
  title: string;
  spec: ReportSpec;
}

/**
 * O esquema e a tabela com que um relatório é LIDO: os de sempre, ou — na série — o esquema com a coleção
 * sintética das fotos e o nome dela. É o que deixa os rótulos, os filtros e a autoria tratarem a série
 * como uma coleção qualquer. Sem a origem à mão, fica o esquema de sempre: a tabela não resolve, e a
 * validação diz por quê.
 */
export const reportSchemaOf = (
  spec: ReportSpec | null | undefined,
  ctx: SchemaContext,
  sources: readonly SnapshotSourceReport[],
): { ctx: SchemaContext; table: string } => {
  if (!spec) return { ctx, table: '' };
  if (!isSnapshotReport(spec)) return { ctx, table: spec.dataset.table };
  const source = sources.find((one) => one.key === spec.dataset.table);
  if (!source || isSnapshotReport(source.spec)) return { ctx, table: spec.dataset.table };
  return {
    ctx: snapshotSchemaContext(ctx, source.key, source.spec, source.title),
    table: snapshotSeriesTable(source.key),
  };
};

/**
 * O relatório de origem de uma série, numa lista de relatórios da tela. Só os do ESCRITÓRIO: o servidor lê
 * a origem entre eles, e um pessoal com a mesma chave não pode emprestar as permissões dele à série.
 */
export const snapshotSourceSpec = (
  spec: ReportSpec,
  reports: readonly { key: string; spec: ReportSpec; ownerId?: string | null }[],
): ReportSpec | undefined => (isSnapshotReport(spec)
  ? reports.find((one) => !one.ownerId && one.key === spec.dataset.table)?.spec
  : undefined);
