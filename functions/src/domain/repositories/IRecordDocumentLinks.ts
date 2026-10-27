export interface RecordDocumentRef {
  tenantId: string;
  /** A coleção FÍSICA do registro — a pasta do arquivo no bucket. */
  collection: string;
  recordId: string;
  documentId: string;
}

export interface SignedDocumentLinkRequest {
  /** Já conferido contra a pasta do registro (`recordDocumentStoragePath`). */
  storagePath: string;
  /** O nome com que o navegador mostra e salva o arquivo. */
  fileName: string;
  expiresAt: Date;
}

/**
 * Os links de arquivo de um documento de registro que não são o permanente: o link assinado e curto que
 * o convidado do portal recebe, e o selo que diz se o token permanente já saiu (`recordDocumentLinks`).
 */
export interface IRecordDocumentLinks {
  /**
   * URL de LEITURA assinada, que vence em `expiresAt`. Não passa por regra nenhuma — quem chama confere o
   * acesso antes. Exige que a conta das functions possa assinar (`iam.serviceAccounts.signBlob`).
   */
  sign(request: SignedDocumentLinkRequest): Promise<string>;
  /**
   * Troca o token permanente do arquivo e a `url` do documento, e sela o novo. Idempotente: o documento
   * já selado não muda, e a troca pendente é terminada com o token que ela escolheu. `false` quando não
   * houve o que trocar — selado, apagado, ou sem arquivo na pasta do registro.
   */
  rotate(ref: RecordDocumentRef): Promise<boolean>;
  /** Sela o token ATUAL, sem trocá-lo — o documento compartilhado pela primeira vez, que nunca o entregou. */
  seal(ref: RecordDocumentRef): Promise<void>;
  /** O token atual vai sair pelo portal: o selo deixa de valer. */
  unseal(ref: RecordDocumentRef): Promise<void>;
  /** Os ids dos documentos do registro cujo token precisa ser trocado (`needsRecordDocumentLinkRotation`). */
  pendingRotation(tenantId: string, collection: string, recordId: string): Promise<string[]>;
}
