import { httpsCallable } from 'firebase/functions';
import { functions } from '../../infrastructure/firebase/config';
import type { IRecordImportRepository } from '../../domain/repositories/IRecordImportRepository';
import type {
  RecordImportFinishResponse,
  RecordImportParent,
  RecordImportRequest,
  RecordImportRowsResponse,
  RecordImportStartResponse,
} from '../../domain/schema/recordImport';

const call = <T>(request: RecordImportRequest): Promise<T> =>
  httpsCallable<RecordImportRequest, T>(functions, 'importRecords')(request).then((result) => result.data);

export class FirebaseRecordImportRepository implements IRecordImportRepository {
  async start(tenantId: string, table: string, fileName: string, totalRows: number, parent?: RecordImportParent): Promise<string> {
    return (await call<RecordImportStartResponse>({
      op: 'start',
      tenantId,
      table,
      fileName,
      totalRows,
      ...(parent ? { parent } : {}),
    })).importId;
  }

  async sendRows(
    tenantId: string,
    batch: Parameters<IRecordImportRepository['sendRows']>[1],
  ) {
    return (await call<RecordImportRowsResponse>({ op: 'rows', tenantId, ...batch })).results;
  }

  async finish(tenantId: string, importId: string, cancelled: boolean) {
    return (await call<RecordImportFinishResponse>({ op: 'finish', tenantId, importId, cancelled })).totals;
  }
}
