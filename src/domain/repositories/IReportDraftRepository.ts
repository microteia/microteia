import type { ReportSpec } from '../schema/report/reportSpec';
import type { ReportSpecIssue } from '../schema/report/validateReportSpec';

export interface ReportDraftResult {
  title: string;
  spec: ReportSpec;
  /** O que o validador de sempre disse do spec proposto. */
  issues: ReportSpecIssue[];
}

/** Se o escritório tem uma IA para propor; sem ela, `reason` é a REFERÊNCIA do motivo. */
export interface ReportDraftAvailability {
  available: boolean;
  reason?: string;
}

export interface IReportDraftRepository {
  /** A IA do escritório propõe um relatório a partir da descrição — nada é gravado. */
  draftReport(tenantId: string, description: string): Promise<ReportDraftResult>;
  /** Pergunta ao servidor se há conexão de IA padrão — sem chamar o modelo. */
  availability(tenantId: string): Promise<ReportDraftAvailability>;
}
