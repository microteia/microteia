import type { BusinessCalendarSet } from '../schema/time/businessDays';
import type { RecordReader } from '../schema/memberVisibility';
import type {
  DocumentTemplateDataset,
  DocumentTemplateSpec,
  ResolvedDocumentTemplate,
} from '../schema/document/documentTemplate';

/** Os modelos que VALEM no escritório: os do pacote, sobrepostos pelos dele. */
export interface IDocumentTemplateSource {
  resolve(tenantId: string): Promise<ResolvedDocumentTemplate[]>;
  /**
   * Um modelo AINDA NÃO GRAVADO — o rascunho do editor —, resolvido pela mesma regra dos gravados:
   * tela pelo `sourceId`, chave para coleção física. `null` quando a tela dele não está no escritório.
   */
  resolveDraft(tenantId: string, draft: DocumentTemplateSpec): Promise<ResolvedDocumentTemplate | null>;
}

export type RecordReadOutcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: string; errorParams?: Record<string, string> };

/**
 * Ler o registro de um documento e os filhos dele, com os vínculos navegados até onde os CAMINHOS
 * pedem — e só até ali. É a mesma hidratação das automações; esta porta existe para que a geração não
 * precise fingir ser uma execução para usá-la.
 */
/**
 * `reader` é a pessoa a quem o documento é entregue. Presente, a visibilidade por registro
 * (`memberVisibility`) vale: o registro que ela não vê responde como ausente, e o filho que ela não vê
 * não entra na lista. Ausente — a automação —, quem lê é o escritório.
 */
export interface IDocumentRecordReader {
  /** `null` quando o registro não existe — ou quando `reader` não o vê. */
  record(
    tenantId: string,
    collection: string,
    recordId: string,
    paths: readonly string[],
    timeZone: string,
    businessCalendars?: BusinessCalendarSet | null,
    reader?: RecordReader | null,
  ): Promise<RecordReadOutcome<Record<string, unknown> | null>>;
  children(
    tenantId: string,
    dataset: DocumentTemplateDataset,
    parentId: string,
    paths: readonly string[],
    timeZone: string,
    businessCalendars?: BusinessCalendarSet | null,
    reader?: RecordReader | null,
  ): Promise<RecordReadOutcome<Record<string, unknown>[]>>;
}
