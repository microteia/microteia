import type { DownloadVisibility } from '../schema/document/documentDownloads';

/** O item de Downloads como quem o MOVE precisa dele: quem o vê e onde está o arquivo. */
export interface StoredDownload {
  id: string;
  name: string;
  storagePath: string;
  contentType: string;
  ownerId: string | null;
  visibility: DownloadVisibility;
}

/**
 * A leitura e a remoção de um item de Downloads, do lado do servidor. A gravação é de
 * `IDownloadWriter`; esta porta existe para quem tira um item de lá — anexá-lo a um registro.
 */
export interface IDownloadStore {
  /** `null` quando o item não existe. */
  get(tenantId: string, downloadId: string): Promise<StoredDownload | null>;
  readFile(storagePath: string): Promise<Buffer>;
  /** Apaga o documento; o arquivo sai do bucket pelo gatilho `onDownloadDeleted`. */
  delete(tenantId: string, downloadId: string): Promise<void>;
}
