/** Por onde o anexo chegou à aba Documentos — o mesmo carimbo `createdVia` de um registro. */
export type RecordDocumentVia = 'agent' | 'automation' | 'ui' | 'portal';

/**
 * Quem responde pelo anexo. Sem pessoa por trás, o autor é o motor (`workflow-engine`) e o nome fica
 * de fora — a mesma regra da gravação de registro, para que a aba não atribua a ninguém o que a
 * automação fez.
 */
export interface RecordDocumentAuthor {
  uid: string;
  name?: string | null;
  photoUrl?: string | null;
  via: RecordDocumentVia;
}

export interface RecordDocumentFile {
  tenantId: string;
  /** A coleção FÍSICA do registro — a mesma de `resolveQueryTable(...).physicalCollection`. */
  physicalCollection: string;
  recordId: string;
  name: string;
  contentType: string;
  data: Buffer;
  type?: string | null;
  description?: string | null;
  author: RecordDocumentAuthor;
  /** O anexo já nasce compartilhado no portal — o que o convidado envia ele vê. */
  portalShared?: boolean;
}

export interface AttachedRecordDocument {
  id: string;
  name: string;
  url: string;
  storagePath: string;
  contentType: string;
  size: number;
  /** O SHA-256 do conteúdo gravado, em hexadecimal — o mesmo campo que o documento guarda. */
  sha256: string;
  type?: string;
  description?: string;
}

/**
 * Anexar um arquivo à aba Documentos de um registro, do lado do servidor.
 *
 * É uma porta só para todo anexo que não nasce no navegador — o agente, o passo "Gerar documento" e o
 * gesto do registro —, para que os três gravem no mesmo caminho do bucket e na mesma subcoleção que a
 * tela, e a cascata de exclusão e a auditoria os alcancem sem saber de onde vieram.
 *
 * Lança quando não consegue: quem chama decide a mensagem, porque cada porta fala a própria língua.
 */
export interface IRecordDocumentWriter {
  attach(file: RecordDocumentFile): Promise<AttachedRecordDocument>;
}
