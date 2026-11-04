import type { CustomFieldOption } from '../entities/entitySchemas';
import type { RecordSearchJobState, RecordSearchScan } from '../schema/recordSearch';

/** Um registro lido para derivar os termos, com a versão que a gravação dos termos exige intacta. */
export interface SearchableRecord {
  id: string;
  data: Record<string, unknown>;
  /** A gravação só vale sobre ESTA versão: uma edição posterior deriva os próprios termos. */
  version: string;
}

export interface IRecordSearchRepository {
  /** Os registros pedidos de uma coleção, numa leitura só; o que não existe fica de fora. */
  getRecords(tenantId: string, collection: string, ids: readonly string[]): Promise<Map<string, Record<string, unknown>>>;

  /** As opções de uma lista do escritório cujas chaves foram pedidas. */
  getLookupOptions(tenantId: string, lookupCollection: string, keys: readonly string[]): Promise<CustomFieldOption[]>;

  /**
   * Grava os termos se o registro ainda está na versão lida. `false` quando ele mudou ou sumiu
   * entre a leitura e a gravação — quem o mudou dispara a própria derivação.
   */
  writeTerms(tenantId: string, collection: string, record: SearchableRecord, terms: string[]): Promise<boolean>;

  /** Uma página da varredura, em ordem de id, depois de `afterId`. */
  scanPage(tenantId: string, scan: RecordSearchScan, afterId: string | null, limit: number): Promise<SearchableRecord[]>;

  getJob(tenantId: string, jobId: string): Promise<RecordSearchJobState | null>;

  listJobs(tenantId: string): Promise<Map<string, RecordSearchJobState>>;

  /**
   * Lê e regrava o job numa transação. `mutate` devolve `null` para não gravar nada, e `'delete'`
   * para apagar o job — o de propagação não tem o que guardar depois de terminar.
   */
  updateJob(
    tenantId: string,
    jobId: string,
    mutate: (current: RecordSearchJobState | null) => RecordSearchJobState | 'delete' | null,
  ): Promise<RecordSearchJobState | null>;
}
