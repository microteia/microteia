import type { RecordImportRow, RecordImportRowResult, RecordImportTotals } from '../schema/recordImport';

/** A porta da importação em massa no servidor. Toda recusa chega como erro com REFERÊNCIA de mensagem. */
export interface IRecordImportRepository {
  start: (tenantId: string, table: string, fileName: string, totalRows: number) => Promise<string>;
  sendRows: (
    tenantId: string,
    batch: { table: string; importId?: string; dryRun: boolean; rows: RecordImportRow[] },
  ) => Promise<RecordImportRowResult[]>;
  finish: (tenantId: string, importId: string, cancelled: boolean) => Promise<RecordImportTotals>;
}
