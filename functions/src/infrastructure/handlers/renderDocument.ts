import { onCall, HttpsError } from 'firebase-functions/v2/https';
import { getDI } from '../di/container';
import { requirePermission } from './shared/requirePermission';
import { identifyActor } from '../workflow/identifyActor';
import { collectionPermissionId } from '../../domain/schema/access/permission';
import type { DocumentOutputFormat } from '../../domain/schema/document/documentTemplate';
import { DOCUMENT_OUTPUT_FORMATS } from '../../domain/schema/document/documentTemplate';
import type { DocumentDestination } from '../../domain/schema/document/documentDownloads';
import { isDocumentDestination, isRetentionDays } from '../../domain/schema/document/documentDownloads';
import { PERMISSION_DOCUMENTS_GENERATE } from '../../domain/schema/access';

interface RenderDocumentRequest {
  tenantId: string;
  templateKey: string;
  collection?: string;
  recordId?: string;
  /** Os dados de um modelo `payload` — no lugar de `collection` + `recordId`. */
  payload?: Record<string, unknown>;
  output?: string;
  destination?: string;
  expiresInDays?: number;
}

interface RenderDocumentResponse {
  document: { id: string; name: string; url: string } | null;
  destination?: DocumentDestination;
  /** ISO; só em Downloads, e `null` quando o item não expira. */
  expiresAt?: string | null;
  /** Quantas marcas saíram vazias porque a expressão falhou. */
  emptyFields: number;
  /** REFERÊNCIA de mensagem; `errorParams` traz o que a frase interpola. */
  error: string | null;
  errorParams?: Record<string, string>;
}

const textOf = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * O gesto "Gerar documento" do registro. É o MESMO caso de uso do passo `render-document` — o
 * documento que a pessoa gera na tela é o que a automação gera de madrugada.
 *
 * A porta cobra o mínimo — ler o registro — e o caso de uso cobra o que o DESTINO exige: anexar
 * altera o registro (`<coleção>.update`), Downloads não. Só o caso de uso sabe o destino quando quem
 * chama não o diz. A coleção vem de quem chama e é conferida contra a do modelo dentro do caso de
 * uso — sem isso, a permissão de uma tela daria acesso a gerar sobre outra.
 *
 * Com `payload`, o modelo é de dados e não de registro: a porta cobra `documents.generate`, e o caso
 * de uso cobra ainda a leitura de cada registro que o payload aponta.
 *
 * Falha de geração volta em `error` e não lança, como `runAction`: a tela mostra a frase do motivo.
 */
export const renderDocument = onCall(
  { region: 'southamerica-east1', cors: true, memory: '512MiB' },
  async (request): Promise<RenderDocumentResponse> => {
    if (!request.auth) throw new HttpsError('unauthenticated', '@core.automation/handler.unauthenticated');

    const data = (request.data ?? {}) as Partial<RenderDocumentRequest>;
    const tenantId = textOf(data.tenantId);
    const templateKey = textOf(data.templateKey);
    const collection = textOf(data.collection);
    const recordId = textOf(data.recordId);
    const output = textOf(data.output);
    const destination = textOf(data.destination);
    const expiresInDays = data.expiresInDays;

    if (!tenantId) throw new HttpsError('invalid-argument', '@core.automation/handler.tenant.missing');
    const payload = typeof data.payload === 'object' && data.payload !== null && !Array.isArray(data.payload)
      ? data.payload
      : undefined;
    if (!templateKey || (!payload && (!collection || !recordId))) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }
    if (output && !(DOCUMENT_OUTPUT_FORMATS as readonly string[]).includes(output)) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }

    if (destination && !isDocumentDestination(destination)) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }
    if (expiresInDays !== undefined && expiresInDays !== null && !isRetentionDays(expiresInDays)) {
      throw new HttpsError('invalid-argument', '@core.documents/render.request-invalid');
    }

    const permissions = await requirePermission(
      tenantId,
      request.auth,
      payload ? PERMISSION_DOCUMENTS_GENERATE : collectionPermissionId(collection, 'read'),
    );
    const actor = await identifyActor(request.auth.uid, 'ui', permissions);

    const result = await getDI().getRenderDocumentUseCase().execute({
      tenantId,
      templateKey,
      ...(payload ? { payload } : { collection, recordId }),
      ...(output ? { output: output as DocumentOutputFormat } : {}),
      ...(destination ? { destination: destination as DocumentDestination } : {}),
      ...(isRetentionDays(expiresInDays) ? { expiresInDays } : {}),
      chargePermissions: true,
      author: { uid: actor.userId, name: actor.name, photoUrl: actor.photoURL, via: 'ui' },
      permissions,
      reader: { uid: request.auth.uid, permissions },
    });

    if (!result.ok) {
      return {
        document: null,
        emptyFields: 0,
        error: result.error,
        ...(result.errorParams ? { errorParams: result.errorParams } : {}),
      };
    }
    return {
      document: { id: result.document.id, name: result.document.name, url: result.document.url },
      destination: result.destination,
      ...(result.destination === 'downloads' ? { expiresAt: result.document.expiresAt?.toISOString() ?? null } : {}),
      emptyFields: result.issues.length,
      error: null,
    };
  },
);
