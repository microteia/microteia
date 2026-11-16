/** O documento da aba Documentos como ele está gravado — o que a leitura precisa saber antes de abrir o arquivo. */
export interface StoredRecordDocument {
  id: string;
  name: string;
  contentType: string;
  /** Gravado por quem anexou — o navegador inclusive —, e por isso conferido antes de ser usado. */
  storagePath: string;
  size?: number;
}

/**
 * Ler, do lado do servidor, um documento anexado a um registro. Separado de `IRecordDocumentWriter`
 * porque quem lê não grava: o passo "Ler documento" não tem efeito nenhum, e pode ser reexecutado.
 */
export interface IRecordDocumentStore {
  find(tenantId: string, physicalCollection: string, recordId: string, documentId: string): Promise<StoredRecordDocument | null>;
  /** O conteúdo do arquivo, ou `null` quando ele não existe mais no bucket. */
  read(storagePath: string): Promise<Buffer | null>;
}
