import type { RecordImportStatus, RecordImportTotals } from '../schema/recordImport';

/** O job de uma importação executada — `tenants/{id}/record_imports/{importId}`. A simulação não abre job. */
export interface RecordImportJob {
  id: string;
  table: string;
  collection: string;
  fileName: string;
  totalRows: number;
  status: RecordImportStatus;
  createdBy: string;
  totals: RecordImportTotals;
}

export type NewRecordImportJob = Omit<RecordImportJob, 'id' | 'status' | 'totals'> & { expiresAt: Date };

export interface IRecordImportJobRepository {
  create: (tenantId: string, job: NewRecordImportJob) => Promise<string>;
  get: (tenantId: string, importId: string) => Promise<RecordImportJob | null>;
  /** Soma o resultado de um lote aos totais — por incremento, para dois lotes nunca se sobreporem. */
  addTotals: (tenantId: string, importId: string, totals: RecordImportTotals) => Promise<void>;
  /**
   * Fecha o job que ainda está em curso e devolve como ele ficou; `null` se ele já estava fechado. É a
   * trava que impede a mesma importação de gerar duas linhas de Auditoria.
   */
  close: (
    tenantId: string,
    importId: string,
    status: Exclude<RecordImportStatus, 'running'>,
  ) => Promise<RecordImportJob | null>;
}
