/** Um documento da aba Documentos, na forma que o compartilhamento com o portal precisa. */
export interface SharableRecordDocument {
  id: string;
  type?: string;
  portalShared: boolean;
}

/**
 * A marca de compartilhamento dos documentos de um registro, do lado do servidor.
 *
 * É o MESMO campo (`portalShared`, com `portalSharedBy` e `portalSharedAt`) que a tela grava e que o
 * upload do convidado já nasce com: a projeção do portal o lê sem saber quem o gravou, e a auditoria
 * registra a troca com o autor dela.
 */
export interface IRecordDocumentSharing {
  recordExists(tenantId: string, physicalCollection: string, recordId: string): Promise<boolean>;
  /** Os documentos vivos do registro — o que foi marcado para exclusão fica de fora. */
  documents(tenantId: string, physicalCollection: string, recordId: string): Promise<SharableRecordDocument[]>;
  setPortalShared(
    tenantId: string,
    physicalCollection: string,
    recordId: string,
    documentIds: readonly string[],
    shared: boolean,
    actorUid: string,
  ): Promise<void>;
  /** A tela da coleção mostra documentos no portal (`portal.documents`)? */
  portalShowsDocuments(tenantId: string, physicalCollection: string): Promise<boolean>;
}
