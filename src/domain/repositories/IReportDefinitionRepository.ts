import type { ReportDefinition } from '../entities/Report';
import type { ReportResult } from '../schema/report/reportResult';
import type { ReportSpec } from '../schema/report/reportSpec';
import type { ReportSpecIssue } from '../schema/report/validateReportSpec';

export type ReportDefinitionInput = Omit<
  ReportDefinition,
  'id' | 'tenantId' | 'createdAt' | 'updatedAt'
>;

export interface RunReportInput {
  tenantId: string;
  /** A chave do relatório gravado. Excludente com `spec`. */
  reportId?: string;
  /** O spec CRU — a pré-visualização da autoria. Exige `reports.manage`. */
  spec?: ReportSpec;
  /** Os valores que o leitor preencheu nos filtros declarados. */
  prompts?: Record<string, unknown>;
}

export interface RunReportResult {
  result: ReportResult | null;
  /** Avisos: o que degradou sem impedir o relatório de rodar. */
  issues: ReportSpecIssue[];
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

export interface IReportDefinitionRepository {
  getAll(tenantId: string): Promise<ReportDefinition[]>;
  subscribeToReports(tenantId: string, onUpdate: (reports: ReportDefinition[]) => void): () => void;
  getById(tenantId: string, reportId: string): Promise<ReportDefinition | null>;
  /**
   * `id` é a CHAVE escolhida (`faturamento`), e não um id gerado: é ela que a aba (`rep:<key>`), o
   * deep link e o nó `report` do Widget DSL citam. Ausente, o banco gera um.
   */
  create(tenantId: string, data: ReportDefinitionInput, id?: string): Promise<ReportDefinition>;
  update(tenantId: string, reportId: string, data: Partial<ReportDefinitionInput>): Promise<void>;
  delete(tenantId: string, reportId: string): Promise<void>;
  /**
   * Executa o relatório no SERVIDOR e devolve o agregado.
   *
   * Nunca as linhas: os registros varridos não atravessam a rede, e é lá que a leitura de cada
   * coleção que o relatório toca é cobrada.
   */
  runReport(input: RunReportInput): Promise<RunReportResult>;
}
