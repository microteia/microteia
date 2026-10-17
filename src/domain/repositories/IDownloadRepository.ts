import type { DownloadItem, DownloadVisibility } from '../schema/document/documentDownloads';

/**
 * O que a pessoa enxerga em Downloads. Quem gerencia vê tudo; os demais, os próprios itens mais os da
 * automação liberados para todos — duas consultas, porque a regra do Firestore só aprova uma lista que
 * ela consiga provar pelo filtro.
 */
export interface DownloadsScope {
  userId: string;
  seeAll: boolean;
}

export interface AttachDownloadInput {
  tenantId: string;
  downloadId: string;
  /** A coleção FÍSICA do registro de destino. */
  collection: string;
  recordId: string;
  documentType?: string;
}

export interface AttachDownloadResult {
  document: { id: string; name: string; url: string } | null;
  /** O item saiu de Downloads; `false` quando ficou lá também (arquivo público de outra pessoa). */
  moved?: boolean;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

export interface IDownloadRepository {
  /** Os itens mais recentes primeiro. Vencidos ainda não apagados pelo TTL podem vir: quem lista filtra. */
  subscribe(
    tenantId: string,
    scope: DownloadsScope,
    onUpdate: (items: DownloadItem[]) => void,
    onError?: (error: Error) => void,
  ): () => void;
  /** Apaga o item; o arquivo sai do bucket pelo gatilho de exclusão, no servidor. */
  delete(tenantId: string, downloadId: string): Promise<void>;
  /** Público ou privado — gesto de quem gerencia Downloads; a regra recusa os demais. */
  setVisibility(tenantId: string, downloadId: string, visibility: DownloadVisibility): Promise<void>;
  /** Move o arquivo para a aba Documentos de um registro, no SERVIDOR, e o tira de Downloads. */
  attachToRecord(input: AttachDownloadInput): Promise<AttachDownloadResult>;
}
