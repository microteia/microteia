import type { RecordDocumentLocation } from '../services/recordDocumentHash';

export interface RecordDocumentHashTarget extends RecordDocumentLocation {
  documentId: string;
  storagePath: string;
}

/**
 * Carimba no documento do registro o SHA-256 do arquivo que ele aponta. É a metade do anexo que o
 * navegador não pode fazer: o envio vai direto ao Storage, e um hash calculado no cliente seria a
 * palavra de quem anexou.
 *
 * Devolve o hash que ficou gravado — o que já estava, se outro carimbo chegou antes —, ou `null`
 * quando o documento ou o arquivo não existem mais.
 */
export interface IRecordDocumentHasher {
  stamp(target: RecordDocumentHashTarget): Promise<string | null>;
}
