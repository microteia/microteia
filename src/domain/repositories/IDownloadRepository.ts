import type { DownloadItem } from '../schema/document/documentDownloads';

/**
 * O que a pessoa enxerga em Downloads. Quem gerencia vê tudo; os demais, os próprios itens mais os da
 * automação liberados para todos — duas consultas, porque a regra do Firestore só aprova uma lista que
 * ela consiga provar pelo filtro.
 */
export interface DownloadsScope {
  userId: string;
  seeAll: boolean;
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
}
