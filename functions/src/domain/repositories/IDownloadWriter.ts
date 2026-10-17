import type { DownloadOrigin, DownloadVisibility } from '../schema/document/documentDownloads';
import type { RecordDocumentAuthor } from './IRecordDocumentWriter';

export interface DownloadFileInput {
  tenantId: string;
  name: string;
  contentType: string;
  data: Buffer;
  /** Quem o vê como dono. `null` no arquivo de automação sem pessoa. */
  ownerId: string | null;
  visibility: DownloadVisibility;
  /** `null` = não expira. */
  expiresAt: Date | null;
  templateKey?: string;
  origin?: DownloadOrigin;
  author: RecordDocumentAuthor;
}

export interface SavedDownload {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
  size: number;
  expiresAt: Date | null;
}

/**
 * Gravar um arquivo gerado na tela Downloads do escritório.
 *
 * É o par de `IRecordDocumentWriter` para o destino temporário: o mesmo cuidado de ordem (bucket
 * primeiro, documento depois, arquivo apagado se o documento falhar), outro lugar. Quem apaga o
 * arquivo quando o item vence é o gatilho de exclusão do documento — o escritor não agenda nada.
 *
 * Lança quando não consegue: quem chama decide a mensagem.
 */
export interface IDownloadWriter {
  save(file: DownloadFileInput): Promise<SavedDownload>;
}
