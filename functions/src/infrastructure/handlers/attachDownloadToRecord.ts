import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { identifyActor } from '../workflow/identifyActor';
import { collectionPermissionId } from '../../domain/schema/access/permission';

interface AttachDownloadRequest {
  tenantId: string;
  downloadId: string;
  collection: string;
  recordId: string;
  documentType?: string;
}

interface AttachDownloadResponse {
  document: { id: string; name: string; url: string } | null;
  /** O item saiu de Downloads; `false` quando ficou lá também (arquivo público de outra pessoa). */
  moved?: boolean;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * "Anexar a um registro", na tela Downloads: o arquivo temporário vai para a aba Documentos e sai de
 * Downloads. Mover pede o servidor — o cliente não grava em Downloads nem lê o arquivo de outra pessoa
 * pelo SDK. A porta cobra `<coleção>.update` (anexar altera o registro); o caso de uso confere ainda
 * se quem pede VÊ o item, pela mesma frase da regra.
 */
export const attachDownloadToRecord = onCall(
  { region: 'southamerica-east1', cors: true, memory: '512MiB' },
  async (request): Promise<AttachDownloadResponse> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');

    const data = (request.data ?? {}) as Partial<AttachDownloadRequest>;
    const tenantId = textOf(data.tenantId);
    const downloadId = textOf(data.downloadId);
    const collection = textOf(data.collection);
    const recordId = textOf(data.recordId);
    const documentType = textOf(data.documentType);

    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    if (!downloadId || !collection || !recordId) {
      throw new HttpsError('invalid-argument', '@core.documents/downloads.attach.request-invalid');
    }

    const permissions = await requirePermission(tenantId, request.auth, collectionPermissionId(collection, 'update'));
    const actor = await identifyActor(request.auth.uid, 'ui', permissions);

    const result = await getDI().getAttachDownloadToRecordUseCase().execute({
      tenantId,
      downloadId,
      collection,
      recordId,
      ...(documentType ? { documentType } : {}),
      author: { uid: actor.userId, name: actor.name, photoUrl: actor.photoURL, via: 'ui' },
      permissions,
      reader: { uid: request.auth.uid, permissions },
    });

    if (!result.ok) {
      return { document: null, error: result.error, ...(result.errorParams ? { errorParams: result.errorParams } : {}) };
    }
    return {
      document: { id: result.document.id, name: result.document.name, url: result.document.url },
      moved: result.moved,
      error: null,
    };
  },
);
