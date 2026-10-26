import type { IScreenDefinitionProvider } from '../repositories/IScreenDefinitionProvider';
import type { IRecordDocumentSharing } from '../repositories/IRecordDocumentSharing';
import { resolveQueryTable } from '../schema/querySpec';
import { grants } from '../schema/access';
import { collectionPermissionId } from '../schema/access/permission';

export interface ShareRecordDocumentsRequest {
  tenantId: string;
  /** A coleção do registro — a chave pela qual a tela o descreve. */
  collection: string;
  recordId: string;
  shared: boolean;
  /** Só este documento; ausente = todos os do registro. */
  documentId?: string;
  /** Só os documentos deste tipo. */
  documentType?: string;
  /** Quem responde pela troca: a pessoa do escritório, ou o motor. */
  actorUid: string;
  /**
   * As permissões de quem pede. Presentes, cobra-se `<coleção>.update` — compartilhar é editar o
   * registro, como na regra da tela. A automação sem pessoa não as traz: age como o motor.
   */
  permissions?: readonly string[];
}

export type ShareRecordDocumentsResult =
  | { ok: true; matched: number; changed: number; shared: boolean }
  | { ok: false; error: string; errorParams?: Record<string, string> };

export interface ShareRecordDocumentsUseCase {
  execute(request: ShareRecordDocumentsRequest): Promise<ShareRecordDocumentsResult>;
}

export interface ShareRecordDocumentsDeps {
  screens: IScreenDefinitionProvider;
  sharing: IRecordDocumentSharing;
}

const failure = (error: string, errorParams?: Record<string, string>): ShareRecordDocumentsResult =>
  errorParams ? { ok: false, error, errorParams } : { ok: false, error };

/**
 * Compartilhar com o portal — ou deixar de compartilhar — os documentos que um registro já tem.
 *
 * Grava a MESMA marca que a tela e o upload do convidado gravam, e nada além dela: quem decide quem vê
 * é a projeção do portal, que só leva o documento a quem já vê o registro (sujeito, `visibleWhen`,
 * cadeia de pais). A auditoria registra cada troca pelo gatilho da subcoleção, com quem a fez.
 *
 * Deixar de compartilhar não depende de o portal mostrar documentos: tirar algo de lá é sempre
 * permitido. Compartilhar numa tela que não os mostra é recusado, em vez de marcar o que ninguém vê.
 */
export const makeShareRecordDocumentsUseCase = (deps: ShareRecordDocumentsDeps): ShareRecordDocumentsUseCase => ({
  execute: async (request) => {
    const collection = request.collection.trim();
    const schema = await deps.screens.getSchemaContext(request.tenantId);
    const table = resolveQueryTable(collection, schema);
    const screen = schema.screens.get(collection);
    if (!table || !screen) return failure('@core.automation/mutation.table.unknown', { table: collection });

    const permission = collectionPermissionId(collection, 'update');
    if (request.permissions && !grants(request.permissions, permission)) {
      return failure('@core.access/permission.denied', { permission });
    }
    if (screen.hasDocuments !== true) return failure('@core.documents/render.documents-disabled', { collection });

    const physical = table.physicalCollection;
    if (request.shared && !(await deps.sharing.portalShowsDocuments(request.tenantId, physical))) {
      return failure('@core.documents/share.portal-off', { collection });
    }
    if (!(await deps.sharing.recordExists(request.tenantId, physical, request.recordId))) {
      return failure('@core.records/record.not-found');
    }

    let documents = await deps.sharing.documents(request.tenantId, physical, request.recordId);
    const documentId = request.documentId?.trim();
    if (documentId) {
      documents = documents.filter((document) => document.id === documentId);
      if (documents.length === 0) {
        return failure('@core.documents/share.document-not-found', { document: documentId, record: request.recordId });
      }
    }
    const documentType = request.documentType?.trim();
    if (documentType) documents = documents.filter((document) => document.type === documentType);

    const changing = documents.filter((document) => document.portalShared !== request.shared).map((document) => document.id);
    if (changing.length > 0) {
      await deps.sharing.setPortalShared(request.tenantId, physical, request.recordId, changing, request.shared, request.actorUid);
    }
    return { ok: true, matched: documents.length, changed: changing.length, shared: request.shared };
  },
});
