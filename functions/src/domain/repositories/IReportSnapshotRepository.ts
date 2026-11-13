import type { ReportSnapshot } from '../schema/report/reportSnapshot';

/**
 * As fotos dos relatórios do escritório (`tenants/{id}/report_snapshots`). Só o servidor lê e grava:
 * a foto conta com a visão da automação que a tirou, e quem a lê passa pela checagem do relatório de origem.
 */
export interface IReportSnapshotRepository {
  save(tenantId: string, snapshot: Omit<ReportSnapshot, 'id'>): Promise<string>;
  /** As fotos MAIS RECENTES de um relatório, até `limit`, na ordem em que foram tiradas. */
  series(tenantId: string, reportKey: string, limit: number): Promise<ReportSnapshot[]>;
}
