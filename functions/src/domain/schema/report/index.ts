// ═══════════════════════════════════════════════════════════════════════════
// ⚠️  ARQUIVO GERADO POR scripts/sync-schemas.cjs — NÃO EDITE.
// Fonte única: src/domain/schema/report/index.ts
// Para alterar, edite a fonte e rode: npm run sync-schemas
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════════
// FONTE ÚNICA — a cópia em functions/src/domain/schema/report/index.ts é
// GERADA por scripts/sync-schemas.cjs (npm run sync-schemas). Nunca edite a cópia.
// ═══════════════════════════════════════════════════════════════════════════════

export {
  DEFAULT_REPORT_DATASET_KIND,
  REPORT_CHART_KINDS,
  REPORT_DATASET_KINDS,
  REPORT_GRANULARITIES,
  REPORT_SHAPE_KINDS,
  REPORT_SPEC_VERSION,
  buildReportQuery,
  isAggregateMeasure,
  reportGranularityOf,
  reportPaths,
  reportSourceCollections,
} from './reportSpec';
export type {
  ReportAccess,
  ReportAggregateMeasure,
  ReportChart,
  ReportChartKind,
  ReportComputedMeasure,
  ReportDataset,
  ReportDatasetKind,
  ReportDimension,
  ReportFieldPresentation,
  ReportGranularity,
  ReportGroupLevel,
  ReportMatrixShape,
  ReportMeasure,
  ReportPresentation,
  ReportPrompt,
  ReportSchedule,
  ReportShape,
  ReportShapeKind,
  ReportSpec,
  ReportSummaryShape,
  ReportTabularShape,
  ReportValueFormat,
} from './reportSpec';

export { REPORT_CAPABILITIES, deriveReportRequires, unsupportedReportCapabilities } from './reportCapabilities';

export { bucketDateValue } from './reportBuckets';

export { reportCsvFileName, reportResultToCsv } from './reportCsv';
export type { ReportCsvTable } from './reportCsv';

export type { ReportGroupKey, ReportResult, ReportRow, ReportTotals } from './reportResult';

export {
  DEFAULT_REPORT_AGGREGATE_LIMITS,
  aggregateReportRows,
  reportCellKey,
} from './aggregateRows';
export type { AggregateReportInput, ReportAggregateLimits } from './aggregateRows';

export { filterReportRows, reportRowScope } from './reportRowFilter';
export type { ReportRowFilterInput, ReportRowFilterOutcome } from './reportRowFilter';

export { hasBlockingReportIssue, validateReportSpec, validateReportSpecShape } from './validateReportSpec';
export type { ReportSpecIssue, ReportValidationContext } from './validateReportSpec';

export {
  REPORT_API_VERSION,
  REPORT_DEFINITION_POINT,
  REPORT_EXTENSION_POINTS,
  reportContribution,
  reportOf,
} from './reportExtensionPoints';
export type { ReportContributionMetadata } from './reportExtensionPoints';
