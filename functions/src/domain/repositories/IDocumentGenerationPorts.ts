import type { DocumentTemplateDataset, ResolvedDocumentTemplate } from '../schema/document/documentTemplate';

/** Os modelos que VALEM no escritório: os do pacote, sobrepostos pelos dele. */
export interface IDocumentTemplateSource {
  resolve(tenantId: string): Promise<ResolvedDocumentTemplate[]>;
}

export type RecordReadOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; errorParams?: Record<string, string> };

/**
 * Ler o registro de um documento e os filhos dele, com os vínculos navegados até onde os CAMINHOS
 * pedem — e só até ali. É a mesma hidratação das automações; esta porta existe para que a geração não
 * precise fingir ser uma execução para usá-la.
 */
export interface IDocumentRecordReader {
  /** `null` quando o registro não existe. */
  record(
    tenantId: string,
    collection: string,
    recordId: string,
    paths: readonly string[],
    timeZone: string,
  ): Promise<RecordReadOutcome<Record<string, unknown> | null>>;
  children(
    tenantId: string,
    dataset: DocumentTemplateDataset,
    parentId: string,
    paths: readonly string[],
    timeZone: string,
  ): Promise<RecordReadOutcome<Record<string, unknown>[]>>;
}
