import type { DeletionActor } from '../entities';
import type { EntityRecord, EntityRecordValues, RecordDocument, RecordNote } from '../entities/EntityRecord';

/**
 * Acesso genérico a registros por COLEÇÃO. A mesma implementação serve `persons`, `medico` ou
 * `vendas__produto` — é a coleção que muda, não o contrato.
 */
export interface IRecordRepository {
  getAll(tenantId: string, collection: string): Promise<EntityRecord[]>;
  subscribe(
    tenantId: string,
    collection: string,
    onUpdate: (records: EntityRecord[]) => void,
  ): () => void;
  getById(tenantId: string, collection: string, recordId: string): Promise<EntityRecord | null>;
  /**
   * Id de registro gerado no CLIENTE, para que um arquivo enviado ANTES do save já caia no caminho
   * final — `tenants/{t}/{coleção}/{id}/…`. Sem ele, o arquivo de um registro novo teria de nascer
   * num caminho provisório e ser movido depois, e o Storage não move objetos.
   */
  newId(tenantId: string, collection: string): string;
  create(
    tenantId: string,
    collection: string,
    data: EntityRecordValues,
    recordId?: string,
  ): Promise<EntityRecord>;
  update(
    tenantId: string,
    collection: string,
    recordId: string,
    data: EntityRecordValues,
  ): Promise<void>;
  delete(tenantId: string, collection: string, recordId: string, actor: DeletionActor): Promise<void>;
  hasRecords(tenantId: string, collection: string): Promise<boolean>;
}

export interface IRecordNoteRepository {
  getNotes(tenantId: string, collection: string, recordId: string): Promise<RecordNote[]>;
  addNote(
    tenantId: string,
    collection: string,
    recordId: string,
    data: Omit<RecordNote, 'id' | 'recordId' | 'collection' | 'tenantId' | 'createdAt'>,
  ): Promise<RecordNote>;
  deleteNote(
    tenantId: string,
    collection: string,
    recordId: string,
    noteId: string,
    actor: DeletionActor,
  ): Promise<void>;
}

export interface IRecordDocumentRepository {
  getDocuments(tenantId: string, collection: string, recordId: string): Promise<RecordDocument[]>;
  uploadDocument(tenantId: string, collection: string, recordId: string, file: File): Promise<string>;
  addDocument(
    tenantId: string,
    collection: string,
    recordId: string,
    data: Omit<RecordDocument, 'id' | 'recordId' | 'collection' | 'tenantId' | 'createdAt'>,
  ): Promise<RecordDocument>;
  deleteDocument(
    tenantId: string,
    collection: string,
    recordId: string,
    documentId: string,
    storagePath: string,
    actor: DeletionActor,
  ): Promise<void>;
}

/**
 * Arquivo de um CAMPO, e não da aba Documentos. A distinção é o que justifica o port próprio: um
 * anexo da aba tem documento no Firestore (com nome, tipo, autor e data), enquanto a identidade de um
 * arquivo de campo É o valor do campo — a URL de download gravada no registro.
 */
export interface IRecordFileRepository {
  upload(
    tenantId: string,
    collection: string,
    recordId: string,
    fieldKey: string,
    file: File,
  ): Promise<string>;
}
