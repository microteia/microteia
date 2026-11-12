import type { ReportSpec } from '../schema/report/reportSpec';

export interface StoredReport {
  id: string;
  key: string;
  title: string;
  spec: ReportSpec;
}

/**
 * Lê um relatório do escritório pelo endereço que um passo grava.
 *
 * Aceita a CHAVE (o `rep:<key>` estável, que sobrevive a reinstalar a extensão dona) e o id do
 * documento, nessa ordem de preferência — é a mesma tolerância do `getReport` da tela.
 */
export interface IReportDefinitionReader {
  find(tenantId: string, keyOrId: string): Promise<StoredReport | null>;
}
