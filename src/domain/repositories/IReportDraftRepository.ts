import type { ReportSpec } from '../schema/report/reportSpec';
import type { ReportSpecIssue } from '../schema/report/validateReportSpec';

export interface ReportDraftResult {
  title: string;
  spec: ReportSpec;
  /** O que o validador de sempre disse do spec proposto. */
  issues: ReportSpecIssue[];
}

export interface IReportDraftRepository {
  /** A IA do escritório propõe um relatório a partir da descrição — nada é gravado. */
  draftReport(tenantId: string, description: string): Promise<ReportDraftResult>;
}
